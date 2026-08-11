"use client";

import Link from "next/link";
import { useTransition } from "react";
import { clearFlag } from "@/app/actions/issues";
import type { Flag } from "@/utils/moderation";
import type { Locale } from "@/utils/i18n";
import { BTN_SECONDARY, CARD, MUTED } from "@/components/ui/styles";

export type FlagLabels = {
  reportKind: string;
  replyKind: string;
  terms: string;
  open: string;
  dismiss: string;
  dismissing: string;
};

/**
 * One flagged message, waiting to be read by a person.
 *
 * The message itself is shown in full rather than as an excerpt with the matched
 * words highlighted. Highlighting would make the decision for the reader — the
 * whole reason this lands in a queue instead of being refused is that the words
 * are not the point, the sentence around them is, and a page that paints them
 * orange is asking somebody to skim four words and rule on them.
 *
 * The matched words are named underneath instead, quietly, because an official
 * looking at a message that seems perfectly ordinary should be able to find out
 * what tripped the filter — that is how the lexicon gets fixed.
 *
 * Only one button here, and it is the harmless one. Taking a message down
 * happens where the message lives, with the replies underneath it visible and
 * the confirmation that already explains they go too.
 */
export function FlagCard({
  flag,
  lang,
  labels,
}: {
  flag: Flag;
  lang: Locale;
  labels: FlagLabels;
}) {
  const [pending, startTransition] = useTransition();

  const dismiss = () => {
    startTransition(async () => {
      await clearFlag(flag.id, lang);
    });
  };

  const href = flag.commentId
    ? `/${lang}/sujets/${flag.issueId}#c-${flag.commentId}`
    : `/${lang}/sujets/${flag.issueId}`;

  return (
    <article className={`${CARD} p-4 md:p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block rounded-full bg-[#faf1e8] px-2.5 py-0.5 text-[12px] font-bold text-[#6e6a72]">
          {flag.commentId ? labels.replyKind : labels.reportKind}
        </span>
        {flag.authorName && (
          <span className={`text-[13px] ${MUTED}`}>{flag.authorName}</span>
        )}
      </div>

      {flag.title && (
        <p className="mt-2 text-[16px] font-bold leading-[22px] break-words">{flag.title}</p>
      )}
      <p className="mt-1.5 max-w-[68ch] whitespace-pre-wrap break-words text-[15px] leading-[24px]">
        {flag.body}
      </p>

      {flag.terms.length > 0 && (
        <p className={`mt-3 break-words text-[13px] leading-[19px] ${MUTED}`}>
          <span className="font-bold">{labels.terms} : </span>
          {flag.terms.join(", ")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={href} className={BTN_SECONDARY}>
          {labels.open}
        </Link>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#e9e0d6] bg-white px-5 py-[10px] text-[15px] font-bold leading-[22px] text-[#6e6a72] transition-all hover:border-[#6e6a72] hover:text-[#1a1a1a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? labels.dismissing : labels.dismiss}
        </button>
      </div>
    </article>
  );
}
