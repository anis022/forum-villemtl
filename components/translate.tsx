"use client";

import { createContext, useCallback, useContext, useState, useTransition } from "react";
import { translatePost } from "@/app/actions/translate";
import type { Translation } from "@/utils/translate";
import { getDictionary, type Locale } from "@/utils/i18n";
import { BTN_GHOST, MUTED } from "@/components/ui/styles";

type Status = "idle" | "failed" | "done";

type Ctx = {
  lang: Locale;
  showing: boolean;
  status: Status;
  pending: boolean;
  translation: Translation | null;
  toggle: () => void;
};

const TranslationContext = createContext<Ctx | null>(null);

/**
 * Ties a post's text to its translate button.
 *
 * They live at opposite ends of a card — the words up top, the control down in
 * the action row — so this is a context rather than one component owning both.
 * It also means the text itself stays server-rendered: `Translated` swaps in a
 * string only once there is one, and until someone presses the button this
 * whole feature costs a reader nothing but a few hundred bytes of handler.
 */
export function TranslationProvider({
  kind,
  id,
  lang,
  children,
}: {
  kind: "issue" | "comment";
  id: string;
  lang: Locale;
  children: React.ReactNode;
}) {
  const [showing, setShowing] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = useCallback(() => {
    // Already fetched: flipping back and forth is free, and must stay free.
    if (translation) {
      setShowing((current) => !current);
      return;
    }

    startTransition(async () => {
      const result = await translatePost(kind, id, lang);
      if (result.ok) {
        setTranslation(result.translation);
        setShowing(true);
        setStatus("done");
      } else {
        setStatus("failed");
      }
    });
  }, [translation, kind, id, lang]);

  return (
    <TranslationContext.Provider
      value={{ lang, showing, status, pending, translation, toggle }}
    >
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * One translatable field. Renders the server-rendered original as `children`
 * until a translation is showing, then the translated string in its place —
 * so the surrounding markup, classes and clamping all stay where they were.
 */
export function Translated({
  field,
  children,
}: {
  field: "title" | "body";
  children: React.ReactNode;
}) {
  const ctx = useContext(TranslationContext);
  if (!ctx?.showing || !ctx.translation) return <>{children}</>;

  const text = field === "title" ? ctx.translation.title : ctx.translation.body;
  return <>{text ?? children}</>;
}

/**
 * The control. Sits to the left of Share, in the row of things that do not
 * change the post.
 */
export function TranslateButton({ className = "" }: { className?: string }) {
  const ctx = useContext(TranslationContext);
  if (!ctx) return null;

  const t = getDictionary(ctx.lang);
  const { showing, status, pending, toggle } = ctx;

  const label = pending
    ? t.translate.working
    : showing
      ? t.translate.original
      : t.translate.action;

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={label}
        className={`${BTN_GHOST} shrink-0 disabled:opacity-60`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 6h9M8.5 6v-1.6M10.6 6c0 3.4-2.6 6.6-6.6 8.1M6.2 9.4c0 2.2 2.6 4.3 5.6 5M12.4 20l3.8-9 3.8 9M13.9 16.9h4.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Icon alone on a phone, exactly as Share does two controls along: a
            320px action row has no width for a fourth label. `aria-label`
            carries the whole meaning either way, and the words on the page
            changing under your thumb is the real confirmation. */}
        <span className="hidden whitespace-nowrap sm:inline">{label}</span>
      </button>

      {/* Said where the reader is looking, not in a corner: these are somebody
          else's words run through a machine, and a page that shows them without
          saying so is passing off a guess as a quote. Hidden on a phone for
          room — the button already reads "Voir l'original" there. */}
      {status === "done" && showing && (
        <span
          className={`hidden truncate text-[13px] leading-[18px] sm:inline ${MUTED}`}
          role="status"
        >
          {ctx.translation?.sameLanguage ? t.translate.same : t.translate.auto}
        </span>
      )}

      {/* A failure stays visible at every width: nothing else on the page would
          explain why pressing the button did nothing. */}
      {status === "failed" && (
        <span className={`truncate text-[13px] leading-[18px] ${MUTED}`} role="status">
          {t.translate.failed}
        </span>
      )}
    </span>
  );
}
