"use client";

import { useEffect } from "react";
import { getDictionary, isLocale, DEFAULT_LOCALE } from "@/utils/i18n";
import { useParams } from "next/navigation";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, MUTED, PAGE_MAIN, PAGE_SHELL } from "@/components/ui/styles";

/**
 * What a reader sees when something under this route throws.
 *
 * There was no boundary at all, so every failure fell through to Next's own
 * fallback: "This page couldn't load. Reload to try again, or go back.", in
 * English whatever language the reader was in, on a site whose whole obligation
 * is to be bilingual, and with no sign of where they were.
 *
 * The header and footer stay, because they are how somebody gets out of here.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ lang?: string }>();
  const lang = isLocale(params?.lang ?? "") ? (params.lang as "fr" | "en") : DEFAULT_LOCALE;
  const t = getDictionary(lang);

  // Nothing is sent anywhere: there is no error reporting on this project yet,
  // and the console is where the one person maintaining it will look.
  useEffect(() => {
    console.error("[route]", error);
  }, [error]);

  return (
    <div className={PAGE_SHELL}>
      <main className={PAGE_MAIN}>
        <div className={`${CARD} mx-auto max-w-[560px] p-6 text-center md:p-10`}>
          <h1 className="text-[22px] font-bold leading-[30px]">{t.errorPage.title}</h1>
          <p className={`mt-2 ${MUTED}`}>{t.errorPage.body}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" className={BTN_PRIMARY} onClick={reset}>
              {t.errorPage.retry}
            </button>
            <a className={BTN_SECONDARY} href={`/${lang}`}>
              {t.errorPage.home}
            </a>
          </div>
          {/*
            Next hashes the server-side error and puts the same string in the
            runtime log and on this object, so it is the one identifier a
            reader and a log search can both hold. Showing it is what turns
            "it didn't work" into a line somebody can find: an elected member
            lost a post to a 1 MB upload cap, and the digest that named it
            expired an hour later, unread.

            Absent when the throw happened in the browser rather than on the
            server, so the whole block goes rather than showing a bare label.
          */}
          {error.digest ? (
            <p className={`mt-5 text-[13px] leading-[20px] ${MUTED}`}>
              {t.errorPage.reference} <code className="font-mono">{error.digest}</code>
              <br />
              {t.errorPage.referenceHint}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
