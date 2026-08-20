"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth";

/**
 * Proposing a change to a project, and deciding one.
 *
 * Nothing here writes `public.projects`. There is no policy that would let it:
 * the live table is reachable only through `approve_project_revision`, which is
 * security definer and checks `is_official` itself. So the gate on these actions
 * is a courtesy that produces a readable message, and the gate that actually
 * holds is in the database — which is the right way round, because an action is
 * one route among several and a policy is every route at once.
 *
 * A staff proposal is created and approved by the same call. That is not a hole
 * in the waitlist: the people who may approve are the people who may propose,
 * and asking one of nine to find another of the nine to click a second button on
 * their own typo would empty the queue of everything except real work. What it
 * still does is write the revision, so the history of a project is every change
 * anybody made to it, with a name and a time against each.
 *
 * The waitlist exists for the cron, which is not a person and does not get to
 * publish to residents on its own.
 */

export type ProjectActionState = { error: string | null; ok?: string };

/**
 * The shape the form sends, checked before it reaches the database.
 *
 * Deliberately looser than `project_content_complete` in migration 0028: this
 * rejects the malformed, that rejects the unfinished. A half-written project is
 * a normal thing to save; a milestone with no date is not a milestone.
 */
const Localized = z.object({
  fr: z.string().trim().max(4000),
  en: z.string().trim().max(4000),
});

const Content = z.object({
  title: Localized,
  summary: Localized,
  status: z.enum(["study", "decided", "underway", "done"]),
  address: z.string().trim().max(300),
  description: z.array(Localized).max(30),
  photos: z
    .array(
      z.object({
        src: z.string().trim().min(1).max(600),
        caption: Localized,
        credit: z.string().trim().max(300),
      }),
    )
    .max(20),
  milestones: z
    .array(
      z.object({
        on: z.string().trim().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, "date"),
        onLabel: Localized.optional(),
        title: Localized,
        body: Localized.optional(),
        resolution: z.string().trim().max(60).optional(),
        source: z.object({ label: Localized, url: z.string().url() }).optional(),
      }),
    )
    .max(40),
  councilTerm: z.string().trim().max(120).optional(),
  sources: z.array(z.object({ label: Localized, url: z.string().url() })).max(20),
});

const Proposal = z.object({
  /** Absent creates a project; present edits that one. */
  projectId: z.string().uuid().nullable(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug"),
  content: Content,
  /** A staff proposal publishes immediately; only the cron waits. */
  publish: z.boolean(),
});

/**
 * Save a project, as a revision.
 *
 * `revisionId` continues an existing pending proposal — the normal way a person
 * finishes what the cron started — rather than opening a second one beside it.
 * The database refuses two pending proposals for the same project anyway, so
 * without this the second save of a cron draft would fail on a unique index and
 * read as a bug.
 */
export async function saveProject(
  revisionId: string | null,
  raw: unknown,
): Promise<ProjectActionState> {
  const user = await getSessionUser();
  if (user?.role !== "official") return { error: "Réservé au cabinet de l'arrondissement." };

  const parsed = Proposal.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: `Champ invalide : ${first.path.join(".") || first.message}` };
  }
  const { projectId, slug, content, publish } = parsed.data;

  const supabase = createClient(await cookies());

  let id = revisionId;
  if (id) {
    const { error } = await supabase
      .from("project_revisions")
      .update({ slug, content, project_id: projectId })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return { error: `Enregistrement refusé : ${error.message}` };
  } else {
    const { data, error } = await supabase
      .from("project_revisions")
      .insert({
        project_id: projectId,
        slug,
        content,
        origin: "staff",
        status: "pending",
        created_by: user.id,
      })
      .select("id")
      .single();
    // The unique partial index is the likeliest failure and deserves a sentence
    // rather than a Postgres error string: somebody else is already editing it.
    if (error) {
      return {
        error: error.code === "23505"
          ? "Une proposition est déjà en attente pour ce projet. Ouvrez-la plutôt que d'en créer une seconde."
          : `Enregistrement refusé : ${error.message}`,
      };
    }
    id = data.id as string;
  }

  if (!publish) {
    revalidatePath("/fr/projets/revisions");
    revalidatePath("/en/projets/revisions");
    return { error: null, ok: "Brouillon enregistré." };
  }

  return approveProject(id, null);
}

/**
 * Publish a proposal.
 *
 * The completeness check lives in the database and raises rather than returning
 * false, so its message is what the reviewer sees. That message names the three
 * things a project needs, which is more useful than "invalid" and is written in
 * one place instead of two.
 */
export async function approveProject(
  revisionId: string,
  note: string | null,
): Promise<ProjectActionState> {
  const user = await getSessionUser();
  if (user?.role !== "official") return { error: "Réservé au cabinet de l'arrondissement." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("approve_project_revision", {
    revision_id: revisionId,
    note,
  });

  if (error) return { error: error.message.replace(/^.*incomplete: /, "") };

  for (const lang of ["fr", "en"]) {
    revalidatePath(`/${lang}/projets`);
    revalidatePath(`/${lang}/projets/[slug]`, "page");
    revalidatePath(`/${lang}/projets/revisions`);
    revalidatePath(`/${lang}`);
  }
  return { error: null, ok: "Publié." };
}

export async function rejectProject(
  revisionId: string,
  note: string | null,
): Promise<ProjectActionState> {
  const user = await getSessionUser();
  if (user?.role !== "official") return { error: "Réservé au cabinet de l'arrondissement." };

  const supabase = createClient(await cookies());
  const { error } = await supabase.rpc("reject_project_revision", {
    revision_id: revisionId,
    note,
  });
  if (error) return { error: error.message };

  revalidatePath("/fr/projets/revisions");
  revalidatePath("/en/projets/revisions");
  return { error: null, ok: "Proposition écartée." };
}

/**
 * Put a photograph in the bucket and hand back the URL the content will hold.
 *
 * Seeded photos are paths under `public/` and new ones are absolute URLs into
 * storage. Both work as an `src`, which is why `photos[].src` is a string and
 * not a discriminated union: the page renders whichever it is given, and the
 * distinction matters to nobody reading it.
 */
export async function uploadProjectPhoto(
  slug: string,
  file: File,
): Promise<{ url: string | null; error: string | null }> {
  const user = await getSessionUser();
  if (user?.role !== "official") return { url: null, error: "Réservé au cabinet." };

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { url: null, error: "Format accepté : JPEG, PNG ou WebP." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: "Cinq mégaoctets au maximum." };
  }

  const supabase = createClient(await cookies());
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${slug}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("project-photos")
    .upload(path, file, { contentType: file.type });
  if (error) return { url: null, error: `Téléversement refusé : ${error.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from("project-photos").getPublicUrl(path);
  return { url: publicUrl, error: null };
}
