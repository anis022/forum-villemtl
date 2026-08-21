"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  setAdministratorAccess,
  type StaffAccessError,
} from "@/app/actions/access";
import type { StaffAccessEntry } from "@/utils/supabase/moderation";
import { getDictionary, type Locale } from "@/utils/i18n";
import {
  ALERT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD,
  FIELD,
  LABEL,
  MUTED,
  SECTION_TITLE,
} from "@/components/ui/styles";

const ADD = "__add__";

/**
 * A small authorization list, not a user-management console.
 *
 * Adding an address grants the official administrator role after that address
 * is verified. Suspending it updates an existing profile immediately, while
 * keeping the row available for a one-click restoration and preserving the
 * factual elected/staff metadata attached to it.
 */
export function StaffAccessManager({
  entries,
  lang,
}: {
  entries: StaffAccessEntry[];
  lang: Locale;
}) {
  const t = getDictionary(lang).moderation;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<StaffAccessError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errorText = (code: StaffAccessError): string => {
    if (code === "invalidEmail") return t.accessInvalidEmail;
    if (code === "cannotRevokeSelf") return t.accessCannotRemoveSelf;
    if (code === "accessNotFound") return t.accessNotFound;
    if (code === "notSignedIn") return t.accessNotSignedIn;
    if (code === "forbidden") return t.forbidden;
    return t.accessFailed;
  };

  const run = (
    targetEmail: string,
    active: boolean,
    success: string,
    busyKey = targetEmail,
    onSuccess?: () => void,
  ) => {
    setBusy(busyKey);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setAdministratorAccess(targetEmail, active, lang);
      setBusy(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(null);
      setNotice(success);
      onSuccess?.();
      router.refresh();
    });
  };

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    const existing = entries.find((entry) => entry.email === normalized);
    run(
      normalized,
      true,
      existing?.active ? t.accessAlreadyGranted(normalized) : t.accessGranted(normalized),
      ADD,
      () => setEmail(""),
    );
  };

  return (
    <section aria-labelledby="staff-access-title">
      <div className="max-w-[760px]">
        <h2 id="staff-access-title" className={SECTION_TITLE}>
          {t.accessTitle}
        </h2>
        <p className={`mt-2 text-[15px] leading-[23px] ${MUTED}`}>{t.accessIntro}</p>
      </div>

      <form
        onSubmit={add}
        className={`${CARD} mt-5 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5`}
        noValidate
      >
        <label htmlFor="administrator-email" className="min-w-0">
          <span className={LABEL}>{t.accessEmail}</span>
          <input
            id="administrator-email"
            name="email"
            type="email"
            autoComplete="email"
            className={FIELD}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.accessEmailPlaceholder}
            disabled={pending}
            required
          />
        </label>
        <button type="submit" className={BTN_PRIMARY} disabled={pending || !email.trim()}>
          {pending && busy === ADD ? t.accessAdding : t.accessAdd}
        </button>
      </form>

      {error && <p className={`${ALERT} mt-4`}>{errorText(error)}</p>}
      {notice && (
        <p className="mt-4 rounded-[12px] border border-[#b9dcc7] bg-[#edf8f1] px-4 py-3 text-[15px] text-[#22613d]">
          {notice}
        </p>
      )}

      <div className="mt-5 space-y-2">
        {entries.map((entry) => {
          const name = [entry.firstName, entry.lastName].filter(Boolean).join(" ");
          const confirmingThis = confirming === entry.email;
          const working = pending && busy === entry.email;

          return (
            <article
              key={entry.email}
              className={`${CARD} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-[15px] font-bold leading-[21px]">
                    {name || entry.email}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.04em] ${
                      entry.active
                        ? "bg-[#edf8f1] text-[#22613d]"
                        : "bg-[#f3efeb] text-[#6e6a72]"
                    }`}
                  >
                    {entry.active ? t.accessActive : t.accessSuspended}
                  </span>
                  {entry.isSelf && (
                    <span className="rounded-full bg-[#e8e8f6] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-[#2a2a86]">
                      {t.accessYou}
                    </span>
                  )}
                  {entry.elected && (
                    <span className="rounded-full bg-[#fff3cf] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-[#71520c]">
                      {t.accessElected}
                    </span>
                  )}
                </div>
                {name && (
                  <p className={`mt-0.5 break-all text-[13px] leading-[19px] ${MUTED}`}>
                    {entry.email}
                  </p>
                )}
                <p className={`mt-1 text-[12px] leading-[18px] ${MUTED}`}>
                  {!entry.hasAccount
                    ? t.accessFirstSignIn
                    : entry.confirmed
                      ? t.accessAccountReady
                      : t.accessConfirmationPending}
                </p>
              </div>

              <div className="shrink-0">
                {entry.isSelf ? (
                  <button type="button" className={BTN_SECONDARY} disabled>
                    {t.accessCurrentAccount}
                  </button>
                ) : entry.active ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirmingThis) {
                        setConfirming(entry.email);
                        setError(null);
                        setNotice(null);
                        return;
                      }
                      run(entry.email, false, t.accessRevoked(entry.email));
                    }}
                    className={
                      confirmingThis
                        ? "inline-flex items-center justify-center rounded-[10px] border border-[#a3162c] bg-[#a3162c] px-5 py-[10px] text-[15px] font-bold leading-[22px] text-white transition-colors hover:bg-[#8e0f24] disabled:opacity-60"
                        : BTN_SECONDARY
                    }
                  >
                    {working
                      ? t.accessRemoving
                      : confirmingThis
                        ? t.accessConfirmRemove
                        : t.accessRemove}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={pending}
                    onClick={() => run(entry.email, true, t.accessRestored(entry.email))}
                  >
                    {working ? t.accessRestoring : t.accessRestore}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
