"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { setManualMember, type MemberAccessError } from "@/app/actions/access";
import type { ManualMember } from "@/utils/supabase/moderation";
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
 * Members let in ahead of the roster export. Only these rows are listed and
 * only these can be removed: the export's own rows belong to the party's file.
 */
export function MemberAccessManager({
  members,
  lang,
}: {
  members: ManualMember[];
  lang: Locale;
}) {
  const t = getDictionary(lang).moderation;
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<MemberAccessError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const errorText = (code: MemberAccessError): string => {
    if (code === "invalidEmail") return t.accessInvalidEmail;
    if (code === "alreadyMember") return t.membersAlready;
    if (code === "memberNotFound") return t.membersNotFound;
    if (code === "notSignedIn") return t.accessNotSignedIn;
    if (code === "forbidden") return t.forbidden;
    return t.accessFailed;
  };

  const run = (
    input: { email: string; firstName?: string; lastName?: string },
    add: boolean,
    success: string,
    busyKey: string,
    onSuccess?: () => void,
  ) => {
    setBusy(busyKey);
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setManualMember(input, add, lang);
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
    run({ email: normalized, firstName, lastName }, true, t.membersAdded(normalized), ADD, () => {
      setEmail("");
      setFirstName("");
      setLastName("");
    });
  };

  return (
    <section aria-labelledby="member-access-title">
      <div className="max-w-[760px]">
        <h2 id="member-access-title" className={SECTION_TITLE}>
          {t.membersTitle}
        </h2>
        <p className={`mt-2 text-[15px] leading-[23px] ${MUTED}`}>{t.membersIntro}</p>
      </div>

      <form
        onSubmit={add}
        className={`${CARD} mt-5 grid gap-3 p-4 sm:grid-cols-2 sm:p-5`}
        noValidate
      >
        <label htmlFor="member-first-name" className="min-w-0">
          <span className={LABEL}>{t.membersFirstName}</span>
          <input
            id="member-first-name"
            autoComplete="off"
            className={FIELD}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            maxLength={120}
            disabled={pending}
          />
        </label>
        <label htmlFor="member-last-name" className="min-w-0">
          <span className={LABEL}>{t.membersLastName}</span>
          <input
            id="member-last-name"
            autoComplete="off"
            className={FIELD}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={120}
            disabled={pending}
          />
        </label>
        <label htmlFor="member-email" className="min-w-0 sm:col-span-2">
          <span className={LABEL}>{t.membersEmail}</span>
          <input
            id="member-email"
            type="email"
            autoComplete="off"
            className={FIELD}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.accessEmailPlaceholder}
            disabled={pending}
            required
          />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" className={BTN_PRIMARY} disabled={pending || !email.trim()}>
            {pending && busy === ADD ? t.membersAdding : t.membersAdd}
          </button>
        </div>
      </form>

      {error && <p className={`${ALERT} mt-4`}>{errorText(error)}</p>}
      {notice && (
        <p className="mt-4 rounded-[12px] border border-[#b9dcc7] bg-[#edf8f1] px-4 py-3 text-[15px] text-[#22613d]">
          {notice}
        </p>
      )}

      <div className="mt-5 space-y-2">
        {members.length === 0 ? (
          <p className={`text-[15px] ${MUTED}`}>{t.membersEmpty}</p>
        ) : (
          members.map((member) => {
            const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
            const confirmingThis = confirming === member.email;
            const working = pending && busy === member.email;

            return (
              <article
                key={member.email}
                className={`${CARD} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between`}
              >
                <div className="min-w-0">
                  <p className="break-words text-[15px] font-bold leading-[21px]">
                    {name || member.email}
                  </p>
                  {name && (
                    <p className={`mt-0.5 break-all text-[13px] leading-[19px] ${MUTED}`}>
                      {member.email}
                    </p>
                  )}
                  <p className={`mt-1 text-[12px] leading-[18px] ${MUTED}`}>
                    {member.hasAccount ? t.membersSignedUp : t.membersNotYet}
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (!confirmingThis) {
                        setConfirming(member.email);
                        setError(null);
                        setNotice(null);
                        return;
                      }
                      run(
                        { email: member.email },
                        false,
                        t.membersRemoved(member.email),
                        member.email,
                      );
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
                        ? t.membersConfirmRemove
                        : t.membersRemove}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
