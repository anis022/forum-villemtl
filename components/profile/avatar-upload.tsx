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
 * Picking a photo submits immediately — an upload behind a second "save" button
 * is a step nobody expects on a profile picture. The preview swaps in from the
 * chosen file so the change is visible before the round trip finishes.
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
    <div className="flex flex-wrap items-center gap-4">
      <span className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <Avatar person={shown} size="lg" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="h-9 rounded-[4px] border-[0.8px] border-[#097d6c] bg-[#097d6c] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#075f53] disabled:opacity-60"
          >
            {pending ? labels.saving : labels.change}
          </button>
          {(person.avatarUrl || preview) && (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              className="h-9 rounded-[4px] border-[0.8px] border-[#ced4da] px-4 text-[14px] font-bold text-[#637381] transition-colors hover:border-[#637381] hover:text-[#212529] disabled:opacity-60"
            >
              {labels.remove}
            </button>
          )}
        </div>
        <p className="mt-2 text-[13px] leading-[18px] text-[#637381]">{labels.hint}</p>
        {error && <p className="mt-1 text-[13px] font-bold text-[#a4231f]">{labels.errors[error]}</p>}
      </div>

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
