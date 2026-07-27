import { cookies } from "next/headers";
import { createClient } from "./server";
import type { Author, Category, Comment, Issue, Status } from "@/utils/issues";
export type { Comment };

type ProfileRow = { first_name: string; last_name: string; role: string } | null;

type IssueRow = {
  id: string;
  title: string;
  body: string;
  category: Category;
  status: Status;
  vote_count: number;
  comment_count: number;
  created_at: string;
  image_path: string | null;
  author: ProfileRow;
};

// The bucket is public, so the URL can be derived without a signing round-trip.
const imageUrl = (path: string | null) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/issue-images/${path}`
    : null;

const toAuthor = (profile: ProfileRow): Author => ({
  firstName: profile?.first_name ?? "",
  lastName: profile?.last_name ?? "",
  isOfficial: profile?.role === "official",
});

const toIssue = (row: IssueRow, votedIds: Set<string>): Issue => ({
  id: row.id,
  title: row.title,
  body: row.body,
  category: row.category,
  status: row.status,
  voteCount: row.vote_count,
  commentCount: row.comment_count,
  createdAt: row.created_at,
  author: toAuthor(row.author),
  hasVoted: votedIds.has(row.id),
  imageUrl: imageUrl(row.image_path),
});

const ISSUE_SELECT =
  "id, title, body, category, status, vote_count, comment_count, created_at, image_path, author:profiles!issues_author_id_fkey(first_name, last_name, role)";

/**
 * Which of the given issues the signed-in user has already upvoted. Fetched in
 * one query rather than per-issue so the list stays a fixed two round-trips.
 */
async function votedIssueIds(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  issueIds: string[],
): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || issueIds.length === 0) return new Set();

  const { data } = await supabase
    .from("votes")
    .select("issue_id")
    .eq("user_id", user.id)
    .in("issue_id", issueIds);

  return new Set((data ?? []).map((row) => row.issue_id as string));
}

async function getSupabase() {
  return createClient(await cookies());
}

export async function listIssues(sort: "top" | "new" = "top"): Promise<Issue[]> {
  const supabase = await getSupabase();

  const query = supabase.from("issues").select(ISSUE_SELECT).limit(50);
  const { data, error } =
    sort === "top"
      ? await query.order("vote_count", { ascending: false }).order("created_at", { ascending: false })
      : await query.order("created_at", { ascending: false });

  if (error || !data) return [];

  const rows = data as unknown as IssueRow[];
  const voted = await votedIssueIds(supabase, rows.map((r) => r.id));
  return rows.map((row) => toIssue(row, voted));
}

export async function getIssue(id: string): Promise<Issue | null> {
  const supabase = await getSupabase();

  const { data, error } = await supabase.from("issues").select(ISSUE_SELECT).eq("id", id).maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as IssueRow;
  const voted = await votedIssueIds(supabase, [row.id]);
  return toIssue(row, voted);
}

export async function listComments(issueId: string): Promise<Comment[]> {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, body, is_official, created_at, author:profiles!comments_author_id_fkey(first_name, last_name, role)",
    )
    .eq("issue_id", issueId)
    // Official replies float to the top; everything else is chronological.
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as { id: string; body: string; is_official: boolean; created_at: string; author: ProfileRow }[]).map(
    (row) => ({
      id: row.id,
      body: row.body,
      isOfficial: row.is_official,
      createdAt: row.created_at,
      author: toAuthor(row.author),
    }),
  );
}
