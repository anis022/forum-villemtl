"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeAccount } from "@/app/actions/profile";
import type { Locale } from "@/utils/i18n";
import { ALERT, BTN_SECONDARY, CARD, FIELD, MUTED } from "@/components/ui/styles";

export type AccountLabels = {
  heading: string;
  downloadTitle: string;
  downloadBody: string;
  download: string;
  closeTitle: string;
  closeBody: string;
  close: string;
  closing: string;
  confirmWord: string;
  confirmPrompt: string;
  confirmYes: string;
  cancel: string;
  failed: string;
};

/**
 * The two rights a person can exercise without asking anyone: take a copy of
 * their data, and leave.
 *
 * Only ever rendered on your own profile. They sit at the bottom, under the
 * activity, because nobody arrives here to close their account — but somebody
 * who wants to must not have to write an email to do it.
 *
 * Closing asks you to type a word rather than to press a second button. There
 * is no undo behind this one and no confirmation email after it; a mis-tap
 * should not be able to reach it, and a deliberate decision should take about
 * four seconds.
 */
export function AccountControls({
  lang,
  labels,
}: {
  lang: Locale;
  labels: AccountLabels;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const armed = typed.trim().toLowerCase() === labels.confirmWord.toLowerCase();

  const close = () => {
    setFailed(false);
    startTransition(async () => {
      const result = await closeAccount();
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.push(`/${lang}`);
      router.refresh();
    });
  };

  return (
    <section className="mt-10">
      <h2 className="text-[20px] font-bold leading-[28px]">{labels.heading}</h2>

      <div className={`${CARD} mt-3 p-4 md:p-5`}>
        <h3 className="text-[16px] font-bold leading-[22px]">{labels.downloadTitle}</h3>
        <p className={`mt-1 text-[14px] leading-[21px] ${MUTED}`}>{labels.downloadBody}</p>
        {/* A plain link, not a fetch: the response is a file, and letting the
            browser do the download is what gets it a real save dialog and a
            filename. */}
        <a href="/api/mes-donnees" download className={`${BTN_SECONDARY} mt-3`}>
          {labels.download}
        </a>
      </div>

      <div className="mt-3 rounded-[16px] border border-[#f5ccd6] bg-white p-4 md:p-5">
        <h3 className="text-[16px] font-bold leading-[22px]">{labels.closeTitle}</h3>
        <p className={`mt-1 text-[14px] leading-[21px] ${MUTED}`}>{labels.closeBody}</p>

        {failed && (
          <p role="alert" className={`mt-3 ${ALERT}`}>
            {labels.failed}
          </p>
        )}

        {confirming ? (
          <div className="mt-3">
            <label htmlFor="close-confirm" className="block text-[14px] leading-[21px]">
              {labels.confirmPrompt}
            </label>
            <input
              id="close-confirm"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={pending}
              className={`${FIELD} mt-2 max-w-[18rem]`}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={close}
                disabled={!armed || pending}
                className="inline-flex items-center justify-center rounded-[10px] border border-[#ab1f5c] bg-[#ab1f5c] px-5 py-[10px] text-[15px] font-bold leading-[22px] text-white transition-all hover:bg-[#b3122c] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? labels.closing : labels.confirmYes}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                }}
                disabled={pending}
                className="inline-flex items-center justify-center rounded-[10px] border border-[#e9e0d6] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#6e6a72] transition-all hover:border-[#6e6a72] hover:text-[#1a1a1a] disabled:opacity-60"
              >
                {labels.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 inline-flex items-center justify-center rounded-[10px] border border-[#e9e0d6] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#6e6a72] transition-all hover:border-[#ab1f5c] hover:text-[#ab1f5c] active:scale-[0.98]"
          >
            {labels.close}
          </button>
        )}
      </div>
    </section>
  );
}
