"use client";

import { useOptimistic, useTransition } from "react";
import { toggleVote } from "@/app/actions/issues";
import { getDictionary, type Locale } from "@/utils/i18n";

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
      // self-start: as a flex child it would otherwise stretch to the card height.
      className={`group flex w-14 shrink-0 self-start flex-col items-center gap-1.5 rounded-[4px] border px-2 py-3 transition-colors ${
        state.voted
          ? "border-[#097d6c] bg-[#e6f4f1] text-[#097d6c]"
          : "border-[#ced4da] bg-white text-[#637381] hover:border-[#097d6c] hover:bg-[#f4faf9] hover:text-[#097d6c]"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none">
        <path
          d="M8 3.2l5 5.4H10.3V13H5.7V8.6H3l5-5.4z"
          fill={state.voted ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`text-[17px] font-bold leading-none tabular-nums ${
          state.voted ? "text-[#097d6c]" : "text-[#212529]"
        }`}
      >
        {state.count}
      </span>
    </button>
  );
}
