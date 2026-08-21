import { translate } from "@/utils/translate";
import { type Locale } from "@/utils/i18n";

/**
 * The other language, for a post the borough office publishes.
 *
 * Called after the row is written, by whichever action wrote it — creating a
 * topic, creating a poll, or editing either. Three callers, one rule, expressed
 * once: an official post is stored in both languages, a resident's is not.
 *
 * Never allowed to fail a publication. A post whose translation did not arrive
 * is a post in one language with a Traduire button, which is exactly what the
 * whole forum was before this; a post that refused to save because an
 * undocumented Google endpoint rate-limited the server is a resident's evening
 * wasted. So every failure here returns null and the caller carries on.
 */

export type StoredTranslation = {
  translated_title: string | null;
  translated_body: string;
  translated_to: Locale;
};

/**
 * Translate into the language the post is *not* in.
 *
 * `written` is the locale of the composer the author was using, which is a good
 * guess at the language they typed in and wrong often enough to check: somebody
 * writes English in the French interface every day. So the opposite is tried
 * first, and `sameLanguage` coming back true means the guess was backwards —
 * the endpoint detected the source itself and is telling us the text was
 * already in the target. Then the other direction is tried, and that one cannot
 * be wrong, because there are only two.
 */
export async function translateForOffice(
  title: string | null,
  body: string,
  written: Locale,
): Promise<StoredTranslation | null> {
  const other: Locale = written === "fr" ? "en" : "fr";

  try {
    const first = await translate(title, body, other);
    if (first && !first.sameLanguage) {
      return { translated_title: first.title, translated_body: first.body, translated_to: other };
    }

    const second = await translate(title, body, written);
    if (second && !second.sameLanguage) {
      return {
        translated_title: second.title,
        translated_body: second.body,
        translated_to: written,
      };
    }
  } catch (error) {
    console.error("[translation] official post:", error);
  }

  return null;
}

/**
 * What to write when a post stops being translatable, or never was.
 *
 * An edit rewrites these columns whether or not it produced a translation. A
 * stale translation is worse than none: the reader is served it as though it
 * were the post, so a corrected title would go on reading in its old wording in
 * one of the two languages, and nothing on the page would say so.
 */
export const NO_TRANSLATION = {
  translated_title: null,
  translated_body: null,
  translated_to: null,
} as const;
