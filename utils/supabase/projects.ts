import { cookies } from "next/headers";
import { createClient } from "./server";
import type { Project, ProjectContent, ProjectStatus } from "@/utils/projects";

/**
 * Reading projects, and the waitlist that stands in front of writing them.
 *
 * The tables are `public.projects` and `public.project_revisions` (migration
 * 0028). Everything a resident sees comes from the first; everything anybody
 * proposes goes into the second and waits there.
 *
 * There is no write function for `public.projects` in this file, and that is
 * not an omission. The table carries no insert or update policy for any role,
 * so the only path into it is `approve_project_revision`, which is security
 * definer and checks the caller. Adding a direct write here would not work, and
 * if it ever did, the waitlist would be a convention rather than a rule.
 */

async function sb() {
  return createClient(await cookies());
}

/** A row of `public.projects`, reassembled into the type the pages render. */
type ProjectRow = {
  id: string;
  slug: string;
  content: ProjectContent;
  status: ProjectStatus;
  published: boolean;
  updated_at: string;
};

const toProject = (r: ProjectRow): Project => ({ ...r.content, slug: r.slug });

/**
 * Every project a resident may see.
 *
 * Ordered by slug rather than by date. A project list is read as a directory —
 * somebody arrives looking for the Empress, not for whatever changed last — and
 * ordering by recency would move the thing they came for every time the office
 * edited something else.
 */
export async function listProjects(): Promise<Project[]> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, content, status, published, updated_at")
    .eq("published", true)
    .order("slug");

  if (error) {
    console.error("[projects] list:", error.message);
    return [];
  }
  return (data as ProjectRow[]).map(toProject);
}

/**
 * One project by its URL.
 *
 * Published only. An official who wants to see an unfinished one looks at the
 * proposal in the waitlist, which is where the unfinished version actually
 * lives — `projects` never holds a draft.
 */
export async function projectBySlug(slug: string): Promise<Project | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, content, status, published, updated_at")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    console.error("[projects] bySlug:", error.message);
    return null;
  }
  return data ? toProject(data as ProjectRow) : null;
}

export type EditableProject = { id: string; project: Project };

/**
 * The live row behind a public project, including the id a revision targets.
 *
 * This is intentionally separate from `projectBySlug`: a resident never needs
 * the database id, while an official editing the page must target the trusted
 * row the server just read rather than an id supplied by the browser.
 */
export async function projectForEditingBySlug(slug: string): Promise<EditableProject | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, content, status, published, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[projects] forEditing:", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as ProjectRow;
  return { id: row.id, project: toProject(row) };
}

/** A pending cron/staff proposal wins over starting a competing edit. */
export async function pendingRevisionForProject(projectId: string): Promise<Revision | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("project_revisions_view")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    console.error("[projects] pendingForProject:", error.message);
    return null;
  }
  return data ? toRevision(data as RevisionRow) : null;
}

/** Slug and id of everything in the table, for the editor's project picker. */
export async function listProjectsForEditing(): Promise<
  { id: string; slug: string; title: string; published: boolean }[]
> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, content, published")
    .order("slug");

  if (error) {
    console.error("[projects] listForEditing:", error.message);
    return [];
  }
  return (data as ProjectRow[]).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.content.title.fr,
    published: r.published,
  }));
}

// --- the waitlist ----------------------------------------------------------

export type Revision = {
  id: string;
  projectId: string | null;
  slug: string;
  content: ProjectContent;
  status: "pending" | "approved" | "rejected";
  origin: "cron" | "staff";
  resolutionNumber: string | null;
  sourceNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  /**
   * Whether this would be accepted if somebody pressed approve right now.
   *
   * Computed by the database, using the same function the approval path calls,
   * so the queue cannot show a green proposal that then refuses to go through.
   * A cron proposal is normally false here, and that is the design: it arrives
   * with the one milestone a resolution gave it and waits for a person to add
   * the photograph and the second date.
   */
  complete: boolean;
};

type RevisionRow = {
  id: string;
  project_id: string | null;
  slug: string;
  content: ProjectContent;
  status: Revision["status"];
  origin: Revision["origin"];
  resolution_number: string | null;
  source_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  complete: boolean;
};

const toRevision = (r: RevisionRow): Revision => ({
  id: r.id,
  projectId: r.project_id,
  slug: r.slug,
  content: r.content,
  status: r.status,
  origin: r.origin,
  resolutionNumber: r.resolution_number,
  sourceNote: r.source_note,
  createdAt: r.created_at,
  reviewedAt: r.reviewed_at,
  reviewNote: r.review_note,
  complete: r.complete,
});

/**
 * What is waiting for somebody to look at it.
 *
 * Returns nothing at all to a resident, twice over: this is called only from a
 * page that turns non-officials away, and the SELECT policy on the table would
 * return them an empty list regardless. The second is the one that matters.
 *
 * Oldest first. A queue read newest-first is a queue whose bottom never gets
 * read, and the bottom of this one is the proposal that has been ignored
 * longest.
 */
export async function listPendingRevisions(): Promise<Revision[]> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("project_revisions_view")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[projects] pending:", error.message);
    return [];
  }
  return (data as RevisionRow[]).map(toRevision);
}

/** One proposal, for the editor to load into its form. */
export async function revisionById(id: string): Promise<Revision | null> {
  const supabase = await sb();
  const { data, error } = await supabase
    .from("project_revisions_view")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[projects] revisionById:", error.message);
    return null;
  }
  return data ? toRevision(data as RevisionRow) : null;
}
