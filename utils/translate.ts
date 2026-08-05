import { unstable_cache } from "next/cache";
import type { Locale } from "@/utils/i18n";

/**
 * Machine translation for resident-written text.
 *
 * The forum shows every post in the language it was written in — that is the
 * point, a neighbour's words are a neighbour's words — and this turns one of
 * them into the reader's language on request, never by default.
 *
 * Google's `translate_a/t` endpoint, the one Chrome's own dictionary extension
 * calls. It needs no key and no account, which is the whole reason it is here:
 * a borough forum should not have to hold a billing relationship to let a
 * resident read their neighbour.
 *
 * It is worth being clear about what that costs. This endpoint is undocumented
 * and unsupported — Google can change or close it without notice, it rate
 * limits by IP, and shared serverless egress is exactly the kind of address
 * that gets throttled first. Everything here is built for that: one request per
 * post per language ever, thanks to the cache below; a short timeout; and a
 * null return that the button turns into "translation unavailable" rather than
 * a broken page. If it stops working, the swap is this one file.
 */
const ENDPOINT = "https://clients5.google.com/translate_a/t";

/** `dict-chrome-ex` is not decoration — any other client value answers 403. */
const CLIENT = "dict-chrome-ex";

/** Both are already the database's own limits; re-applied here as a ceiling. */
const MAX_TITLE = 200;
const MAX_BODY = 5000;

/** A reader is watching a spinner. Better to say "unavailable" than to hang. */
const TIMEOUT_MS = 8000;

export type Translation = {
  title: string | null;
  body: string;
  /**
   * The text was already in the language asked for. Worth saying out loud: a
   * reader who presses Traduire and gets back what looks like the same words
   * should be told why, not left thinking the button is broken.
   */
  sameLanguage: boolean;
};

type Rendered = { text: string; source: string | null };

/**
 * The endpoint answers in two shapes. Plain sentences come back as
 * `[[translated, detectedSource]]`; a single dictionary word instead returns an
 * object carrying `sentences[]` and `src`. Both are handled — a one-word
 * comment is not a rare thing on a forum.
 */
function parse(payload: unknown): Rendered | null {
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (Array.isArray(first) && typeof first[0] === "string") {
      return { text: first[0], source: typeof first[1] === "string" ? first[1] : null };
    }
    return null;
  }

  if (payload && typeof payload === "object") {
    const object = payload as { sentences?: { trans?: string }[]; src?: string };
    if (Array.isArray(object.sentences)) {
      const text = object.sentences.map((s) => s.trans ?? "").join("");
      if (text) return { text, source: object.src ?? null };
    }
  }

  return null;
}

async function fetchOne(text: string, target: Locale): Promise<Rendered | null> {
  const url = `${ENDPOINT}?client=${CLIENT}&sl=auto&tl=${target}&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      // The result is cached by `unstable_cache` below, keyed on the text
      // itself. Letting fetch cache it as well would be a second copy of the
      // same answer under a key nothing can reason about.
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parse(await response.json());
  } catch {
    // A timeout, a 429, a closed endpoint — all the same to the reader, and all
    // recoverable by pressing the button again later.
    return null;
  }
}

async function run(
  title: string | null,
  body: string,
  target: Locale,
): Promise<Translation | null> {
  const safeTitle = title === null ? null : title.slice(0, MAX_TITLE);
  const safeBody = body.slice(0, MAX_BODY);

  // In parallel, and the title is not allowed to sink the request: a post whose
  // body translated fine should not come back empty because five words in the
  // heading confused the detector.
  const [translatedBody, translatedTitle] = await Promise.all([
    fetchOne(safeBody, target),
    safeTitle ? fetchOne(safeTitle, target) : Promise.resolve(null),
  ]);

  if (!translatedBody) return null;

  return {
    title: safeTitle === null ? null : (translatedTitle?.text ?? safeTitle),
    // Detected off the body rather than the title: three words in a heading are
    // not enough to tell French from English, and the body is what the reader
    // came for.
    sameLanguage: translatedBody.source === target,
    body: translatedBody.text,
  };
}

/**
 * Cached on the text itself, so the second person to ask for a translation of
 * the same post pays nothing — and so an edited post is a different key and
 * gets translated again rather than serving the old words. On an endpoint that
 * rate limits by IP, this is not an optimisation, it is what makes the feature
 * viable at all.
 *
 * `unstable_cache` rather than `use cache`: the latter needs Cache Components
 * turned on for the whole application, which changes how every page in this
 * repo renders. That is a migration, not a translate button.
 */
export const translate = unstable_cache(run, ["translate-v1"], { revalidate: false });
