"use client";

import { useActionState, useState } from "react";
import { PollBallot } from "./poll-ballot";
import { PollMap } from "./poll-map";
import { MapResponseForm } from "./map-response-form";
import { savePollOptions, type PollActionState } from "@/app/actions/polls";
import type { BallotDetail } from "@/utils/polls";
import { getDictionary, type Locale } from "@/utils/i18n";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD, MUTED } from "@/components/ui/styles";

const initial: PollActionState = { error: null };

/**
 * The ballot on the topic's own page, where it can also be rewritten.
 *
 * The feed shows the same ballot through `PollBallot`; what this adds is the
 * map, for the kind of poll that collects places, and the way in to changing
 * the choices. Editing is offered to whoever may edit the topic — its author
 * while they are still a member, or the borough office — which is the same rule
 * the database enforces in `may_edit_issue`, not a second one invented here.
 *
 * Deleting a poll is deleting the topic, so there is no control for it here.
 * The topic's own menu already does that, it already asks first, and a second
 * delete button that removed the ballot but left a topic asking a question with
 * nothing under it would be a worse outcome than either.
 */
export function PollPanel({
  ballot,
  canVote,
  canEdit,
  lang,
}: {
  ballot: BallotDetail;
  canVote: boolean;
  canEdit: boolean;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const [editing, setEditing] = useState(false);

  if (ballot.kind === "map") {
    return (
      <div className="flex flex-col gap-4">
        <PollMap
          responses={ballot.mapResponses}
          lang={lang}
          labels={{
            mapLabel: t.poll.mapContributionsTitle,
            contribution: t.poll.contributionLabel,
            empty: t.poll.mapEmpty,
            noDetails: t.poll.noPinDetails,
          }}
        />
        <p className={`text-[14px] ${MUTED}`}>
          {t.poll.mapResponses(ballot.mapResponseCount)}
        </p>
        {canVote && ballot.viewerMapResponseCount < ballot.maxPinsPerMember && (
          <MapResponseForm
            pollId={ballot.id}
            issueId={ballot.issueId}
            allowDescription={ballot.allowPinDescription}
            allowImage={ballot.allowPinImage}
            lang={lang}
          />
        )}
      </div>
    );
  }

  if (editing) {
    return (
      <OptionEditor
        ballot={ballot}
        lang={lang}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PollBallot ballot={ballot} canVote={canVote} lang={lang} />
      {canEdit && (
        <div>
          <button type="button" className={BTN_SECONDARY} onClick={() => setEditing(true)}>
            {t.poll.editChoices}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Rewriting the choices.
 *
 * A choice keeps its id while it is being renamed, which is what keeps the
 * votes cast for it; a choice that is taken off the list takes its votes with
 * it. That is stated on screen rather than left to be discovered, because it is
 * the one action here that destroys something and it looks exactly like the one
 * that does not.
 */
function OptionEditor({
  ballot,
  lang,
  onCancel,
}: {
  ballot: BallotDetail;
  lang: Locale;
  onCancel: () => void;
}) {
  const t = getDictionary(lang);
  const action = savePollOptions.bind(null, ballot.id, ballot.issueId);
  const [state, formAction, pending] = useActionState(action, initial);
  const [rows, setRows] = useState(
    ballot.options.map((option) => ({ ...option })),
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={lang} />

      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={row.id || `new-${i}`} className="flex items-center gap-2">
            <input type="hidden" name="optionId" value={row.id} />
            <input
              name="options"
              className={FIELD}
              value={row.label}
              aria-label={`${t.poll.choiceLabel} ${i + 1}`}
              placeholder={t.poll.choicePlaceholder}
              onChange={(event) =>
                setRows(rows.map((r, k) => (k === i ? { ...r, label: event.target.value } : r)))
              }
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, k) => k !== i))}
              aria-label={t.poll.removeChoice}
              title={
                row.voteCount > 0 ? t.poll.removeKeepsNoVotes(row.voteCount) : t.poll.removeChoice
              }
              disabled={rows.length <= 2}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#a9a3aa] transition-colors hover:bg-[#f6e7ea] hover:text-[#a3162c] disabled:opacity-40"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {rows.length < 10 && (
        <div>
          <button
            type="button"
            className={BTN_SECONDARY}
            onClick={() => setRows([...rows, { id: "", label: "", voteCount: 0 }])}
          >
            {t.poll.addChoice}
          </button>
        </div>
      )}

      <p className={`text-[13px] leading-[19px] ${MUTED}`}>{t.poll.editWarning}</p>

      {state.error && (
        <p className="text-[13px] font-semibold text-[#a3162c]">{t.errors[state.error]}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={pending}>
          {pending ? t.poll.publishing : t.poll.saveChoices}
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onCancel} disabled={pending}>
          {t.poll.cancelEdit}
        </button>
      </div>
    </form>
  );
}
