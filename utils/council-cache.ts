import { getCache } from "@vercel/functions";
import type { Citation } from "@/utils/council-agent";

/**
 * What keeps a free allowance from being spent by lunchtime.
 *
 * The model behind this tab is on a free tier, which is metered in requests per
 * day for the whole site rather than per visitor. One question costs several
 * requests, because the agent searches, sometimes searches again, then writes.
 * So a few hundred requests a day is not a few hundred questions, and with no
 * idea how many people will arrive, the allowance has to be defended rather
 * than merely spent.
 *
 * Two defences, both free:
 *
 *   1. An answer already written is never written twice. The corpus is fixed,
 *      six sittings that do not change between ingests, and residents ask each
 *      other's questions: parking, snow, housing, the same street. A cached
 *      answer costs nothing and returns instantly.
 *   2. One visitor cannot drain the day for everybody else.
 *
 * Neither is a wall. Whatever these turn away falls through to the corpus
 * search, which has no allowance to defend.
 */

/** Regional and per-environment. A miss costs a question, never a wrong answer. */
function store() {
  try {
    return getCache({ namespace: "conseils" });
  } catch {
    // No cache in this context. Everything degrades to "not cached", which is
    // slower and correct.
    return null;
  }
}

export type CachedAnswer = { text: string; citations: Citation[] };

/**
 * The same question, asked the way people actually vary it.
 *
 * Case, accents, spacing and final punctuation are noise here: "Déneigement?"
 * and "deneigement" are one question and should not cost two. Anything beyond
 * that is left alone, because two questions that differ by a word usually
 * differ by intent.
 */
function normalise(question: string): string {
  return question
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 300);
}

/** A month. Shorter than the gap between ingests, longer than a news cycle. */
const ANSWER_TTL = 60 * 60 * 24 * 30;

/** Purge with `vercel cache invalidate --tag conseils-answers` after an ingest. */
export const ANSWERS_TAG = "conseils-answers";

export async function cachedAnswer(
  lang: string,
  question: string,
): Promise<CachedAnswer | null> {
  const cache = store();
  if (!cache) return null;

  try {
    const hit = await cache.get(`answer:${lang}:${normalise(question)}`);
    if (!hit || typeof hit !== "object") return null;
    const value = hit as CachedAnswer;
    return typeof value.text === "string" && Array.isArray(value.citations) ? value : null;
  } catch {
    return null;
  }
}

export async function rememberAnswer(
  lang: string,
  question: string,
  answer: CachedAnswer,
): Promise<void> {
  const cache = store();
  if (!cache) return;

  try {
    await cache.set(`answer:${lang}:${normalise(question)}`, answer, {
      ttl: ANSWER_TTL,
      tags: [ANSWERS_TAG],
      name: "conseils-answer",
    });
  } catch {
    // A cache that will not write is a cache miss next time. Not worth failing
    // a request somebody is waiting on.
  }
}

/**
 * Who is asking, as coarsely as the job allows.
 *
 * The forwarded address is the only handle a route has on "one visitor", and it
 * is a poor one: a household shares it, and a determined person changes it. It
 * is not used to identify anybody and is never stored, only counted against for
 * the length of a day, which is all that is needed to stop one open tab from
 * spending everyone's allowance.
 */
export function askerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "inconnu";
}

/** Enough to explore, not enough to exhaust a shared day. */
const PER_MINUTE = 5;
const PER_DAY = 40;

async function bump(cache: NonNullable<ReturnType<typeof store>>, key: string, ttl: number) {
  const seen = await cache.get(key);
  const count = typeof seen === "number" ? seen + 1 : 1;
  // Not atomic, and it does not need to be: two requests racing on the same
  // second undercount by one, which is a rounding error against a limit whose
  // exact value is already a judgement call.
  await cache.set(key, count, { ttl, name: "conseils-rate" });
  return count;
}

/**
 * True when this asker may spend a model call.
 *
 * False is not an error and the caller must not treat it as one: it means the
 * question gets answered from the corpus instead.
 */
export async function mayAskTheModel(asker: string): Promise<boolean> {
  const cache = store();
  if (!cache) return true;

  const day = new Date().toISOString().slice(0, 10);
  const minute = Math.floor(Date.now() / 60_000);

  try {
    const [burst, daily] = await Promise.all([
      bump(cache, `rate:${asker}:${minute}`, 120),
      bump(cache, `rate:${asker}:${day}`, 60 * 60 * 24),
    ]);
    return burst <= PER_MINUTE && daily <= PER_DAY;
  } catch {
    // A counter that cannot be read is not a reason to refuse somebody.
    return true;
  }
}
