import { cookies } from "next/headers";
import { createClient } from "./server";
import type { Flag } from "@/utils/moderation";

type ProfileRow = { first_name: string; last_name: string } | null;

type FlagRow = {
  id: string;
  score: number;
  terms: string[] | null;
  created_at: string;
  issue: { id: string; title: string; body: string; author: ProfileRow } | null;
  comment: {
    id: string;
    body: string;
    issue_id: string;
    author: ProfileRow;
  } | null;
};

const nameOf = (profile: ProfileRow) =>
  profile ? `${profile.first_name} ${profile.last_name}`.trim() || null : null;

/**
 * The open queue, newest first.
 *
 * Both sides are embedded in one request rather than fetched per row: a queue is
 * a page of twenty items, and twenty round trips to render a list nobody reads
 * twice a week is the kind of thing that only shows up once the borough has a
 * bad month.
 *
 * Returns an empty list for anyone who is not an elected official, because the
 * SELECT policy on `moderation_flags` gives them no rows — the page checks the
 * role as well so it can say so, but the data is gone either way.
 */
export async function listOpenFlags(limit = 50): Promise<Flag[]> {
  const supabase = createClient(await cookies());

  const { data, error } = await supabase
    .from("moderation_flags")
    .select(
      "id, score, terms, created_at," +
        " issue:issues!moderation_flags_issue_id_fkey(id, title, body, author:profiles!issues_author_id_fkey(first_name, last_name))," +
        " comment:comments!moderation_flags_comment_id_fkey(id, body, issue_id, author:profiles!comments_author_id_fkey(first_name, last_name))",
    )
    .is("cleared_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as unknown as FlagRow[])
    .map((row): Flag | null => {
      // A flag whose post has since been deleted cascades away with it, so this
      // only fires in the window where the row is gone and the embed came back
      // null. Dropping it is right: there is nothing left to moderate.
      if (row.comment) {
        return {
          id: row.id,
          score: Number(row.score),
          terms: row.terms ?? [],
          createdAt: row.created_at,
          issueId: row.comment.issue_id,
          commentId: row.comment.id,
          title: "",
          body: row.comment.body,
          authorName: nameOf(row.comment.author),
        };
      }
      if (row.issue) {
        return {
          id: row.id,
          score: Number(row.score),
          terms: row.terms ?? [],
          createdAt: row.created_at,
          issueId: row.issue.id,
          commentId: null,
          title: row.issue.title,
          body: row.issue.body,
          authorName: nameOf(row.issue.author),
        };
      }
      return null;
    })
    .filter((flag): flag is Flag => flag !== null);
}

/** How many are waiting, for the badge in the header. */
export async function countOpenFlags(): Promise<number> {
  const supabase = createClient(await cookies());
  const { count, error } = await supabase
    .from("moderation_flags")
    .select("id", { count: "exact", head: true })
    .is("cleared_at", null);

  return error ? 0 : (count ?? 0);
}

export type StaffAccessEntry = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  elected: boolean;
  active: boolean;
  hasAccount: boolean;
  confirmed: boolean;
  isSelf: boolean;
};

type StaffAccessRow = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  elected: boolean;
  active: boolean;
  has_account: boolean;
  confirmed: boolean;
  is_self: boolean;
};

/**
 * The private administrator authorization list.
 *
 * The table itself has RLS with no policies. `list_staff_access` is the narrow
 * security-definer window onto it and checks the caller's official role before
 * returning even one address, so accidentally calling this on a public page
 * still returns nothing useful.
 */
export async function listStaffAccess(): Promise<StaffAccessEntry[]> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("list_staff_access");

  if (error || !data) {
    if (error) console.error("[moderation] staff access:", error.message);
    return [];
  }

  return (data as StaffAccessRow[]).map((row) => ({
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    elected: row.elected,
    active: row.active,
    hasAccount: row.has_account,
    confirmed: row.confirmed,
    isSelf: row.is_self,
  }));
}
