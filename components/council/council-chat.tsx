"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatMeetingDate, formatTimestamp, youtubeDeepLink } from "@/utils/council";
import type { Citation } from "@/utils/council-agent";
import { dateLocale, getDictionary, type Locale } from "@/utils/i18n";
import { MUTED } from "@/components/ui/styles";

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

/**
 * The model writes these. Everything else in the answer is prose.
 *
 * A run of them comes through as `[1][2][3]` from one model and `[1,2,3]` from
 * the next. Both are read, because the alternative is that swapping the model
 * behind this page quietly turns every reference in every answer back into
 * plain text nobody can click.
 */
const MARKER = /\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g;
/** A marker still arriving, a character at a time: "[", "[1", "[1,", "[1,2". */
const HALF_MARKER = /\[[\d,\s]*$/;
/**
 * The model writes "le 4 mai [3]", and a marker floating off its word reads as
 * a stray figure rather than as a reference.
 *
 * Never after a digit, though. "le 4 mai 2026 [1]" closed up is a chip pressed
 * against a year, and the reader is looking at what appears to be the number
 * 20261. The chip has its own background and would survive on screen, but an
 * answer somebody copies into an email is plain text, and there it is simply
 * wrong. A date keeps its space.
 */
const SPACE_BEFORE_MARKER = /(?<!\d) +(?=\[\d{1,3}(?:\s*,\s*\d{1,3})*\])/g;

/**
 * What a model reaches for when it forgets it is not writing a document.
 *
 * The prompt asks for two or three sentences of plain prose and no formatting,
 * and mostly gets it. Mostly is not a rendering strategy: asked to name
 * fourteen people, a model reads that as a job for a bulleted list with every
 * name in bold, and the page has no markdown renderer, so the reader gets a
 * screenful of literal asterisks. Rather than a parser for a syntax nobody
 * asked for, these cover the two things that actually show up, and the bold is
 * honoured rather than stripped: when a model does list fourteen names, the
 * names are genuinely the thing worth seeing first.
 */
const BOLD = /\*\*(.+?)\*\*/g;
const BULLET = /^[ \t]*[-*+][ \t]+/gm;

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

type Token = { kind: "text"; value: string; strong?: boolean } | { kind: "mark"; at: number };

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

  const marked = text.replace(SPACE_BEFORE_MARKER, "").replace(BULLET, "• ");
  const clean =
    at.size === 0 ? marked.replace(MARKER, "").replace(HALF_MARKER, "") : marked;

  // `split` on a capturing group alternates text, capture, text, so the odd
  // positions are the numbers themselves. One capture can hold several of them,
  // which is the `[1,2,3]` shape; each becomes its own chip, so a run reads the
  // same however the model happened to punctuate it. The same trick a second
  // time inside each run of text, for the pairs of asterisks.
  const tokens: Token[] = [];
  clean.split(MARKER).forEach((piece, i) => {
    if (i % 2 === 0) {
      piece.split(BOLD).forEach((run, j) => {
        if (run) tokens.push({ kind: "text", value: run, strong: j % 2 === 1 });
      });
      return;
    }
    for (const n of piece.split(",")) {
      const shown = at.get(Number(n.trim()));
      if (shown !== undefined) tokens.push({ kind: "mark", at: shown });
    }
  });

  const out: React.ReactNode[] = [];

  for (let i = 0; i < tokens.length; ) {
    const token = tokens[i];
    if (token.kind === "text") {
      out.push(
        token.strong ? (
          <strong key={`b-${out.length}`} className="font-bold">
            {token.value}
          </strong>
        ) : (
          token.value
        ),
      );
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
  idPrefix,
}: {
  c: Citation;
  lang: Locale;
  lit: boolean;
  idPrefix: string;
}) {
  const t = getDictionary(lang).council;
  const kinds: Record<string, string> = t.kinds;

  return (
    <li
      id={`${idPrefix}-${c.i}`}
      className={`flex min-w-0 gap-3 scroll-mt-4 rounded-[12px] border p-3.5 transition-colors ${
        lit
          ? "border-[#f4a8b4] bg-[#fff5f6]"
          : "border-[#e9e2dc] bg-white hover:border-[#d2c8bf]"
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

        {/* Guillemets only where somebody is known to have said the words.
            A question row prints a name and then the recording around that
            name, which holds the chair, the resident and the borough's answer
            with nothing marking the changes. Wrapping that in quotation marks
            under the resident's name is the site asserting they said it, and
            for the length of a reply that is somebody else's words in their
            mouth. Unquoted, and captioned for what it is. */}
        {c.quote &&
          (c.attributed ? (
            <blockquote className="mt-2.5 border-l-2 border-[#d8d2cb] pl-3 text-[14px] leading-[22px] break-words text-[#4f4a50]">
              « {c.quote} »
            </blockquote>
          ) : (
            <div className="mt-2.5 border-l-2 border-[#d8d2cb] pl-3">
              <p className="text-[14px] leading-[22px] break-words text-[#4f4a50]">{c.quote}</p>
              <p className={`mt-1 text-[12px] leading-[18px] ${MUTED}`}>{t.aroundMoment}</p>
            </div>
          ))}

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
export function CouncilChat({ lang, canAsk }: { lang: Locale; canAsk: boolean }) {
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

  // Ten sources are four thousand pixels. Beside the conversation that is a
  // column; under it on a phone it is a wall between the answer and the box for
  // the next question, so there the panel starts folded. A scroller inside the
  // card would be the other way out and a worse one: a nested scroller on a
  // phone swallows the drag and the page feels stuck.
  const [wide, setWide] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const box = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation) return;
    conversation.scrollTo({ top: conversation.scrollHeight, behavior: busy ? "smooth" : "auto" });
  }, [activity, busy, turns]);

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
    setOpen(true);
    // After the panel has re-rendered on the turn that was just chosen, and
    // unfolded if it was folded.
    requestAnimationFrame(() => {
      const prefix = window.matchMedia("(min-width: 1024px)").matches
        ? "desktop-appui"
        : "mobile-appui";
      document.getElementById(`${prefix}-${i}`)?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!canAsk || !text || busy) return;

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
    [busy, canAsk, grow, lang, patch, t, toolLines, turns],
  );

  const panel = turns.find((turn) => turn.id === shown) ?? null;

  const sourceTitle = panel?.fallback ? t.passagesTitle : t.sources;
  const sourceList = (idPrefix: string) =>
    panel && panel.citations.length > 0 ? (
      <ul className="space-y-3">
        {panel.citations.map((citation) => (
          <Source
            key={citation.key}
            c={citation}
            lang={lang}
            lit={citation.i === lit}
            idPrefix={idPrefix}
          />
        ))}
      </ul>
    ) : (
      <div className="grid min-h-[180px] place-items-center px-6 text-center">
        <p className={`max-w-[32ch] text-[14px] leading-[21px] ${MUTED}`}>
          {t.sourcesPlaceholder}
        </p>
      </div>
    );

  const messages = (
    <>
      {turns.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-[760px] flex-col justify-center py-8">
          <p className="max-w-[650px] text-[20px] font-medium leading-[30px] tracking-[-0.01em] break-words sm:text-[22px] sm:leading-[32px]">
            {t.emptyLead}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {t.examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => ask(example)}
                disabled={!canAsk}
                title={canAsk ? undefined : t.membersOnly}
                className="min-h-[52px] rounded-[12px] border border-[#e4ddd6] bg-[#fffdfb] px-4 py-3 text-left text-[14px] font-medium leading-[20px] text-[#4f4a50] transition-colors hover:border-[#fa3250] hover:bg-[#fff6f7] hover:text-[#1a1a1a] disabled:cursor-not-allowed disabled:hover:border-[#e4ddd6] disabled:hover:bg-[#fffdfb] disabled:hover:text-[#4f4a50]"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[820px] space-y-8 py-2">
          {turns.map((turn) => {
            if (turn.role === "user") {
              return (
                <div key={turn.id} className="flex justify-end">
                  <p className="min-w-0 max-w-[78%] rounded-[18px] rounded-br-[6px] bg-[#e8e8f6] px-4 py-3 text-[16px] leading-[24px] whitespace-pre-wrap break-words text-[#2a2a86] sm:max-w-[620px]">
                    {turn.text}
                  </p>
                </div>
              );
            }

            const at = new Map(turn.citations.map((citation) => [citation.n, citation.i]));
            const fallbackLine =
              turn.fallback === "quota"
                ? t.fallbackQuota
                : turn.fallback === "limit"
                  ? t.fallbackLimit
                  : turn.fallback
                    ? t.fallbackError
                    : null;

            return (
              <div key={turn.id} className="min-w-0 border-l-2 border-[#e9e2dc] pl-4 sm:pl-5">
                {turn.text
                  .split(/\n{2,}/)
                  .filter((paragraph) => paragraph.trim())
                  .map((paragraph, index) => (
                    <p
                      key={index}
                      className="mt-3 text-[17px] leading-[28px] whitespace-pre-wrap break-words first:mt-0"
                    >
                      <Prose
                        text={paragraph.trim()}
                        at={at}
                        lang={lang}
                        onPick={(source) => pick(turn.id, source)}
                      />
                    </p>
                  ))}

                {fallbackLine && (
                  <p className={`text-[17px] leading-[27px] break-words ${MUTED}`} role="status">
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
                {turn.citations.length > 0 && turn.id !== shown && (
                  <button
                    type="button"
                    onClick={() => pick(turn.id, turn.citations[0].i)}
                    className="mt-2 rounded-[8px] text-[14px] font-semibold text-[#fa3250] hover:underline"
                  >
                    {t.sourceCount(turn.citations.length)}
                  </button>
                )}
              </div>
            );
          })}

          {activity && (
            <p className={`border-l-2 border-[#e9e2dc] pl-5 text-[15px] leading-[23px] ${MUTED}`} role="status" aria-live="polite">
              {activity}
            </p>
          )}
        </div>
      )}
    </>
  );

  // Both scrollers are `relative`, and it is not decoration.
  //
  // Every row of the source panel carries an `sr-only` label, and `sr-only` is
  // `position: absolute`. An absolutely positioned element is laid out against
  // its nearest positioned ancestor, and with none it falls all the way through
  // to the initial containing block — which means it is not clipped by any of
  // the `overflow-hidden` wrappers between here and the page root, because none
  // of them is in its containing block chain.
  //
  // The visible effect was that sixteen sources, one of them sitting at 2300px
  // down its own scroller, quietly gave the *document* 1200px of scrollable
  // height on a page built to be exactly one viewport tall. Nothing looked
  // wrong until something scrolled it: `scrollIntoView` on a cited source moves
  // every scrollable ancestor it can find, so clicking a marker slid the whole
  // page up and left the masthead off screen above a band of dead background.
  //
  // One `relative` on each scroller gives those labels a containing block that
  // is already clipped, and the document goes back to being unscrollable.
  //
  // `overscroll-contain` is the other half: reaching the end of either scroller
  // must not hand the gesture to the page behind it.
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_minmax(440px,38%)]">
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white" aria-label={t.title}>
        <div
          ref={conversationRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-8 lg:py-7"
        >
          {messages}

          {panel && panel.citations.length > 0 && (
            <details
              open={!wide && open}
              onToggle={(event) => setOpen(event.currentTarget.open)}
              className="mt-7 rounded-[14px] border border-[#e4ddd6] bg-[#fffdfb] lg:hidden"
            >
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
                <h2 className="text-[13px] font-semibold text-[#373238]">{sourceTitle}</h2>
                <span className="shrink-0 text-[13px] font-semibold text-[#fa3250]">
                  {open ? t.hideSources : t.sourceCount(panel.citations.length)}
                </span>
              </summary>
              <div className="border-t border-[#e9e2dc] p-3">{sourceList("mobile-appui")}</div>
            </details>
          )}
        </div>

        <form
          className="shrink-0 border-t border-[#e9e2dc] bg-[#fffdfb] px-4 py-3 sm:px-6 lg:px-8 lg:py-4"
          onSubmit={(event) => {
            event.preventDefault();
            ask(draft);
          }}
        >
          {!canAsk && (
            <p
              id="council-chat-members-only"
              className="mx-auto mb-2 max-w-[860px] text-[13px] font-semibold leading-[19px] text-[#6e6a72]"
            >
              {t.membersOnly}
            </p>
          )}
          <div className="mx-auto flex max-w-[860px] items-end gap-2 rounded-[15px] border border-[#d8d0c8] bg-white p-2 shadow-[0_3px_12px_rgba(31,22,16,0.06)] focus-within:border-[#fa3250]">
            <label className="sr-only" htmlFor="council-chat-question">
              {t.placeholder}
            </label>
            <textarea
              id="council-chat-question"
              ref={box}
              rows={1}
              value={draft}
              placeholder={canAsk ? t.placeholder : t.membersOnlyPlaceholder}
              disabled={!canAsk}
              aria-describedby={!canAsk ? "council-chat-members-only" : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                grow();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey) return;
                event.preventDefault();
                ask(draft);
              }}
              className="max-h-[160px] min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-[22px] text-[#1a1a1a] outline-none placeholder:text-[#9b959b] disabled:cursor-not-allowed disabled:text-[#8a858c]"
            />
            <button
              type="submit"
              disabled={!canAsk || busy || !draft.trim()}
              aria-label={busy ? t.sending : t.send}
              title={busy ? t.sending : t.send}
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-[#fa3250] text-white transition-colors hover:bg-[#d81f3c] disabled:cursor-not-allowed disabled:bg-[#eee8e3] disabled:text-[#aaa3a0]"
            >
              {busy ? (
                <svg className="h-[18px] w-[18px] animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 19V5m0 0-5.5 5.5M12 5l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </section>

      <aside className="hidden min-h-0 min-w-0 flex-col overflow-hidden border-l border-[#e2dbd4] bg-[#f8f5f1] lg:flex">
        <div className="flex h-[55px] shrink-0 items-center justify-between border-b border-[#e2dbd4] px-5">
          <h2 className="text-[14px] font-semibold text-[#373238]">{sourceTitle}</h2>
          {panel && panel.citations.length > 0 && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6e6a72] tabular-nums">
              {panel.citations.length}
            </span>
          )}
        </div>
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-3.5 xl:p-4">
          {sourceList("desktop-appui")}
        </div>
      </aside>
    </div>
  );
}
