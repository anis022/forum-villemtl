"use client";

import { useCallback, useRef, useState } from "react";
import { formatMeetingDate, formatTimestamp, youtubeDeepLink } from "@/utils/council";
import type { Citation } from "@/utils/council-agent";
import { dateLocale, getDictionary, type Locale } from "@/utils/i18n";
import { BTN_PRIMARY, CARD, CHIP, FIELD, MUTED } from "@/components/ui/styles";

/** Set when the answer came from the corpus alone. See the route for why. */
type FallbackReason = "limit" | "quota" | "error";

type Turn = {
  id: number;
  role: "user" | "assistant";
  text: string;
  citations: Citation[];
  fallback: FallbackReason | null;
  error: string | null;
};

type StreamLine =
  | { t: "tool"; v: string }
  | { t: "d"; v: string }
  | { t: "fallback"; v: FallbackReason }
  | { t: "cites"; v: Citation[] };

function PlayIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M10 8l6 4-6 4V8z" />
      <path
        d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

const SOURCE_LINK =
  "-mx-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-[8px] px-2 text-[14px] font-bold text-[#fa3250] hover:underline";

/** The model writes these. Everything else in the answer is prose. */
const MARKER = /\[(\d{1,3})\]/g;
/** A marker still arriving, a character at a time: "[", "[1", "[12". */
const HALF_MARKER = /\[\d{0,3}$/;
/** The model writes "le 4 mai [3]", and a marker floating off its word reads
 *  as a stray figure rather than as a reference. */
const SPACE_BEFORE_MARKER = / +(?=\[\d{1,3}\])/g;

const MARK =
  "ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-[5px] bg-[#fde8eb] px-1 align-[3px] text-[11px] font-bold leading-[16px] text-[#fa3250] no-underline hover:bg-[#fa3250] hover:text-white";

/**
 * How many markers may sit together before the rest are folded away.
 *
 * A count is honestly backed by as many rows as there are people counted, so
 * "nine residents raised it" really does rest on nine. Printed inline that is a
 * row of nine pink chips wrapping across two lines, which stops being a
 * reference and becomes a barcode. The model is asked for all of them on
 * purpose; folding is the reader's side of that bargain, and nothing is lost
 * because every one of them is in the panel.
 */
const MAX_RUN = 3;

type Token = { kind: "text"; value: string } | { kind: "mark"; at: number };

/**
 * One paragraph of an answer, with its markers turned into buttons.
 *
 * While the words are still arriving there is no source list yet, so markers
 * are dropped rather than shown: a number that does not point anywhere is worse
 * than no number, and they come back a second later attached to a passage.
 *
 * A marker the server did not send a source for is dropped too. That is the
 * whole guarantee of this feature, that every number in an answer resolves to a
 * row somebody can go and check.
 */
function Prose({
  text,
  at,
  lang,
  onPick,
}: {
  text: string;
  at: Map<number, number>;
  lang: Locale;
  onPick: (i: number) => void;
}) {
  const t = getDictionary(lang).council;

  const clean =
    at.size === 0
      ? text.replace(SPACE_BEFORE_MARKER, "").replace(MARKER, "").replace(HALF_MARKER, "")
      : text.replace(SPACE_BEFORE_MARKER, "");

  // `split` on a capturing group alternates text, capture, text, so the odd
  // positions are the numbers themselves.
  const tokens: Token[] = [];
  clean.split(MARKER).forEach((piece, i) => {
    if (i % 2 === 0) {
      if (piece) tokens.push({ kind: "text", value: piece });
      return;
    }
    const shown = at.get(Number(piece));
    if (shown !== undefined) tokens.push({ kind: "mark", at: shown });
  });

  const out: React.ReactNode[] = [];

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (token.kind === "text") {
      out.push(token.value);
      i += 1;
      continue;
    }

    // Everything the model wrote back to back, now genuinely adjacent: the
    // spaces between markers were stripped above.
    const run: number[] = [];
    while (i < tokens.length && tokens[i].kind === "mark") {
      run.push((tokens[i] as { kind: "mark"; at: number }).at);
      i += 1;
    }

    for (const shown of run.slice(0, MAX_RUN)) {
      out.push(
        <button
          key={`${shown}-${out.length}`}
          type="button"
          onClick={() => onPick(shown)}
          className={MARK}
          aria-label={t.sourceNumber(shown)}
        >
          {shown}
        </button>,
      );
    }

    const folded = run.slice(MAX_RUN);
    if (folded.length > 0) {
      out.push(
        <button
          key={`plus-${out.length}`}
          type="button"
          onClick={() => onPick(folded[0])}
          className={MARK}
          aria-label={t.moreSources(folded.length)}
          title={t.moreSources(folded.length)}
        >
          +{folded.length}
        </button>,
      );
    }
  }

  return <>{out}</>;
}

/** One row of the panel: what was said, by whom, when, and where to hear it. */
function Source({
  c,
  lang,
  lit,
}: {
  c: Citation;
  lang: Locale;
  lit: boolean;
}) {
  const t = getDictionary(lang).council;
  const kinds: Record<string, string> = t.kinds;

  return (
    <li
      id={`appui-${c.i}`}
      className={`flex min-w-0 gap-3 scroll-mt-24 rounded-[10px] p-2 transition-colors ${
        lit ? "bg-[#fde8eb]" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-[#fde8eb] text-[12px] font-bold leading-none text-[#fa3250] tabular-nums"
      >
        {c.i}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-[12px] font-bold uppercase tracking-wide ${MUTED}`}>
          <span className="sr-only">{t.sourceNumber(c.i)}. </span>
          {kinds[c.kind] ?? c.kind}
        </p>
        <p className="mt-0.5 text-[15px] leading-[22px] break-words">
          <span className="font-bold">{formatMeetingDate(c.date, lang, dateLocale(lang))}</span>
          {c.who && <span>, {c.who}</span>}
        </p>
        {c.what && <p className={`text-[14px] leading-[21px] break-words ${MUTED}`}>{c.what}</p>}

        {c.quote && (
          <blockquote className="mt-2 border-l-2 border-[#e9e0d6] pl-3 text-[15px] leading-[24px] break-words">
            « {c.quote} »
          </blockquote>
        )}

        <span className="flex flex-wrap items-center gap-x-4">
          {c.startS !== null ? (
            <a
              href={youtubeDeepLink(c.youtubeId, c.startS)}
              target="_blank"
              rel="noreferrer"
              className={SOURCE_LINK}
              aria-label={`${t.watch}, ${formatTimestamp(c.startS)}`}
            >
              <PlayIcon />
              <span className="tabular-nums">{formatTimestamp(c.startS)}</span>
            </a>
          ) : c.kind === "meeting" ? (
            <a
              href={youtubeDeepLink(c.youtubeId, 0)}
              target="_blank"
              rel="noreferrer"
              className={SOURCE_LINK}
            >
              <PlayIcon />
              {t.watch}
            </a>
          ) : (
            <span className={`min-h-[40px] py-[10px] text-[13px] leading-[20px] ${MUTED}`}>
              {t.noMoment}
            </span>
          )}

          {c.pvUrl && (
            <a href={c.pvUrl} target="_blank" rel="noreferrer" className={SOURCE_LINK}>
              <DocIcon />
              {t.readPv}
            </a>
          )}
        </span>
      </div>
    </li>
  );
}

/**
 * The conversation, and beside it what the last answer rests on.
 *
 * These used to be one column: three lines of prose, then a rule, then eight
 * passages, then the next question. That is not a conversation. Every answer
 * pushed its own evidence between itself and the follow-up, so a thread of
 * three questions was thirty screens and the thing being discussed kept
 * scrolling out of reach.
 *
 * They are two different kinds of reading and they now get two places. On the
 * left it reads like a chat, and the answer keeps only its numbers. On the
 * right the numbers resolve, in a panel that stays put while the conversation
 * moves. Narrow screens have no right, so the panel sits under the exchange and
 * above the box, which is where somebody who has just read an answer is looking.
 */
export function CouncilChat({ lang }: { lang: Locale }) {
  const t = getDictionary(lang).council;
  const toolLines: Record<string, string> = t.tools;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [activity, setActivity] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");

  // Which answer the panel is showing. It follows the newest answer, and a
  // reader can send it back to an earlier one by clicking a marker there.
  const [shown, setShown] = useState<number | null>(null);
  const [lit, setLit] = useState<number | null>(null);

  const box = useRef<HTMLTextAreaElement | null>(null);
  const nextId = useRef(0);

  // The answer arrives a word at a time, so the turn is patched by id rather
  // than by position: anything that reorders the list while a response is in
  // flight would otherwise write those words into the wrong answer.
  const patch = useCallback((id: number, change: (turn: Turn) => Turn) => {
    setTurns((all) => all.map((turn) => (turn.id === id ? change(turn) : turn)));
  }, []);

  const grow = useCallback(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  /** Bring a source into view and mark it, from a marker in the prose. */
  const pick = useCallback((turnId: number, i: number) => {
    setShown(turnId);
    setLit(i);
    // After the panel has re-rendered on the turn that was just chosen.
    requestAnimationFrame(() => {
      document.getElementById(`appui-${i}`)?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || busy) return;

      const answerId = nextId.current + 1;
      const asked: Turn = {
        id: nextId.current,
        role: "user",
        text,
        citations: [],
        fallback: null,
        error: null,
      };
      const answer: Turn = {
        id: answerId,
        role: "assistant",
        text: "",
        citations: [],
        fallback: null,
        error: null,
      };
      nextId.current += 2;

      // An answer that failed left an empty turn behind. Sending it would put
      // an empty assistant message in the history, which no model accepts.
      const history = [
        ...turns
          .filter((turn) => turn.text)
          .map((turn) => ({ role: turn.role, content: turn.text })),
        { role: "user" as const, content: text },
      ];

      setTurns((all) => [...all, asked, answer]);
      setDraft("");
      setBusy(true);
      setActivity(t.thinking);
      setLit(null);
      requestAnimationFrame(grow);

      try {
        const response = await fetch("/api/conseils/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang, messages: history }),
        });

        if (!response.ok || !response.body) {
          patch(answerId, (turn) => ({ ...turn, error: t.network }));
          return;
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let carry = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          carry += value;

          // Whatever follows the last newline is half a line. It waits here
          // until the rest of it arrives.
          const lines = carry.split("\n");
          carry = lines.pop() ?? "";

          for (const line of lines) {
            if (!line) continue;
            const part = JSON.parse(line) as StreamLine;

            if (part.t === "tool") {
              setActivity(toolLines[part.v] ?? t.thinking);
            } else if (part.t === "d") {
              setActivity(null);
              patch(answerId, (turn) => ({ ...turn, text: turn.text + part.v }));
            } else if (part.t === "fallback") {
              // Half an answer that then failed is not half true, it is
              // unfinished. What arrived before the failure is dropped rather
              // than left standing above passages that do not back it.
              setActivity(null);
              patch(answerId, (turn) => ({ ...turn, text: "", fallback: part.v }));
            } else {
              patch(answerId, (turn) => ({ ...turn, citations: part.v }));
              if (part.v.length > 0) setShown(answerId);
            }
          }
        }
      } catch {
        patch(answerId, (turn) => ({ ...turn, error: t.network }));
      } finally {
        setActivity(null);
        setBusy(false);
      }
    },
    [busy, grow, lang, patch, t, toolLines, turns],
  );

  const panel = turns.find((turn) => turn.id === shown) ?? null;

  return (
    // Two independent columns at width, one stack below it. `contents` is what
    // lets the same three elements do both: on a phone the wrapper dissolves,
    // so the conversation, the panel and the box are siblings that `order` can
    // arrange as exchange, evidence, box. At `lg` the wrapper becomes a real
    // column again, which is the only way the panel's height stops dictating
    // where the box sits. A grid cannot do this: a tall cell in a shared row
    // pushes everything in the neighbouring cell down with it.
    <div className="flex min-w-0 flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <div className="contents lg:block lg:min-w-0 lg:max-w-[760px] lg:flex-1">
        {/* The conversation. Capped at a reading measure even though the column
            is wider: past about seventy characters a line tires. */}
        <div className="order-1 min-w-0">
        {turns.length === 0 ? (
          <div className={`${CARD} p-5 sm:p-6`}>
            <p className="text-[17px] leading-[26px] break-words">{t.emptyLead}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => ask(example)}
                  className={`${CHIP} max-w-full text-left`}
                >
                  <span className="min-w-0 break-words">{example}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-7">
            {turns.map((turn) => {
              if (turn.role === "user") {
                return (
                  <div key={turn.id} className="flex justify-end">
                    <p className="min-w-0 max-w-[520px] rounded-[16px] bg-[#e8e8f6] px-4 py-3 text-[16px] leading-[24px] whitespace-pre-wrap break-words text-[#2a2a86]">
                      {turn.text}
                    </p>
                  </div>
                );
              }

              const at = new Map(turn.citations.map((c) => [c.n, c.i]));

              const fallbackLine =
                turn.fallback === "quota"
                  ? t.fallbackQuota
                  : turn.fallback === "limit"
                    ? t.fallbackLimit
                    : turn.fallback
                      ? t.fallbackError
                      : null;

              return (
                <div key={turn.id} className="min-w-0">
                  {turn.text
                    .split(/\n{2,}/)
                    .filter((para) => para.trim())
                    .map((para, i) => (
                      <p
                        key={i}
                        className="mt-3 text-[17px] leading-[27px] whitespace-pre-wrap break-words first:mt-0"
                      >
                        <Prose
                          text={para.trim()}
                          at={at}
                          lang={lang}
                          onPick={(source) => pick(turn.id, source)}
                        />
                      </p>
                    ))}

                  {/* Said in the reader's own column rather than in an alert
                      box. Nothing has gone wrong for them: the archive is right
                      there, and the only thing missing is a paragraph. */}
                  {fallbackLine && (
                    <p
                      className={`text-[17px] leading-[27px] break-words ${MUTED}`}
                      role="status"
                      aria-live="polite"
                    >
                      {fallbackLine}
                    </p>
                  )}

                  {turn.error && (
                    <p className={`text-[15px] leading-[23px] break-words ${MUTED}`} role="status">
                      {turn.error}
                    </p>
                  )}

                  {turn.fallback && turn.citations.length === 0 && (
                    <p className={`mt-3 text-[15px] leading-[23px] break-words ${MUTED}`}>
                      {t.nothingFound}
                    </p>
                  )}

                  {/* An older answer keeps a way back to its own evidence, so
                      the panel showing the newest one costs nothing. */}
                  {turn.citations.length > 0 && turn.id !== shown && (
                    <button
                      type="button"
                      onClick={() => pick(turn.id, turn.citations[0].i)}
                      className={`mt-2 rounded-[8px] text-[14px] font-bold text-[#fa3250] hover:underline`}
                    >
                      {t.sourceCount(turn.citations.length)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* One quiet line saying what is going on, driven off the tool the model
            just started calling. It goes the moment the first word of the answer
            arrives, so nothing is ever claimed after it has stopped being true. */}
        {activity && (
          <p className={`mt-6 text-[15px] leading-[23px] ${MUTED}`} role="status" aria-live="polite">
            {activity}
          </p>
        )}
        </div>

      {/* The box. Third on a phone, so the reading order is exchange, evidence,
          then the place to ask the next one. */}
      <form
        className="order-3 min-w-0 lg:mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <label className="sr-only" htmlFor="council-chat-question">
          {t.placeholder}
        </label>
        <textarea
          id="council-chat-question"
          ref={box}
          rows={2}
          value={draft}
          placeholder={t.placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
            grow();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            ask(draft);
          }}
          className={`${FIELD} resize-none`}
        />

        {/* Hint and button on one row, allowed to stack: at 320px the sentence
            and the button together are wider than the screen. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className={`min-w-0 text-[13px] leading-[19px] ${MUTED}`}>{t.hint}</p>
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className={`${BTN_PRIMARY} shrink-0`}
          >
            {busy ? t.sending : t.send}
          </button>
        </div>
      </form>
      </div>

      {/* What the shown answer rests on. Beside the conversation and staying
          put while it moves; under the exchange on a phone, where there is no
          beside. */}
      <aside className="order-2 min-w-0 lg:sticky lg:top-6 lg:w-[360px] lg:shrink-0">
        <div className={`${CARD} p-4 sm:p-5`}>
          <h2 className={`text-[12px] font-bold uppercase tracking-wide ${MUTED}`}>
            {panel?.fallback ? t.passagesTitle : t.sources}
          </h2>

          {panel && panel.citations.length > 0 ? (
            <ul className="mt-3 -mx-2 space-y-4 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
              {panel.citations.map((c) => (
                <Source key={c.key} c={c} lang={lang} lit={c.i === lit} />
              ))}
            </ul>
          ) : (
            <p className={`mt-2 text-[15px] leading-[23px] ${MUTED}`}>{t.sourcesPlaceholder}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
