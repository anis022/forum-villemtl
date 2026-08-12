import { cookies } from "next/headers";
import { createClient } from "./server";

export type ActiveMember = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  contributions: number;
};

/**
 * The people who contributed most during the last 30 days.
 *
 * A contribution is one report, reply or support. The underlying activity is
 * already public on profile pages; this only totals it for a compact sidebar.
 */
export async function listActiveMembers(limit = 4): Promise<ActiveMember[]> {
  const supabase = createClient(await cookies());
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cap = 5000;

  const [issues, comments, votes] = await Promise.all([
    supabase.from("issues").select("author_id").gte("created_at", since).limit(cap),
    supabase.from("comments").select("author_id").gte("created_at", since).limit(cap),
    supabase.from("votes").select("user_id").gte("created_at", since).limit(cap),
  ]);

  const tally = new Map<string, number>();
  for (const row of issues.data ?? []) {
    const id = row.author_id as string;
    tally.set(id, (tally.get(id) ?? 0) + 1);
  }
  for (const row of comments.data ?? []) {
    const id = row.author_id as string;
    tally.set(id, (tally.get(id) ?? 0) + 1);
  }
  for (const row of votes.data ?? []) {
    const id = row.user_id as string;
    tally.set(id, (tally.get(id) ?? 0) + 1);
  }

  const ids = [...tally]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(limit, 1))
    .map(([id]) => id);
  if (ids.length === 0) return [];

  const withAvatar = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", ids);
  let data: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  }[] | null = withAvatar.data;
  if (!data) {
    const fallback = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", ids);
    data = (fallback.data ?? []).map((row) => ({ ...row, avatar_url: null }));
  }

  const profiles = new Map((data ?? []).map((row) => [row.id as string, row]));
  return ids.flatMap((id) => {
    const profile = profiles.get(id);
    if (!profile) return [];
    return [{
      id,
      firstName: (profile.first_name as string) ?? "",
      lastName: (profile.last_name as string) ?? "",
      avatarUrl: (profile.avatar_url as string | null | undefined) ?? null,
      contributions: tally.get(id) ?? 0,
    }];
  });
}
