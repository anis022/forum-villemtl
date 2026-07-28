import { cookies } from "next/headers";
import { createClient } from "./server";

export type PublicProfile = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isOfficial: boolean;
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
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, role, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    firstName: (data.first_name as string) ?? "",
    lastName: (data.last_name as string) ?? "",
    avatarUrl: (data.avatar_url as string | null) ?? null,
    isOfficial: data.role === "official",
    joinedAt: data.created_at as string,
  };
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
