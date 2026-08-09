"use client";

import { useOptimistic, useTransition } from "react";
import { toggleVote } from "@/app/actions/issues";
import { getDictionary, type Locale } from "@/utils/i18n";

/**
 * Backing an issue, as a horizontal pill: arrow, then the number.
 *
 * A vertical stack reads as a scoreboard bolted to the side of a post. Set
 * side by side it reads as one action with its tally, which is what it is —
 * and it sits naturally in a row of actions next to comment and share.
 *
 * Backed state uses the rosette red rather than the site teal: supporting a
 * neighbour should feel warm, and it separates "I did this" from every other
 * teal control on the page.
 */
export function VoteButton({
  issueId,
  voteCount,
  hasVoted,
  canVote,
  lang,
  onRequireAuth,
}: {
  issueId: string;
  voteCount: number;
  hasVoted: boolean;
  canVote: boolean;
  lang: Locale;
  onRequireAuth?: () => void;
}) {
  const [, startTransition] = useTransition();
  const t = getDictionary(lang);

  // Optimistic so the count moves on click instead of after the round-trip.
  const [state, setState] = useOptimistic(
    { count: voteCount, voted: hasVoted },
    (_prev, next: { count: number; voted: boolean }) => next,
  );

  const click = () => {
    if (!canVote) {
      onRequireAuth?.();
      return;
    }
    startTransition(async () => {
      setState({
        count: state.voted ? state.count - 1 : state.count + 1,
        voted: !state.voted,
      });
      await toggleVote(issueId, lang);
    });
  };

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={state.voted}
      aria-label={state.voted ? t.vote.remove : t.vote.add}
      title={canVote ? undefined : t.vote.signInFirst}
      className={`group inline-flex shrink-0 items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[14px] font-bold leading-[20px] transition-all active:scale-[0.97] ${
        state.voted
          ? "border-[#d94f45] bg-[#fdeceb] text-[#c0392f]"
          : "border-[#dde5e1] bg-white text-[#5d6b66] hover:border-[#d94f45] hover:bg-[#fdeceb] hover:text-[#c0392f]"
      }`}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        // A nudge upward on hover: the control previews its own direction.
        className="shrink-0 transition-transform group-hover:-translate-y-0.5"
      >
        <path
          d="M12 4.5l7.2 7.6h-4.1V19H8.9v-6.9H4.8L12 4.5z"
          fill={state.voted ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span className="tabular-nums">{state.count}</span>
    </button>
  );
}
