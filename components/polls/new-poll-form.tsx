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
  MUTED,
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
      <fieldset className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <legend className="sr-only">{t.poll.modeTitle}</legend>
        <span className="text-[15px] font-bold leading-[22px]">{t.poll.modeTitle}</span>

        {isAdmin ? (
          <div className="inline-flex rounded-[10px] border border-[#e9e0d6] bg-[#faf1e8] p-0.5">
            {([
              { value: "choice" as const, label: t.poll.choiceModeTitle },
              { value: "map" as const, label: t.poll.mapModeTitle },
            ]).map((mode) => (
              <label
                key={mode.value}
                className={`inline-flex min-h-[38px] cursor-pointer items-center rounded-[8px] px-3.5 text-[14px] font-bold transition-colors ${
                  kind === mode.value
                    ? "bg-white text-[#1a1a1a] shadow-[0_1px_2px_rgba(26,26,26,0.08)]"
                    : "text-[#6e6a72] hover:text-[#1a1a1a]"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={mode.value}
                  checked={kind === mode.value}
                  onChange={() => setKind(mode.value)}
                  disabled={pending}
                  className="sr-only"
                />
                {mode.label}
              </label>
            ))}
          </div>
        ) : (
          <>
            <input type="hidden" name="kind" value="choice" />
            <span className={`text-[14px] ${MUTED}`}>{t.poll.choiceModeTitle}</span>
          </>
        )}
      </fieldset>

      <div className="mb-5">
        <label htmlFor="poll-question" className={LABEL}>
          {t.poll.questionLabel}
        </label>
        <div className="relative">
          <textarea
            id="poll-question"
            name="question"
            rows={3}
            minLength={5}
            maxLength={150}
            required
            disabled={pending}
            value={question}
            onChange={(event) => setQuestion(event.currentTarget.value)}
            placeholder={t.poll.questionPlaceholder}
            className={`${FIELD} resize-y pr-20 pb-9`}
          />
          <CharacterCounter count={question.length} max={150} />
        </div>
      </div>

      <div className="mb-6">
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

      {/* The feed filters on this, and a topic that skipped it would be
          unreachable from every chip on the home page. */}
      <div className="mb-6">
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
        <fieldset className="rounded-[14px] border border-[#d4d4ee] bg-[#f4f4fb] p-4 sm:p-5">
          <legend className="px-1 text-[18px] font-bold leading-[26px] text-[#2a2a86]">
            {t.poll.mapSettingsTitle}
          </legend>
          <p className={`mt-1 text-[14px] leading-[21px] ${MUTED}`}>{t.poll.mapSettingsHint}</p>

          <div className="mt-4 space-y-3">
            <SettingToggle
              id="allow-pin-description"
              name="allowPinDescription"
              checked={allowPinDescription}
              onChange={setAllowPinDescription}
              disabled={pending}
              title={t.poll.allowPinDescriptionTitle}
              body={t.poll.allowPinDescriptionBody}
            />
            <SettingToggle
              id="allow-pin-image"
              name="allowPinImage"
              checked={allowPinImage}
              onChange={setAllowPinImage}
              disabled={pending}
              title={t.poll.allowPinImageTitle}
              body={t.poll.allowPinImageBody}
            />
          </div>

          <div className="mt-5 border-t border-[#e5d7eb] pt-5">
            <p className="font-bold text-[#1a1a1a]">{t.poll.maxPinsTitle}</p>
            <p className={`mt-1 text-[13px] leading-[19px] ${MUTED}`}>{t.poll.maxPinsBody}</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[1, 3, 5, 10].map((limit) => (
                <label
                  key={limit}
                  className={`cursor-pointer rounded-[10px] border px-2 py-2.5 text-center text-[14px] font-bold transition-colors ${
                    maxPinsPerMember === limit
                      ? "border-[#2a2a86] bg-[#2a2a86] text-white"
                      : "border-[#d4d4ee] bg-white text-[#2a2a86] hover:border-[#2a2a86]"
                  }`}
                >
                  <input
                    type="radio"
                    name="maxPinsPerMember"
                    value={limit}
                    checked={maxPinsPerMember === limit}
                    onChange={() => setMaxPinsPerMember(limit)}
                    disabled={pending}
                    className="sr-only"
                  />
                  {t.poll.maxPinsChoice(limit)}
                </label>
              ))}
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
  body,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  title: string;
  body: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-4 rounded-[12px] border border-[#e5d7eb] bg-white p-3.5 transition-colors hover:border-[#b795c5]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-[#1a1a1a]">{title}</span>
        <span className={`mt-0.5 block text-[13px] leading-[19px] ${MUTED}`}>{body}</span>
      </span>
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
