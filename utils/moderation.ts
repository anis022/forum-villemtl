// Client-safe types for the matcher, which lives in Postgres.
//
// There is no scoring here on purpose. `public.moderation_score` (migration
// 0020) is the only implementation, because the server actions are not the only
// way a row gets inserted — every write on this site goes through PostgREST with
// the poster's own token, and a check that only runs in `app/actions` is a check
// anybody can skip with one fetch call. A trigger runs whichever door you came
// through.
//
// The thresholds are not mirrored here either. Two copies of a number is one
// number and one bug waiting for somebody to tune the other.

/** What the matcher decided. `clear` is silent; the poster never sees any of this. */
export type Verdict = "clear" | "flag" | "block";

export type Score = {
  score: number;
  verdict: Verdict;
  /** The words that produced it. Officials only — see migration 0020. */
  terms: string[];
};

/**
 * The exception `moderate_new_post` raises when it refuses an insert.
 *
 * A stable token rather than a sentence: the trigger has no idea which language
 * the page is being read in, so the wording belongs to the dictionary and this
 * is only how the two recognise each other.
 */
export const BLOCKED_MESSAGE = "moderation_blocked";

/** True when a Supabase error is the trigger refusing the message. */
export function isBlocked(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes(BLOCKED_MESSAGE));
}

/** One flagged post, as the queue shows it. */
export type Flag = {
  id: string;
  score: number;
  terms: string[];
  createdAt: string;
  /** Where to go and read it in context. */
  issueId: string;
  /** Null when the report itself is what was flagged. */
  commentId: string | null;
  title: string;
  body: string;
  authorName: string | null;
};
