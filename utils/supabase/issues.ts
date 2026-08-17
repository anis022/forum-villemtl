import { cookies } from "next/headers";
import { createClient } from "./server";
import type {
  Author,
  Category,
  Comment,
  CommentNode,
  Issue,
  Status,
  Supporter,
} from "@/utils/issues";
export type { Comment, CommentNode };

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  elected?: boolean | null;
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

/**
 * The bucket is public, so the URL can be derived without a signing round-trip.
 *
 * A path already starting with `/` is served as-is: the demonstration community
 * (`supabase/demo-seed.sql`) attaches photos shipped in `public/demo/` rather
 * than uploaded ones. They have to live in the repository — nothing signs in as
 * those residents to upload anything, and a seed that depends on a storage
 * bucket having been filled by hand is a seed that only works on one machine.
 */
const imageUrl = (path: string | null) =>
  path === null || path === ""
    ? null
    : path.startsWith("/")
      ? path
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/issue-images/${path}`;

const toAuthor = (profile: ProfileRow): Author => ({
  id: profile?.id ?? "",
  firstName: profile?.first_name ?? "",
  lastName: profile?.last_name ?? "",
  avatarUrl: profile?.avatar_url ?? null,
  isOfficial: profile?.role === "official",
  // `?? false` rather than trusting the column to be there: `elected` arrives
  // with migration 0026 and is selected alongside `role`, so on a database that
  // has not caught up the field is simply absent — the same reason `avatar_url`
  // is handled the way it is below. Absent means "not elected", which is the
  // safe direction for a claim to hold office.
  isElected: profile?.elected ?? false,
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
 * `avatar_url` arrives with migration 0009 and `elected` with 0026. Until those
 * are applied, asking for the column fails the whole query and would empty the
 * feed, so the first failure flips this flag and every later query asks for
 * neither. One wasted round trip on one request, instead of a blank site until
 * someone runs the migration.
 *
 * One flag for both, rather than one each: this is the path that runs on a
 * database nobody has migrated, and losing the avatars along with the badge for
 * the length of that window is not worth a second retry to avoid.
 */
let hasLateProfileColumns = true;
const profileFields = () =>
  hasLateProfileColumns
    ? "id, first_name, last_name, role, elected, avatar_url"
    : "id, first_name, last_name, role";

const missingLateProfileColumn = (message: string | undefined) =>
  Boolean(message && (message.includes("avatar_url") || message.includes("elected")));

/**
 * Same arrangement as `avatar_url` above, for `body_preview` (migration 0013).
 * Until that migration is applied the column does not exist and asking for it
 * would fail the whole query and empty the feed, so the first failure falls
 * back to the full column.
 */
let hasBodyPreview = true;
const missingBodyPreview = (message: string | undefined) =>
  Boolean(message && message.includes("body_preview"));

/** The card clamps to three lines, so the feed never needs more than a preview. */
const feedBodyField = () => (hasBodyPreview ? "body:body_preview" : "body");

const issueSelect = (bodyField: string) =>
  `id, title, ${bodyField}, category, status, vote_count, comment_count, created_at, image_path, lat, lon, edited_at, edited_by, author:profiles!issues_author_id_fkey(${profileFields()})`;

/**
 * How many reports a feed page carries. Fifty was the old hard ceiling — not a
 * page size but the end of the feed, with no way to reach anything past it.
 */
export const FEED_PAGE = 25;

/**
 * PostgREST builds `or=(a.ilike.x,b.ilike.y)` from a comma-separated string, so
 * a comma, a bracket or a quote typed into the search box would be read as
 * filter syntax rather than as text. They carry no meaning in a search here, so
 * they are dropped; `%` and `_` go too, since ilike would treat them as
 * wildcards the person did not ask for.
 */
const forFilter = (query: string) => query.replace(/[,()"\\%_]/g, " ").trim();

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

/**
 * A page of the feed, and whether there is another one behind it.
 *
 * The search runs in the database rather than over the rows already fetched:
 * filtering client-side only ever searched whatever the last query happened to
 * return, so a report that existed but sat below the cut was unfindable — and
 * once the body became a preview there would have been nothing left to match
 * against. One row past the limit is requested purely to answer "is there
 * more" without a second count query.
 */
export async function listIssues(
  sort: "top" | "new" = "top",
  {
    limit = FEED_PAGE,
    search = "",
    categories = [],
  }: { limit?: number; search?: string; categories?: Category[] } = {},
): Promise<{ issues: Issue[]; hasMore: boolean }> {
  const supabase = await getSupabase();
  const term = forFilter(search);

  const run = async () => {
    let query = supabase.from("issues").select(issueSelect(feedBodyField())).limit(limit + 1);
    if (term) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
    if (categories.length === 1) query = query.eq("category", categories[0]);
    else if (categories.length > 1) query = query.in("category", categories);
    return sort === "top"
      ? query.order("vote_count", { ascending: false }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });
  };

  let { data, error } = await run();
  if (error && missingBodyPreview(error.message)) {
    hasBodyPreview = false;
    ({ data, error } = await run());
  }
  if (error && missingLateProfileColumn(error.message)) {
    hasLateProfileColumns = false;
    ({ data, error } = await run());
  }
  if (error || !data) return { issues: [], hasMore: false };

  const all = data as unknown as IssueRow[];
  const hasMore = all.length > limit;
  const rows = hasMore ? all.slice(0, limit) : all;

  const ids = rows.map((r) => r.id);
  const [voted, supporters] = await Promise.all([
    votedIssueIds(supabase, ids),
    supportersByIssue(supabase, ids),
  ]);
  return { issues: rows.map((row) => toIssue(row, voted, supporters)), hasMore };
}

/**
 * A sanity ceiling on the tally below — not a page size. Which handful of
 * categories comes up most is settled long before a borough forum has this many
 * reports, so reading further would change the chips in the hero not at all.
 */
const TALLY_CAP = 5000;

/**
 * How many reports carry each category, busiest first — what the chips under
 * the hero are built from.
 *
 * One request for one short column, tallied here. PostgREST has no GROUP BY,
 * and the alternative is a separate count request per category on every visit
 * to the forum.
 */
export async function categoryCounts(): Promise<{ category: Category; count: number }[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("issues").select("category").limit(TALLY_CAP);
  if (error || !data) return [];

  const tally = new Map<Category, number>();
  for (const { category } of data as { category: Category }[]) {
    tally.set(category, (tally.get(category) ?? 0) + 1);
  }

  return [...tally]
    .map(([category, count]) => ({ category, count }))
    // Ties break on the key rather than on whatever order the rows arrived in,
    // so the chips don't reshuffle between two identical page loads.
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export async function getIssue(id: string): Promise<Issue | null> {
  const supabase = await getSupabase();

  // The whole body here: this is the page the report is actually read on.
  const run = () => supabase.from("issues").select(issueSelect("body")).eq("id", id).maybeSingle();

  let { data, error } = await run();
  if (error && missingLateProfileColumn(error.message)) {
    hasLateProfileColumns = false;
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

/** How many replies a thread shows before offering the rest. */
export const REPLIES_PAGE = 50;

/**
 * Threading arrives with migration 0014 and comment editing with 0015. Same
 * arrangement as `avatar_url` above: until they are applied these columns do
 * not exist, and asking for them would fail the whole query and empty every
 * thread on the site. One flag for both — the two migrations ship together, and
 * a page that can thread but cannot say a comment was edited is worse than one
 * that does neither.
 */
let hasThreads = true;
const THREAD_COLUMNS = ["parent_id", "depth", "edited_at", "edited_by"];
const missingThreads = (message: string | undefined) =>
  Boolean(message && THREAD_COLUMNS.some((column) => message.includes(column)));

type CommentRow = {
  id: string;
  body: string;
  is_official: boolean;
  created_at: string;
  parent_id?: string | null;
  depth?: number | null;
  edited_at?: string | null;
  edited_by?: string | null;
  author: ProfileRow;
};

/**
 * Officials first, then oldest first. Applied within one set of siblings rather
 * than across the whole thread: floating an official answer over the entire
 * conversation would tear it out of the exchange it belongs to, while floating
 * it over the replies it shares a parent with is just putting the answer above
 * the follow-up questions.
 */
const inReadingOrder = (a: CommentNode, b: CommentNode) =>
  Number(b.isOfficial) - Number(a.isOfficial) || a.createdAt.localeCompare(b.createdAt);

/**
 * A page of replies, threaded, and whether more remain.
 *
 * This used to fetch every reply on the thread. A report that gets picked up —
 * exactly the one worth reading — would then put hundreds of replies, each with
 * an avatar, into the server-rendered HTML of every single visit to it. The
 * thread that succeeds is the one that would have broken.
 *
 * The page is taken in strict chronological order, which is what makes paging a
 * tree work at all: a reply is always younger than what it answers, so any
 * prefix of that list already contains every parent it refers to and never
 * leaves a reply hanging off a comment that was not fetched.
 */
export async function listComments(
  issueId: string,
  limit = REPLIES_PAGE,
): Promise<{ comments: CommentNode[]; hasMore: boolean; threaded: boolean }> {
  const supabase = await getSupabase();

  const run = () =>
    supabase
      .from("comments")
      .select(
        `id, body, is_official, created_at${hasThreads ? ", parent_id, depth, edited_at, edited_by" : ""}, author:profiles!comments_author_id_fkey(${profileFields()})`,
      )
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true })
      .limit(limit + 1);

  let { data, error } = await run();
  if (error && missingThreads(error.message)) {
    hasThreads = false;
    ({ data, error } = await run());
  }
  if (error && missingLateProfileColumn(error.message)) {
    hasLateProfileColumns = false;
    ({ data, error } = await run());
  }
  if (error || !data) return { comments: [], hasMore: false, threaded: hasThreads };

  const all = data as unknown as CommentRow[];
  const hasMore = all.length > limit;

  const nodes = new Map<string, CommentNode>();
  for (const row of hasMore ? all.slice(0, limit) : all) {
    nodes.set(row.id, {
      id: row.id,
      body: row.body,
      isOfficial: row.is_official,
      createdAt: row.created_at,
      author: toAuthor(row.author),
      parentId: row.parent_id ?? null,
      depth: row.depth ?? 0,
      editedAt: row.edited_at ?? null,
      editedById: row.edited_by ?? null,
      replies: [],
    });
  }

  const roots: CommentNode[] = [];
  for (const node of nodes.values()) {
    // `?? roots`: a parent outside the page cannot happen for a chronological
    // prefix, but a reply that ends up with nowhere to go belongs on screen at
    // the top rather than dropped on the floor.
    const siblings = node.parentId ? nodes.get(node.parentId)?.replies ?? roots : roots;
    siblings.push(node);
  }

  for (const node of nodes.values()) node.replies.sort(inReadingOrder);
  roots.sort(inReadingOrder);

  return { comments: roots, hasMore, threaded: hasThreads };
}
