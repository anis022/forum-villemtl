"use client";

import { useActionState, useEffect, useState } from "react";
import { submitMapPollResponse, type PollActionState } from "@/app/actions/polls";
import { getDictionary, type Locale } from "@/utils/i18n";
import { LocationPicker } from "@/components/issues/location-picker";
import { CharacterCounter } from "@/components/ui/character-counter";
import { ALERT, BTN_PRIMARY, FIELD, LABEL, MUTED } from "@/components/ui/styles";
import { resilient } from "@/utils/resilient-action";

const initial: PollActionState = { error: null };

export function MapResponseForm({
  pollId,
  issueId,
  allowDescription,
  allowImage,
  initialLat,
  initialLon,
  lang,
}: {
  pollId: string;
  issueId: string;
  allowDescription: boolean;
  allowImage: boolean;
  /** Chosen on the map above, when that is how the reader got here. */
  initialLat?: number;
  initialLon?: number;
  lang: Locale;
}) {
  const t = getDictionary(lang);
  const action = submitMapPollResponse.bind(null, pollId, issueId);
  const [state, formAction, pending] = useActionState(resilient(action), initial);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <form action={formAction} noValidate className="mt-5 border-t border-[#f2ece4] pt-5">
      <input type="hidden" name="locale" value={lang} />

      <div className="mb-5">
        <span className={LABEL}>{t.poll.pinLocation}</span>
        <LocationPicker
          disabled={pending}
          defaultLat={state.values?.lat ?? initialLat}
          defaultLon={state.values?.lon ?? initialLon}
          labels={{
            hint: "",
            chosen: t.issue.locationChosen,
            locate: t.issue.locationUseMine,
            locating: t.issue.locationLocating,
            outside: t.issue.locationOutside,
            denied: t.issue.locationDenied,
            clear: t.issue.locationClear,
          }}
        />
      </div>

      {allowDescription && (
        <div className="mb-5">
          <label htmlFor={`poll-pin-description-${pollId}`} className={LABEL}>
            {t.poll.pinDescriptionLabel} <span className="font-normal">{t.poll.optional}</span>
          </label>
          <div className="relative">
            <textarea
              id={`poll-pin-description-${pollId}`}
              name="description"
              rows={4}
              maxLength={1000}
              disabled={pending}
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              placeholder={t.poll.pinDescriptionPlaceholder}
              className={`${FIELD} resize-y pr-20 pb-9`}
            />
            <CharacterCounter count={description.length} max={1000} />
          </div>
        </div>
      )}

      {allowImage && (
        <div className="mb-5">
          <label htmlFor={`poll-pin-image-${pollId}`} className={LABEL}>
            {t.poll.pinPhotoLabel} <span className="font-normal">{t.poll.optional}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={`poll-pin-image-${pollId}`}
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                setFileName(file?.name ?? null);
                setPreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return file ? URL.createObjectURL(file) : null;
                });
              }}
              className="peer sr-only"
            />
            <label
              htmlFor={`poll-pin-image-${pollId}`}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#d4d4ee] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#2a2a86] transition-all hover:border-[#2a2a86] hover:bg-[#e8e8f6] peer-focus-visible:ring-[3px] peer-focus-visible:ring-[#2a2a86] peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5V20h14v-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t.poll.pinPhotoChoose}
            </label>
            {fileName && <span className={`max-w-full break-all text-[13px] ${MUTED}`}>{fileName}</span>}
          </div>
          {preview && (
            /* eslint-disable-next-line @next/next/no-img-element -- local blob preview */
            <img
              src={preview}
              alt=""
              className="mt-3 max-h-64 rounded-[12px] border border-[#e9e0d6] object-contain"
            />
          )}
        </div>
      )}


      {state.error && (
        <p role="alert" className={`mb-5 ${ALERT}`}>
          {t.errors[state.error]}
        </p>
      )}

      <button type="submit" disabled={pending} className={BTN_PRIMARY}>
        {pending ? t.poll.submittingPin : t.poll.submitPin}
      </button>
    </form>
  );
}
