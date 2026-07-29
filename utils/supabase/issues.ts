import { cookies } from "next/headers";
import { createClient } from "./server";
import type { Author, Category, Comment, Issue, Status, Supporter } from "@/utils/issues";
export type { Comment };

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  avatar_url: string | null;
} | null;

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
  lat: number | null;
  lon: number | null;
  edited_at: string | null;
  edited_by: string | null;
  author: ProfileRow;
};

// The bucket is public, so the URL can be derived without a signing round-trip.
const imageUrl = (path: string | null) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/issue-images/${path}`
    : null;

const toAuthor = (profile: ProfileRow): Author => ({
  id: profile?.id ?? "",
  firstName: profile?.first_name ?? "",
  lastName: profile?.last_name ?? "",
  avatarUrl: profile?.avatar_url ?? null,
  isOfficial: profile?.role === "official",
});

const toIssue = (
  row: IssueRow,
  votedIds: Set<string>,
  supporters: Map<string, Supporter[]>,
): Issue => ({
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
  supporters: supporters.get(row.id) ?? [],
  lat: row.lat === null ? null : Number(row.lat),
  lon: row.lon === null ? null : Number(row.lon),
  editedAt: row.edited_at,
  editedById: row.edited_by,
});

/**
 * `avatar_url` arrives with migration 0009. Until it is applied, asking for it
 * fails the whole query and would empty the feed, so the first failure flips
 * this flag and every later query omits the column. One wasted round trip on
 * one request, instead of a blank site until someone runs the migration.
 */
let hasAvatarColumn = true;
const profileFields = () =>
  hasAvatarColumn ? "id, first_name, last_name, role, avatar_url" : "id, first_name, last_name, role";

const missingAvatar = (message: string | undefined) =>
  Boolean(message && message.includes("avatar_url"));

const issueSelect = () =>
  `id, title, body, category, status, vote_count, comment_count, created_at, image_path, lat, lon, edited_at, edited_by, author:profiles!issues_author_id_fkey(${profileFields()})`;

/**
 * A few backers per issue, for the face pile — fetched for the whole page in
 * one call. Per-card queries would turn a list render into fifty round trips.
 */
async function supportersByIssue(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  issueIds: string[],
): Promise<Map<string, Supporter[]>> {
  const grouped = new Map<string, Supporter[]>();
  if (!issueIds.length) return grouped;

  const { data, error } = await supabase.rpc("issue_supporters", {
    p_issue_ids: issueIds,
    p_per_issue: 5,
  });
  if (error || !data) return grouped;

  for (const row of data as {
    issue_id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  }[]) {
    const list = grouped.get(row.issue_id) ?? [];
    list.push({
      id: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      avatarUrl: row.avatar_url,
    });
    grouped.set(row.issue_id, list);
  }
  return grouped;
}

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

  const run = async () => {
    const query = supabase.from("issues").select(issueSelect()).limit(50);
    return sort === "top"
      ? query.order("vote_count", { ascending: false }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });
  };

  let { data, error } = await run();
  if (error && missingAvatar(error.message)) {
    hasAvatarColumn = false;
    ({ data, error } = await run());
  }
  if (error || !data) return [];

  const rows = data as unknown as IssueRow[];
  const ids = rows.map((r) => r.id);
  const [voted, supporters] = await Promise.all([
    votedIssueIds(supabase, ids),
    supportersByIssue(supabase, ids),
  ]);
  return rows.map((row) => toIssue(row, voted, supporters));
}

export async function getIssue(id: string): Promise<Issue | null> {
  const supabase = await getSupabase();

  const run = () => supabase.from("issues").select(issueSelect()).eq("id", id).maybeSingle();

  let { data, error } = await run();
  if (error && missingAvatar(error.message)) {
    hasAvatarColumn = false;
    ({ data, error } = await run());
  }
  if (error || !data) return null;

  const row = data as unknown as IssueRow;
  const [voted, supporters] = await Promise.all([
    votedIssueIds(supabase, [row.id]),
    supportersByIssue(supabase, [row.id]),
  ]);
  return toIssue(row, voted, supporters);
}

export async function listComments(issueId: string): Promise<Comment[]> {
  const supabase = await getSupabase();

  const run = () =>
    supabase
      .from("comments")
      .select(
        `id, body, is_official, created_at, author:profiles!comments_author_id_fkey(${profileFields()})`,
      )
      .eq("issue_id", issueId)
      // Official replies float to the top; everything else is chronological.
      .order("is_official", { ascending: false })
      .order("created_at", { ascending: true });

  let { data, error } = await run();
  if (error && missingAvatar(error.message)) {
    hasAvatarColumn = false;
    ({ data, error } = await run());
  }
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
