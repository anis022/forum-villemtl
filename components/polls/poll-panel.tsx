"use client";

import { PollBallot } from "./poll-ballot";
import { PollMap } from "./poll-map";
import type { BallotDetail } from "@/utils/polls";
import { getDictionary, type Locale } from "@/utils/i18n";
import { MUTED } from "@/components/ui/styles";

/**
 * The ballot on the topic's own page, where it can also be rewritten.
 *
 * The feed shows the same ballot through `PollBallot`; what this adds is the
 * map, for the kind of poll that collects places, and the form that takes an
 * answer on it.
 *
 * Editing the choices is not here. It belongs to the topic's own edit control,
 * which saves the title, the body, the category and the ballot in one
 * submission — two buttons meant two saves and no way to express "rename that
 * choice and fix the typo in the title" as the single act it is.
 *
 * Deleting a poll is deleting the topic, which the topic's menu already does
 * and already confirms.
 */
export function PollPanel({
  ballot,
  canVote,
  lang,
}: {
  ballot: BallotDetail;
  canVote: boolean;
  lang: Locale;
}) {
  const t = getDictionary(lang);

  if (ballot.kind === "map") {
    return (
      <div className="flex flex-col gap-4">
        <PollMap
          responses={ballot.mapResponses}
          lang={lang}
          labels={{
            mapLabel: t.poll.mapContributionsTitle,
            contribution: t.poll.contributionLabel,
            noDetails: t.poll.noPinDetails,
          }}
        />
        <p className={`text-[14px] ${MUTED}`}>
          {t.poll.mapResponses(ballot.mapResponseCount)}
        </p>
      </div>
    );
  }

  return <PollBallot ballot={ballot} canVote={canVote} lang={lang} />;
}
