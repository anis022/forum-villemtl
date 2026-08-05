"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar, type AvatarPerson } from "@/components/ui/avatar";
import { removeAvatar, updateAvatar } from "@/app/actions/profile";
import type { ErrorCode } from "@/utils/i18n";

export type UploadLabels = {
  change: string;
  remove: string;
  hint: string;
  saving: string;
  errors: Record<ErrorCode, string>;
};

/**
 * The avatar itself is the control: a camera badge sits on its corner, which
 * is the gesture people already know from every profile they have. Picking a
 * file uploads it straight away — an upload waiting behind a separate save
 * button is a step nobody expects on a profile picture — and the preview swaps
 * in from the chosen file so the change is visible before the round trip ends.
 */
export function AvatarUpload({
  person,
  labels,
}: {
  person: AvatarPerson;
  labels: UploadLabels;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const shown: AvatarPerson = preview ? { ...person, avatarUrl: preview } : person;
  const hasPhoto = Boolean(person.avatarUrl || preview);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));

    const data = new FormData();
    data.set("avatar", file);
    startTransition(async () => {
      const result = await updateAvatar(data);
      if (!result.ok) {
        setError(result.error);
        setPreview(null);
      }
    });
  }

  function onRemove() {
    setError(null);
    setPreview(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      {/* inline-flex, not inline-block: an avatar is an inline box, so an
          inline-block ring also contains the line box's descender space and
          comes out an oval taller than it is wide. */}
      <span className="inline-flex rounded-full bg-white p-1 shadow-[0_2px_8px_rgba(22,36,31,0.10)]">
        <span className="relative block">
          <span className={`flex transition-opacity ${pending ? "opacity-50" : ""}`}>
            <Avatar person={shown} size="lg" />
          </span>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            aria-label={labels.change}
            title={labels.change}
            /* The badge is drawn at 32px so it stays a badge on a 64px avatar,
               and its hit area is grown to 40px with a transparent ::after
               rather than by enlarging the circle. */
            className="absolute -bottom-0.5 -right-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#097d6c] text-white shadow-[0_1px_4px_rgba(22,36,31,0.25)] transition-transform after:absolute after:-inset-1 after:content-[''] hover:scale-105 active:scale-95 disabled:opacity-60"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 8.5h3l1.5-2.2h7L17 8.5h3v10H4v-10z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </button>
        </span>
      </span>

      {/* The status line sits in normal flow under the avatar and starts at its
          left edge. Hung off the bottom of a 64px circle and centred on it, an
          error long enough to need two lines reached past the left of a 320px
          screen, and being out of flow it printed over the person's name. */}
      {(hasPhoto || pending || error) && (
        <div className="mt-1 max-w-[220px] text-[12px] font-bold leading-[18px]">
          {/* Removal is secondary and rare, so it stays out of the badge and
              only appears once there is actually a photo to remove. */}
          {hasPhoto && !pending && (
            <button
              type="button"
              onClick={onRemove}
              /* Padded out to a 40px row: as bare 12px text this is the hardest
                 thing on the page to hit with a thumb. */
              className="inline-flex min-h-[40px] items-center text-[#5d6b66] underline transition-colors hover:text-[#c0392f]"
            >
              {labels.remove}
            </button>
          )}

          {/* Same 40px row as the button it stands in for, so the heading below
              does not jump while an upload is in flight. */}
          {pending && (
            <p className="flex min-h-[40px] items-center text-[#5d6b66]">{labels.saving}</p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-[10px] bg-[#fdeceb] px-3 py-1.5 text-[#a4231f]"
            >
              {labels.errors[error]}
            </p>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        name="avatar"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
