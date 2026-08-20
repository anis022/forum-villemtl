import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  looksLikeProject,
  planProposals,
  type KnownProject,
  type ResolutionCandidate,
} from "@/utils/ingest/project-candidates";

/**
 * Notice what the council decided, and propose it as a project.
 *
 * Runs after a sitting's record lands, reads `council_resolutions`, and writes
 * proposals into `project_revisions`. It publishes nothing. Every row it writes
 * is `origin = 'cron'` and `status = 'pending'`, and the only way out of that
 * state is a person pressing publish in /projets/revisions.
 *
 * That is enforced below this route rather than by it. The insert policy on
 * `project_revisions` accepts `origin = 'staff'` only, so nothing reachable
 * from a browser can forge a cron proposal; this gets its rows in because the
 * service key bypasses RLS, which is why that key never leaves the server. And
 * `public.projects` carries no write policy at all, so even a compromised
 * version of this route could not put anything in front of a resident.
 *
 * Two things it proposes, from one scan:
 *
 *   a new project   a decision about a place the site does not cover yet
 *   an edit         a decision about a place it does, appended as a milestone
 *
 * The second is the more useful half and the reason this is not a one-off
 * import. A park gets a design contract in March and a construction contract in
 * June, and the June sitting should extend that page rather than start a second
 * one beside it.
 *
 * The decisions themselves are in `planProposals`, which touches no database.
 * `npm run sync:projects` is the same work over a direct Postgres connection —
 * the manual handle on the same machine, exactly as `npm run sync:events` is
 * for the events cron — and the two must never disagree about what a project
 * is, which is why neither of them owns that judgement.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!secret || !key || !url) {
    return Response.json({ error: "sync is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error: readError } = await supabase
    .from("council_resolutions")
    .select("number, title, body, outcome, dossier, council_meetings(meeting_date, youtube_id)")
    .order("number");

  if (readError) {
    console.error("[cron/projects] lecture des resolutions:", readError.message);
    return Response.json({ error: "could not read resolutions" }, { status: 502 });
  }

  const candidates: ResolutionCandidate[] = (rows ?? [])
    .map((r) => {
      const meeting = r.council_meetings as unknown as {
        meeting_date: string;
        youtube_id: string | null;
      } | null;
      return {
        number: r.number as string,
        title: r.title as string,
        body: r.body as string | null,
        outcome: r.outcome as string | null,
        dossier: r.dossier as string | null,
        meetingDate: meeting?.meeting_date ?? "",
        youtubeId: meeting?.youtube_id ?? null,
      };
    })
    .filter((c) => c.meetingDate && looksLikeProject(c.title));

  const known = await loadKnown(supabase);
  const { proposals, skipped } = planProposals({ candidates, ...known });

  const created: string[] = [];
  const edited: string[] = [];

  for (const proposal of proposals) {
    const { kind, ...row } = proposal;
    const { error } = await supabase
      .from("project_revisions")
      .insert({ ...row, origin: "cron", status: "pending" });

    if (error) {
      console.error(`[cron/projects] ${proposal.resolution_number}:`, error.message);
      skipped.push(`${proposal.resolution_number} (${error.message})`);
      continue;
    }
    (kind === "edited" ? edited : created).push(`${proposal.resolution_number} → ${row.slug}`);
  }

  return Response.json({ ok: true, scanned: candidates.length, created, edited, skipped });
}

type RevisionKeys = {
  resolution_number: string | null;
  project_id: string | null;
  slug: string;
  status: string;
};

/** What has been proposed before, and what already exists to be edited. */
async function loadKnown(supabase: SupabaseClient): Promise<{
  projects: KnownProject[];
  alreadyProposed: Set<string>;
  pendingTargets: Set<string>;
}> {
  const [revisions, projects] = await Promise.all([
    supabase.from("project_revisions").select("resolution_number, project_id, slug, status"),
    supabase.from("projects").select("id, slug, content"),
  ]);

  const alreadyProposed = new Set<string>();
  const pendingTargets = new Set<string>();

  for (const r of (revisions.data ?? []) as RevisionKeys[]) {
    // Any verdict counts, rejected included. Somebody looked at that decision
    // and said no, and proposing it again next week would be the machine
    // overruling them once a week until they gave in.
    if (r.resolution_number) alreadyProposed.add(r.resolution_number);
    if (r.status === "pending") pendingTargets.add(r.project_id ?? r.slug);
  }

  return {
    projects: (projects.data ?? []) as KnownProject[],
    alreadyProposed,
    pendingTargets,
  };
}
