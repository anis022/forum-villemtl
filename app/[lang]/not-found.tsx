"use client";

import { useParams } from "next/navigation";
import { DEFAULT_LOCALE, getDictionary, isLocale } from "@/utils/i18n";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, MUTED, PAGE_MAIN, PAGE_SHELL } from "@/components/ui/styles";

/**
 * What a reader sees when the thing at this address is gone.
 *
 * There was no boundary, so every `notFound()` in the app fell through to
 * Next's own page: the word "404" and "This page could not be found." on bare
 * white, in English whatever language the reader was in, with no header, no
 * footer and no link back. The commonest way to arrive there is not a typo. It
 * is following a shared link to a topic somebody has since taken down, which
 * means the people most likely to see it are the ones who were invited.
 *
 * A client component, because `not-found.tsx` is handed no props and the
 * `[lang]` above it is the only honest source for the reader's language. A
 * server version has to guess from the `locale` cookie and `accept-language`,
 * and that hands somebody reading /en a page in French. Nothing is lost by
 * rendering on the client: the initial HTML for this boundary is Next's own
 * either way, because the root layout is a dynamic `[lang]` segment and the
 * not-found content is not part of the streamed shell, and Next marks every
 * 404 `noindex`, so no crawler is being shown the wrong words.
 */
export default function NotFound() {
  const params = useParams<{ lang?: string }>();
  const lang = isLocale(params?.lang ?? "") ? (params.lang as "fr" | "en") : DEFAULT_LOCALE;
  const t = getDictionary(lang);

  return (
    <div className={PAGE_SHELL}>
      <main className={PAGE_MAIN}>
        <div className={`${CARD} mx-auto max-w-[560px] p-6 text-center md:p-10`}>
          <h1 className="text-[22px] font-bold leading-[30px]">{t.notFoundPage.title}</h1>
          <p className={`mt-2 ${MUTED}`}>{t.notFoundPage.body}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <a className={BTN_PRIMARY} href={`/${lang}`}>
              {t.notFoundPage.home}
            </a>
            <a className={BTN_SECONDARY} href={`/${lang}/projets`}>
              {t.notFoundPage.projects}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
