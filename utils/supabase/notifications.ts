import { cookies } from "next/headers";
import { createClient } from "./server";
import type { Category } from "@/utils/issues";

/**
 * Reading the notification centre.
 *
 * Every function here goes through the signed-in browser's own client, so RLS
 * decides what comes back and this file never has to. A resident calling any of
 * it gets an empty list and a zero, which is the correct answer rather than a
 * refusal: they have no notifications, because nothing on this site sends them
 * one yet.
 */

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

/** PostgREST returns an embedded one-to-one as an object or a one-element array. */
const one = <T,>(value: T | T[] | null): T | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * The badge in the masthead.
 *
 * Counted through an RPC rather than a `head: true` count so the whole thing is
 * one statement Postgres answers from the partial index on unread rows, on a
 * query that runs for every member of staff on every page they load.
 */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("unread_notification_count");
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

/**
 * The centre itself, newest first.
 *
 * The topic is embedded rather than fetched per row: this is a page of fifty
 * notices, and fifty round trips to render a list is the sort of thing that
 * only shows up on the week the borough has a bad news cycle.
 */
export async function listNotifications(limit = 50): Promise<Notice[]> {
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
      // A notice whose topic is gone cascades away with it, so this only fires
      // inside the moment between the delete and the embed coming back null.
      // Dropping it is right: there is nothing left to open.
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
          // Empty once the author closes their account, which is what tells the
          // card not to link a name to a profile that is no longer there.
          id: actor?.id ?? null,
          firstName: actor?.first_name ?? "",
          lastName: actor?.last_name ?? "",
          avatarUrl: actor?.avatar_url ?? null,
        },
      };
    })
    .filter((notice): notice is Notice => notice !== null);
}
