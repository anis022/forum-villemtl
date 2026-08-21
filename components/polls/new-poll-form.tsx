"use client";

import { useActionState, useRef, useState } from "react";
import { createPoll, type PollActionState } from "@/app/actions/polls";
import { getDictionary, type Locale } from "@/utils/i18n";
import { CATEGORY_KEYS } from "@/utils/issues";
import type { PollKind } from "@/utils/polls";
import { CharacterCounter } from "@/components/ui/character-counter";
import {
  ALERT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  FIELD,
  LABEL,
} from "@/components/ui/styles";

const initial: PollActionState = { error: null };

type Choice = { key: number; value: string };

export function NewPollForm({ lang, isAdmin }: { lang: Locale; isAdmin: boolean }) {
  const t = getDictionary(lang);
  const [state, formAction, pending] = useActionState(createPoll, initial);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<PollKind>("choice");
  const [allowPinDescription, setAllowPinDescription] = useState(true);
  const [allowPinImage, setAllowPinImage] = useState(false);
  const [maxPinsPerMember, setMaxPinsPerMember] = useState(1);
  const [choices, setChoices] = useState<Choice[]>([
    { key: 0, value: "" },
    { key: 1, value: "" },
  ]);
  const nextKey = useRef(2);

  return (
    <form action={formAction} noValidate className={`${CARD} p-5 sm:p-6`}>
      <input type="hidden" name="locale" value={lang} />

      {/* Two choices, so a toggle beside the label rather than two bordered
          cards with an icon and a sentence of explanation each. The names say
          what they are — a list of answers, or a point on a map — and a person
          about to write a poll does not need either one described to them.

          Hidden outright when the office is not looking, since a member has
          only one kind available and a toggle with one position is furniture. */}
      {/* Category, question, context — the order and the shapes of
          `new-issue-form.tsx`, because this writes a topic and there is no
          reason for the two composers to disagree about how a topic is
          written. The question is a single line there and a single line here;
          it was a three-row textarea, which is a large empty box asking for a
          sentence. */}
      <div className="mb-5">
        <label htmlFor="poll-category" className={LABEL}>
          {t.issue.fieldCategory}
        </label>
        <select id="poll-category" name="category" className={FIELD} disabled={pending}>
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {t.categories[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5">
        <label htmlFor="poll-question" className={LABEL}>
          {t.poll.questionLabel}
        </label>
        <div className="relative">
          <input
            id="poll-question"
            name="question"
            type="text"
            minLength={5}
            maxLength={150}
            disabled={pending}
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
            placeholder={t.poll.questionPlaceholder}
            className={`${FIELD} pr-20`}
          />
          <CharacterCounter count={question.length} max={150} />
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="poll-description" className={LABEL}>
          {t.poll.descriptionLabel}
        </label>
        <div className="relative">
          <textarea
            id="poll-description"
            name="description"
            rows={5}
            minLength={20}
            maxLength={5000}
            required
            disabled={pending}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            placeholder={t.poll.descriptionPlaceholder}
            className={`${FIELD} resize-y pr-20 pb-9`}
          />
          <CharacterCounter count={description.length} max={5000} />
        </div>
      </div>

      {/* An ordinary labelled field, like the two above it, rather than a
          control invented for this one form. Absent for a member, who has one
          kind available. */}
      {isAdmin && (
        <div className="mb-6">
          <label htmlFor="poll-kind" className={LABEL}>
            {t.poll.modeTitle}
          </label>
          <select
            id="poll-kind"
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.currentTarget.value as PollKind)}
            disabled={pending}
            className={FIELD}
          >
            <option value="choice">{t.poll.choiceModeTitle}</option>
            <option value="map">{t.poll.mapModeTitle}</option>
          </select>
        </div>
      )}
      {!isAdmin && <input type="hidden" name="kind" value="choice" />}

      {kind === "choice" ? (
      <fieldset>
        <legend className="text-[18px] font-bold leading-[26px]">{t.poll.choicesTitle}</legend>

        <div className="mt-4 space-y-3">
          {choices.map((choice, index) => (
            <div key={choice.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <div>
                <label htmlFor={`poll-choice-${choice.key}`} className={LABEL}>
                  {t.poll.choiceLabel(index + 1)}
                </label>
                <div className="relative">
                  <input
                    id={`poll-choice-${choice.key}`}
                    name="options"
                    type="text"
                    minLength={1}
                    maxLength={120}
                    required
                    disabled={pending}
                    value={choice.value}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setChoices((current) =>
                        current.map((item) => (item.key === choice.key ? { ...item, value } : item)),
                      );
                    }}
                    placeholder={t.poll.choicePlaceholder}
                    className={`${FIELD} pr-20`}
                  />
                  <CharacterCounter count={choice.value.length} max={120} />
                </div>
              </div>

              <button
                type="button"
                disabled={pending || choices.length <= 2}
                onClick={() =>
                  setChoices((current) => current.filter((item) => item.key !== choice.key))
                }
                className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-[#6e6a72] transition-colors hover:bg-[#fdeaed] hover:text-[#a3162c] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">{t.poll.removeChoice}</span>
              </button>
            </div>
          ))}
        </div>

        {choices.length < 10 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const key = nextKey.current;
              nextKey.current += 1;
              setChoices((current) => [...current, { key, value: "" }]);
            }}
            className={`${BTN_SECONDARY} mt-4`}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t.poll.addChoice}
          </button>
        )}
      </fieldset>
      ) : (
        <fieldset>
          <legend className="text-[18px] font-bold leading-[26px]">
            {t.poll.mapSettingsTitle}
          </legend>

          <div className="mt-4 space-y-3">
            <SettingToggle
              id="allow-pin-description"
              name="allowPinDescription"
              checked={allowPinDescription}
              onChange={setAllowPinDescription}
              disabled={pending}
              title={t.poll.allowPinDescriptionTitle}
            />
            <SettingToggle
              id="allow-pin-image"
              name="allowPinImage"
              checked={allowPinImage}
              onChange={setAllowPinImage}
              disabled={pending}
              title={t.poll.allowPinImageTitle}
            />
          </div>

          {/* A number, with the two buttons that change it. It was four preset
              buttons reading 1, 3, 5 and 10, which is a menu where a count
              belongs and cannot express 2. */}
          <div className="mt-5">
            <label htmlFor="max-pins" className={LABEL}>
              {t.poll.maxPinsTitle}
            </label>
            <div className="inline-flex items-center gap-1 rounded-[12px] border border-[#e9e0d6] bg-white p-1">
              <Step
                label="−"
                disabled={pending || maxPinsPerMember <= 1}
                onClick={() => setMaxPinsPerMember((n) => Math.max(1, n - 1))}
              />
              <input
                id="max-pins"
                name="maxPinsPerMember"
                type="number"
                min={1}
                max={10}
                value={maxPinsPerMember}
                disabled={pending}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  setMaxPinsPerMember(Number.isFinite(next) ? Math.min(10, Math.max(1, next)) : 1);
                }}
                className="w-14 border-0 bg-transparent text-center text-[16px] font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Step
                label="+"
                disabled={pending || maxPinsPerMember >= 10}
                onClick={() => setMaxPinsPerMember((n) => Math.min(10, n + 1))}
              />
            </div>
          </div>
        </fieldset>
      )}

      <div className="my-6" />

      {state.error && (
        <p role="alert" className={`mb-5 ${ALERT}`}>
          {t.errors[state.error]}
        </p>
      )}

      <button type="submit" disabled={pending} className={BTN_PRIMARY}>
        {pending ? t.poll.publishing : t.poll.publish}
      </button>
    </form>
  );
}

function SettingToggle({
  id,
  name,
  checked,
  onChange,
  disabled,
  title,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  title: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-4 rounded-[12px] border border-[#e9e0d6] bg-white p-3.5 transition-colors hover:border-[#2a2a86]"
    >
      <span className="min-w-0 flex-1 text-[15px] font-bold text-[#1a1a1a]">{title}</span>
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-[#d8cec5] transition-colors peer-checked:bg-[#2a2a86] peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#2a2a86] peer-focus-visible:ring-offset-2">
        <span
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </span>
    </label>
  );
}

/** One end of the counter. Square, quiet, and disabled at the limit. */
function Step({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] text-[18px] font-bold leading-none text-[#6e6a72] transition-colors hover:bg-[#faf1e8] hover:text-[#1a1a1a] disabled:opacity-35"
    >
      {label}
    </button>
  );
}
