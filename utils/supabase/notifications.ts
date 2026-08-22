import { cookies } from "next/headers";
import { createClient } from "./server";
import type { Category } from "@/utils/issues";

export type Notice = {
  id: string;
  createdAt: string;
  read: boolean;
  issueId: string;
  title: string;
  category: Category;
  actor: {
    id: string | null;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
} | null;

type NoticeRow = {
  id: string;
  created_at: string;
  read_at: string | null;
  issue_id: string;
  issue: { id: string; title: string; category: string } | null;
  actor: ProfileRow | ProfileRow[];
};

const DEFAULT_LIMIT = 50;

const one = <T,>(value: T | T[] | null): T | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

export async function countUnreadNotifications(): Promise<number> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("unread_notification_count");
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export async function listNotifications(limit = DEFAULT_LIMIT): Promise<Notice[]> {
  const supabase = createClient(await cookies());

  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, created_at, read_at, issue_id," +
        " issue:issues!notifications_issue_id_fkey(id, title, category)," +
        " actor:profiles!notifications_actor_id_fkey(id, first_name, last_name, avatar_url)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as unknown as NoticeRow[])
    .map((row): Notice | null => {
      if (!row.issue) return null;

      const actor = one(row.actor);
      return {
        id: row.id,
        createdAt: row.created_at,
        read: row.read_at !== null,
        issueId: row.issue.id,
        title: row.issue.title,
        category: row.issue.category as Category,
        actor: {
          id: actor?.id ?? null,
          firstName: actor?.first_name ?? "",
          lastName: actor?.last_name ?? "",
          avatarUrl: actor?.avatar_url ?? null,
        },
      };
    })
    .filter((notice): notice is Notice => notice !== null);
}
