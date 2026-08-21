"use client";

import { useActionState } from "react";
import { votePoll, type PollActionState } from "@/app/actions/polls";
import { sharePercent, type Ballot } from "@/utils/polls";
import { getDictionary, type Locale } from "@/utils/i18n";
import { PollMap } from "./poll-map";
import { MUTED } from "@/components/ui/styles";

const initial: PollActionState = { error: null };

/**
 * The ballot, inside the topic it belongs to.
 *
 * It used to be a card of its own in a band of its own, in a purple nothing
 * else on the site uses, linking away to a page where the voting happened. Two
 * problems with that, and the colour was the smaller one: a reader had to leave
 * the feed to answer a question that fits in four lines, and everything the
 * forum already does — replying, supporting, reporting — stayed behind on the
 * topic they had just left.
 *
 * So it renders where the topic renders and it dresses like the topic: the
 * forum's rose for the choice this reader made, `#faf1e8` for the fill, the
 * same hairline `#f2ece4` the card uses between its own sections. Nothing here
 * introduces a colour, a radius or a weight the feed did not already have.
 *
 * One tap is one vote. Each choice is its own submit button rather than a radio
 * plus a confirm — the second step buys nothing when the answer is a single
 * choice that can be changed afterwards by tapping another one.
 */
export function PollBallot({
  ballot,
  canVote,
  lang,
  compact = false,
}: {
  ballot: Ballot;
  /** A signed-in member. Everyone else reads the result. */
  canVote: boolean;
  lang: Locale;
  /** In the feed, where the ballot shares a card with the topic. */
  compact?: boolean;
}) {
  const t = getDictionary(lang);
  const action = votePoll.bind(null, ballot.id, ballot.issueId);
  const [state, formAction, pending] = useActionState(action, initial);

  // Results are shown once this reader has answered, and to anyone who cannot.
  // Before that the bars are hidden: a percentage beside every choice while
  // somebody is still deciding is a nudge, not information.
  const answered = ballot.myOptionId !== null;
  const showShare = answered || !canVote;

  if (ballot.kind === "map") {
    return (
      <div className="flex flex-col gap-2">
        <PollMap
          responses={ballot.mapResponses ?? []}
          lang={lang}
          height={compact ? "h-[240px] sm:h-[300px]" : "h-[360px] md:h-[480px]"}
          labels={{
            mapLabel: t.poll.mapContributionsTitle,
            contribution: t.poll.contributionLabel,
            empty: t.poll.mapEmpty,
            noDetails: t.poll.noPinDetails,
          }}
        />
        <p className={`text-[13px] leading-[18px] ${MUTED}`}>
          {t.poll.mapResponses(ballot.mapResponseCount)}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <input type="hidden" name="locale" value={lang} />

      {ballot.options.map((option) => {
        const mine = ballot.myOptionId === option.id;
        const share = sharePercent(option.voteCount, ballot.totalVoteCount);

        return (
          <button
            key={option.id}
            type="submit"
            name="optionId"
            value={option.id}
            disabled={!canVote || pending}
            aria-pressed={mine}
            className={`relative flex w-full items-center gap-3 overflow-hidden rounded-[12px] border px-3.5 text-left transition-colors ${
              compact ? "min-h-[42px] py-2" : "min-h-[48px] py-2.5"
            } ${
              mine
                ? "border-[#a3162c] bg-[#f6e7ea]"
                : `border-[#e9e0d6] bg-white ${canVote ? "hover:border-[#a3162c] hover:bg-[#faf1e8]" : ""}`
            } ${canVote ? "cursor-pointer" : "cursor-default"}`}
          >
            {/* The bar sits behind the words rather than beside them, so a long
                choice keeps the full width of the card to wrap in. */}
            {showShare && (
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${
                  mine ? "bg-[#fbd5dc]" : "bg-[#f4ece3]"
                }`}
                style={{ width: `${share}%` }}
              />
            )}

            <span
              aria-hidden="true"
              className={`relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                mine ? "border-[#a3162c] bg-[#a3162c]" : "border-[#cfc6bd] bg-white"
              }`}
            >
              {mine && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m5 13 4 4L19 7"
                    stroke="#fff"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>

            <span
              className={`relative min-w-0 flex-1 break-words text-[15px] leading-[21px] ${
                mine ? "font-bold" : "font-semibold"
              }`}
            >
              {option.label}
            </span>

            {showShare && (
              <span className="relative shrink-0 text-[14px] font-bold tabular-nums">
                {share}%
              </span>
            )}
          </button>
        );
      })}

      <p className={`text-[13px] leading-[18px] ${MUTED}`}>
        {t.poll.votes(ballot.totalVoteCount)}
        {!canVote && ` · ${t.poll.membersOnly}`}
      </p>

      {state.error && (
        <p className="text-[13px] font-semibold text-[#a3162c]">{t.errors[state.error]}</p>
      )}
    </form>
  );
}
