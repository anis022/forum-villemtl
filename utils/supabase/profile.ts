import { cookies } from "next/headers";
import { createClient } from "./server";
import { DEFAULT_BOROUGH_SLUG, isBoroughSlug, type BoroughSlug } from "@/utils/boroughs";

export type PublicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isOfficial: boolean;
  /** Holds a seat on the borough council — see `Author.isElected`. */
  isElected: boolean;
  joinedAt: string;
};

/** One thing a person did, newest first — the Facebook-style activity stream. */
export type ActivityItem = {
  kind: "issue" | "comment" | "vote";
  issueId: string;
  issueTitle: string;
  body: string | null;
  happenedAt: string;
};

export type ProfileCounts = { issues: number; comments: number; votes: number };

async function sb() {
  return createClient(await cookies());
}

export async function getProfile(id: string): Promise<PublicProfile | null> {
  const supabase = await sb();

  // `avatar_url` arrives with migration 0009. Asking for a column that does not
  // exist fails the query, and the page would read that as "no such person" and
  // return a 404 — so fall back to the fields that have always been there.
  let { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, role, elected, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    ({ data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role, created_at")
      .eq("id", id)
      .maybeSingle());
  }

  if (!data) return null;
  return {
    id: data.id as string,
    firstName: (data.first_name as string) ?? "",
    lastName: (data.last_name as string) ?? "",
    avatarUrl: (data.avatar_url as string | null) ?? null,
    isOfficial: data.role === "official",
    // Absent on the fallback select above, and on a database that has not run
    // migration 0026 — both mean "cannot be shown as elected", which is the
    // direction a claim to hold office should fail in.
    isElected: (data as { elected?: boolean | null }).elected === true,
    joinedAt: data.created_at as string,
  };
}

/**
 * The borough a person chose, asked for on its own rather than folded into
 * `getProfile`.
 *
 * Separate because it is read in one place, by the account panel on your own
 * profile, and because a column added in migration 0024 must not be able to
 * take the profile page down on a deployment where that migration has not run
 * yet. Anything unexpected reads as the default, which is what a resident who
 * has never chosen already has.
 */
export async function getBoroughOf(id: string): Promise<BoroughSlug> {
  const supabase = await sb();
  const { data } = await supabase
    .from("profiles")
    .select("borough")
    .eq("id", id)
    .maybeSingle();

  const chosen = data?.borough;
  return typeof chosen === "string" && isBoroughSlug(chosen) ? chosen : DEFAULT_BOROUGH_SLUG;
}

/**
 * Everything the person has opened, answered or backed, as one ordered stream.
 *
 * Three tables merged server-side rather than three fetches and a client-side
 * sort, so pagination stays possible later without reshaping the page.
 */
export async function getActivity(id: string, limit = 40): Promise<ActivityItem[]> {
  const supabase = await sb();
  const { data, error } = await supabase.rpc("profile_activity", {
    p_user_id: id,
    p_limit: limit,
  });
  if (error || !data) {
    if (error) console.error("[profile] profile_activity:", error.message);
    return [];
  }

  return (data as {
    kind: ActivityItem["kind"];
    issue_id: string;
    issue_title: string;
    body: string | null;
    happened_at: string;
  }[]).map((r) => ({
    kind: r.kind,
    issueId: r.issue_id,
    issueTitle: r.issue_title,
    body: r.body,
    happenedAt: r.happened_at,
  }));
}

/** Totals for the header, counted rather than derived from the capped stream. */
export async function getCounts(id: string): Promise<ProfileCounts> {
  const supabase = await sb();
  const [issues, comments, votes] = await Promise.all([
    supabase.from("issues").select("id", { count: "exact", head: true }).eq("author_id", id),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("author_id", id),
    supabase.from("votes").select("issue_id", { count: "exact", head: true }).eq("user_id", id),
  ]);
  return {
    issues: issues.count ?? 0,
    comments: comments.count ?? 0,
    votes: votes.count ?? 0,
  };
}
