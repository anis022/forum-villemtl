/**
 * A ballot, which is a thing attached to a topic rather than a thing of its own.
 *
 * There is deliberately no question and no description here. Those are the
 * topic's title and body — see migration 0036 — because a poll that carried its
 * own copy of the wording meant somebody could edit the topic and leave the
 * ballot quoting the old sentence, with the page showing whichever one the
 * query happened to reach first.
 */

export type PollKind = "choice" | "map";

export type PollOption = {
  id: string;
  label: string;
  voteCount: number;
};

export type PollMapResponse = {
  id: string;
  lat: number;
  lon: number;
  description: string;
  imageUrl: string | null;
  createdAt: string;
};

export type Ballot = {
  id: string;
  issueId: string;
  kind: PollKind;
  options: PollOption[];
  totalVoteCount: number;
  mapResponseCount: number;
  /** The option this viewer chose, so the card can mark it. Null when signed out. */
  myOptionId: string | null;
  allowPinDescription: boolean;
  allowPinImage: boolean;
  maxPinsPerMember: number;
};

/** Everything a map ballot needs on the topic's own page, where the map lives. */
export type BallotDetail = Ballot & {
  mapResponses: PollMapResponse[];
  viewerMapResponseCount: number;
};

/**
 * Share of the vote, as a whole number.
 *
 * Zero votes is zero percent rather than a division by zero, and the rounding
 * is left alone: three options on seven votes print 43/29/29 and add to 101,
 * which is what rounding does and is less misleading than quietly adjusting one
 * of them so the column sums the way a reader might expect.
 */
export const sharePercent = (votes: number, total: number): number =>
  total <= 0 ? 0 : Math.round((votes / total) * 100);
