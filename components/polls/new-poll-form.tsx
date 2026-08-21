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

      <fieldset className="mb-7">
        <legend className="text-[18px] font-bold leading-[26px]">{t.poll.modeTitle}</legend>
        <p className={`mt-1 text-[14px] leading-[21px] ${MUTED}`}>{t.poll.modeHint}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            {
              value: "choice" as const,
              title: t.poll.choiceModeTitle,
              body: t.poll.choiceModeBody,
              icon: (
                <path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              ),
            },
            {
              value: "map" as const,
              title: t.poll.mapModeTitle,
              body: t.poll.mapModeBody,
              icon: (
                <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11zm0-8.5A2.5 2.5 0 1 0 12 7a2.5 2.5 0 0 0 0 5.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              ),
            },
          ]
            // A map ballot collects photographs and pins from the public, which
            // is the one that costs storage and moderation, so it stays with the
            // office. The server refuses it either way; hiding it here means a
            // member is not offered something they will be told off for.
            .filter((mode) => mode.value === "choice" || isAdmin)
          ).map((mode) => (
            <label
              key={mode.value}
              className={`relative cursor-pointer rounded-[14px] border-2 p-4 transition-all ${
                kind === mode.value
                  ? "border-[#2a2a86] bg-[#e8e8f6] shadow-[0_2px_10px_rgba(42,42,134,0.08)]"
                  : "border-[#e9e0d6] bg-white hover:border-[#bda4c8]"
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
              <span className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${
                    kind === mode.value ? "bg-[#2a2a86] text-white" : "bg-[#faf1e8] text-[#6e6a72]"
                  }`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    {mode.icon}
                  </svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-[#1a1a1a]">{mode.title}</span>
                  <span className={`mt-1 block text-[13px] leading-[19px] ${MUTED}`}>{mode.body}</span>
                </span>
              </span>
              <span
                className={`absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full border ${
                  kind === mode.value ? "border-[#2a2a86] bg-[#2a2a86] text-white" : "border-[#cfc4ba] bg-white"
                }`}
                aria-hidden="true"
              >
                {kind === mode.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="m2.5 6 2.1 2.1L9.7 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </label>
          ))}
        </div>
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
        <p className={`mt-1 text-[14px] leading-[21px] ${MUTED}`}>{t.poll.choicesHint}</p>

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
                className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-[#6e6a72] transition-colors hover:bg-[#fdeaed] hover:text-[#b3122c] disabled:cursor-not-allowed disabled:opacity-30"
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

      <p className={`my-6 text-[14px] leading-[21px] ${MUTED}`}>
        {t.poll.collectionNotice}
      </p>

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
