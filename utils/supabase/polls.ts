import { cookies } from "next/headers";
import { createClient } from "./server";
import type { Ballot, BallotDetail, PollKind, PollMapResponse } from "@/utils/polls";

/**
 * Ballots, read by the topic they belong to.
 *
 * There is no `listPolls` any more. Polls used to be their own feed, their own
 * page and their own band on the home screen; they are topics now, so the feed
 * that lists them is the forum's, and all this has to do is say which of the
 * topics on a page happen to carry a ballot.
 */

type BallotRow = {
  poll_id: string;
  issue_id: string;
  kind: PollKind;
  total_vote_count: number;
  map_response_count: number;
  allow_pin_description: boolean;
  allow_pin_image: boolean;
  max_pins_per_member: number;
  my_option_id: string | null;
  options: { id: string; label: string; voteCount: number }[];
  map_responses: PollMapResponseRow[];
};

type PollMapResponseRow = {
  id: string;
  lat: number;
  lon: number;
  description: string;
  image_path: string | null;
  created_at: string;
};

const pinImageUrl = (path: string | null) =>
  path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/poll-pin-images/${path}`
    : null;

const toMapResponse = (row: PollMapResponseRow): PollMapResponse => ({
  id: row.id,
  lat: Number(row.lat),
  lon: Number(row.lon),
  description: row.description,
  imageUrl: pinImageUrl(row.image_path),
  createdAt: row.created_at,
});

const toBallot = (row: BallotRow): Ballot => ({
  id: row.poll_id,
  issueId: row.issue_id,
  kind: row.kind,
  options: row.options ?? [],
  totalVoteCount: row.total_vote_count,
  mapResponseCount: row.map_response_count,
  myOptionId: row.my_option_id,
  allowPinDescription: row.allow_pin_description,
  allowPinImage: row.allow_pin_image,
  maxPinsPerMember: row.max_pins_per_member,
  mapResponses: (row.map_responses ?? []).map(toMapResponse),
});

async function getSupabase() {
  return createClient(await cookies());
}

/**
 * The ballots among a page of topics, keyed by topic.
 *
 * One round trip for the whole page rather than one per card, and nothing at
 * all when the page holds no polls — which is the common case, so the feed
 * should not pay for the feature on every render.
 */
export async function ballotsForIssues(
  issueIds: string[],
): Promise<Map<string, Ballot>> {
  const found = new Map<string, Ballot>();
  if (issueIds.length === 0) return found;

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("polls_for_issues", {
    p_issue_ids: issueIds,
  });

  if (error || !data) {
    if (error) console.error("[polls] polls_for_issues:", error.message);
    return found;
  }
  for (const row of data as BallotRow[]) found.set(row.issue_id, toBallot(row));
  return found;
}

/** One topic's ballot, with the map answers a map ballot has collected. */
export async function ballotForIssue(issueId: string): Promise<BallotDetail | null> {
  const ballots = await ballotsForIssues([issueId]);
  const ballot = ballots.get(issueId);
  if (!ballot) return null;

  if (ballot.kind !== "map") return { ...ballot, viewerMapResponseCount: 0 };

  // The pins already came back with the ballot. The only thing left to ask is
  // how many this viewer has left, which decides whether they are offered the
  // form, and which nobody else may see.
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...ballot, viewerMapResponseCount: 0 };

  const mine = await supabase
    .from("poll_map_responses")
    .select("id", { count: "exact", head: true })
    .eq("poll_id", ballot.id)
    .eq("user_id", user.id);

  return { ...ballot, viewerMapResponseCount: mine.count ?? 0 };
}
