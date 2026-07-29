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
    <div className="relative">
      <span className={pending ? "block opacity-50 transition-opacity" : "block transition-opacity"}>
        <Avatar person={shown} size="lg" />
      </span>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={labels.change}
        title={labels.change}
        className="absolute -bottom-0.5 -right-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#097d6c] text-white shadow-[0_1px_4px_rgba(22,36,31,0.25)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
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

      {/* Removal is secondary and rare, so it stays out of the badge and only
          appears once there is actually a photo to remove. */}
      {hasPhoto && !pending && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold text-[#5d6b66] underline transition-colors hover:text-[#c0392f]"
        >
          {labels.remove}
        </button>
      )}

      {pending && (
        <p className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold text-[#5d6b66]">
          {labels.saving}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="absolute left-1/2 top-full mt-2 w-max max-w-[16rem] -translate-x-1/2 rounded-[10px] bg-[#fdeceb] px-3 py-1.5 text-[12px] font-bold text-[#a4231f]"
        >
          {labels.errors[error]}
        </p>
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
