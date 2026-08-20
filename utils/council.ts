// Client-safe types and helpers for the council-meetings feature.
// No server-only imports here (mirrors the utils/issues.ts split).

/** Which part of a sitting a passage came from — the narrowing the agent offers. */
export const SECTIONS = ["questions", "resolutions", "elus"] as const;
export type Section = (typeof SECTIONS)[number];

/** The borough runs two question periods, and residents ask about both. */
export const MODES = ["orale", "ecrite"] as const;
export type QuestionMode = (typeof MODES)[number];

/**
 * One resident's intervention, as the proces-verbal recorded it.
 *
 * `subject` is the clerk's wording and `transcript` is what was actually said,
 * aligned from the recording. Both are verbatim; neither is paraphrased.
 */
export type QuestionHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string; // ISO (YYYY-MM-DD)
  youtubeId: string;
  /** The borough's published minutes — the source this row was read from. */
  pvUrl: string | null;
  personId: string | null;
  name: string;
  subject: string;
  mode: QuestionMode;
  speakingOrder: number;
  startS: number | null;
  endS: number | null;
  /**
   * The recording from the moment this name was called to the moment the next
   * one was, capped at ten minutes.
   *
   * NOT this person's words, and it must never be labelled as them. The
   * alignment pass has no speaker diarisation, so the window holds the chair's
   * housekeeping, the question, the borough's answer to it, and sometimes the
   * beginning of the next turn, with nothing separating them. Anything shown
   * from here is "the recording around this moment", which is true, rather than
   * "what this resident said", which the data cannot support.
   */
  transcript: string | null;
  /** The window around the match — what the card shows. */
  excerpt: string | null;
  /**
   * True when the words are in the subject the clerk recorded against this
   * name. Only these may be counted — see `CouncilAnswer`.
   */
  lexical: boolean;
  /**
   * True when the words were found in `transcript` rather than in the clerk's
   * subject line. Real about the recording, unattributable to this person, and
   * therefore never counted. It travels beside `lexical` so a caller can say
   * which of the two it is holding instead of guessing from the absence.
   */
  heard: boolean;
  similarity: number | null;
};

/** One decision of the council, as numbered in the minutes. */
export type ResolutionHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  youtubeId: string;
  pvUrl: string | null;
  odjUrl: string | null;
  number: string;
  title: string;
  body: string | null;
  outcome: string | null;
  agendaCode: string | null;
  movedBy: string | null;
  secondedBy: string | null;
  debate: boolean;
  startS: number | null;
  lexical: boolean;
  similarity: number | null;
};

/**
 * One thing an elected member raised, from the council's own two periods.
 *
 * A row per item rather than per councillor: a member brings six things to a
 * sitting, and a search for one of them should not return the other five.
 */
export type RemarkHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  youtubeId: string;
  pvUrl: string | null;
  personId: string | null;
  name: string;
  topic: string;
  kind: "commentaire" | "question";
  startS: number | null;
  lexical: boolean;
  similarity: number | null;
};

/**
 * One sitting, summarised.
 *
 * Every field is a count of rows the borough published — nothing here is
 * generated prose, so the summary cannot claim anything the minutes do not.
 * `topSubjects` is the sitting's own account of itself: subjects the clerk
 * recorded for more than one resident, which is how eleven people turning up
 * about the Sherbrooke parking meters becomes visible without anyone writing
 * an editorial about it.
 */
export type MeetingSummary = {
  youtubeId: string;
  meetingDate: string;
  title: string;
  kind: string | null;
  president: string | null;
  presidentActing: boolean;
  pvUrl: string | null;
  odjUrl: string | null;
  durationS: number | null;
  oral: number;
  written: number;
  people: number;
  aligned: number;
  resolutions: number;
  unanimous: number;
  /** Decisions that were not unanimous — where the council split. */
  divided: number;
  debates: number;
  remarks: number;
  topSubjects: string[];
};

/** One passage of transcript, for when the words themselves are the answer. */
export type SearchHit = {
  id: string;
  meetingTitle: string;
  meetingDate: string;
  youtubeId: string;
  startS: number;
  endS: number;
  text: string;
  section: Section | null;
  speaker: string | null;
  lexicalRank: number | null;
  semanticRank: number | null;
};

/**
 * What the page states out loud.
 *
 * The split into tiers is the honest part of this feature, and there are three
 * of them because there are three different things a match can mean.
 *
 * `counted` is the clerk's own line: the borough published these words beside
 * this name, so "three residents" means three a reader can verify in a PDF.
 * `heard` is the recording around that person's turn, which establishes that
 * the words were said in the room and nothing at all about who said them.
 * `related` is an embedding's neighbourhood, which establishes even less.
 *
 * Only the first is ever a number.
 *
 * An earlier attempt tried to count by similarity instead. It could not be made
 * to work — the notes in migration 0007 and 0018 record why, and the short
 * version is that nearest-neighbour ranking always returns neighbours, so an
 * off-topic query produced a confident number for a thing nobody discussed.
 */
export type CouncilAnswer = {
  query: string;
  /** After bilingual widening — shown so a reader knows what was searched. */
  expanded: string;
  /**
   * Rows where the clerk wrote these words against this name. Countable,
   * because a reader can open the proces-verbal and find the same line.
   */
  counted: QuestionHit[];
  /**
   * Rows where the words are in the recording around this person's turn.
   *
   * These used to sit in `counted`, and that was the single worst inaccuracy on
   * the site: the window carries the borough's answer as well as the question,
   * so "twenty-three residents raised parks" was counting officials replying
   * about parks. Measured against the clerk's record the same query stood at
   * five. They are kept, because finding the moment is genuinely useful, and
   * they are kept out of every number.
   */
  heard: QuestionHit[];
  /** Neither, but near in meaning. Never counted, never quoted as anyone. */
  related: QuestionHit[];
  /** Distinct humans among `counted`. This is the number in the headline. */
  people: number;
  /** Distinct sittings among `counted`. */
  meetings: number;
};

/**
 * The part of a long intervention that shows why it matched.
 *
 * A resident holds the floor for up to ten minutes, which comes back as five
 * thousand characters of transcript on average and eight thousand at worst.
 * Printing that whole block on a search result is unreadable — sixteen of them
 * is ninety thousand characters — and it buries the sentence the reader
 * actually searched for somewhere in the middle.
 *
 * So the card shows a window around the first match instead, and the video link
 * carries whoever wants the rest. Cut on word boundaries: a snippet that starts
 * mid-word reads as corruption rather than as an excerpt.
 */
const EXCERPT_CHARS = 300;

export function excerptAround(text: string, terms: string[]): string {
  if (text.length <= EXCERPT_CHARS) return text;

  const fold = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hay = fold(text);

  let at = -1;
  for (const term of terms) {
    const i = hay.indexOf(fold(term));
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }

  // No term found — this is a "related" row, so the opening is as good a
  // window as any.
  if (at < 0) at = 0;

  let start = Math.max(0, at - Math.floor(EXCERPT_CHARS / 3));
  let end = Math.min(text.length, start + EXCERPT_CHARS);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space > 0 && space < start + 30) start = space + 1;
  }
  const space = text.lastIndexOf(" ", end);
  if (space > start + EXCERPT_CHARS / 2) end = space;

  return (start > 0 ? "… " : "") + text.slice(start, end).trim() + (end < text.length ? " …" : "");
}

/**
 * The words in a question that name the thing being asked about.
 *
 * The corpus search takes keywords. A whole question defeats it: "Qui a parlé
 * de déneigement ?" widens to an OR over every stem in the sentence, and
 * "parlé" alone matches nearly every passage in eleven hours of recording, so
 * the one word that mattered is outvoted by the grammar around it. Asked that
 * way the search returned passages on heritage buildings and on housing, and
 * none on snow.
 *
 * The model is told to search with keywords and does. This is for the path
 * where there is no model: the words are stripped down here instead.
 *
 * Two kinds of word go. The ordinary skeleton of a French or English sentence,
 * and the verbs of speech that open almost every question put to an archive of
 * people talking. "Question" stays: in a council corpus it is a thing, not a
 * verb. Anything below three characters goes with them, which also disposes of
 * most of what is left.
 */
const NOISE = new Set([
  // French: interrogatives, articles, prepositions, pronouns, auxiliaries.
  "qui", "que", "quoi", "quel", "quelle", "quels", "quelles", "est", "sont",
  "ete", "etait", "etaient", "les", "des", "une", "aux", "dans", "sur", "pour",
  "par", "avec", "sans", "chez", "vers", "elle", "elles", "ils", "nous", "vous",
  "leur", "leurs", "mon", "mes", "ton", "tes", "son", "ses", "notre", "votre",
  "cette", "ces", "cet", "celui", "celle", "ceux", "quand", "comment",
  "pourquoi", "combien", "tout", "tous", "toute", "toutes", "plus", "moins",
  "aussi", "encore", "deja", "avoir", "etre", "fait", "faire", "peut", "veut",
  "ont", "avez", "avons", "puis", "donc", "mais", "car", "lors", "afin",
  // English.
  "the", "and", "for", "with", "without", "about", "what", "who", "whom",
  "which", "when", "where", "why", "how", "many", "much", "have", "has", "had",
  "was", "were", "been", "are", "did", "does", "done", "any", "some", "there",
  "their", "them", "they", "this", "that", "these", "those", "from", "into",
  "over", "under", "than", "then", "also", "just", "get", "got",
  // The verbs of speech an archive question is always built on.
  "parle", "parler", "parlent", "dire", "dit", "dites", "demande", "demander",
  "demandent", "souleve", "soulever", "plaint", "plaindre", "plaintes",
  "evoque", "evoquer", "mentionne", "mentionner", "aborde", "aborder",
  "said", "say", "says", "talk", "talked", "talks", "speak", "spoke", "spoken",
  "raise", "raised", "raises", "mention", "mentioned", "complain", "complained",
  "complaint", "complaints", "ask", "asked", "asks", "bring", "brought",
]);

export function keywordsFrom(question: string): string {
  const fold = (w: string) =>
    w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const kept = question
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter((word) => {
      const bare = fold(word).replace(/^[''-]+|[''-]+$/g, "");
      return bare.length > 2 && !NOISE.has(bare);
    });

  // Every word was grammar, which happens on "Qui a dit quoi ?". The sentence
  // as typed is a worse query than these words, and it is the only one left.
  return kept.length > 0 ? kept.join(" ") : question.trim();
}

/**
 * The words a reader actually typed, recovered from the expanded query.
 *
 * `expandQuery` wraps alternatives in parentheses and joins them with a bare
 * `or` for websearch_to_tsquery; none of that is a word to look for in a
 * transcript.
 */
export function searchTerms(expanded: string): string[] {
  return expanded
    .replace(/[()"]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.toLowerCase() !== "or" && w.length > 2);
}

/**
 * A sitting's date, written the way each language writes it.
 *
 * `Intl` gives "1 juin 2026". French wants "1er juin 2026" — the first of the
 * month is the one ordinal the language insists on, and the borough's own
 * minutes use it. English takes the cardinal unchanged.
 */
export function formatMeetingDate(iso: string, lang: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  const text = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  if (lang !== "fr" || d.getDate() !== 1) return text;
  return text.replace(/^1\b/, "1er");
}

/** Deep-link straight to the moment in the recording. */
export function youtubeDeepLink(youtubeId: string, startS: number): string {
  return `https://www.youtube.com/watch?v=${youtubeId}&t=${Math.floor(startS)}s`;
}

/**
 * The clerk types resolution titles in capitals, and the parser keeps them
 * verbatim because that is how the minutes read. On screen a 200-character line
 * of capitals is a wall: it is slower to read, it wraps badly, and it shouts.
 *
 * Lowercased and given back its initial, with anything that was already an
 * acronym left alone. Proper nouns are lost, which is a real cost and a smaller
 * one than the wall.
 */
/**
 * Acronyms that contain a vowel, and so cannot be recognised by shape.
 *
 * Length is not the signal it looks like. Sparing every all-caps run of five
 * letters or fewer, which is what this did, spares most of the French language:
 * "REJETÉE À LA MAJORITÉ" came out as "Rejetée à LA majorité", and one sitting's
 * decisions read "semaine des ARTS", "projet de LOI 20", "réaménagement du PARC
 * mackenzie-king", "DÉPÔT - rapports décisionnels - AVRIL 2026". Fifty words
 * shouting mid-sentence, one or two on nearly every card.
 *
 * What actually distinguishes an acronym is that it is not a word, and the two
 * reliable readings of that are structural: it carries a digit (RCA26 17427,
 * PP-151), or it has no vowel at all (NDG, STM, SRRR, MSPQ, CQCH), which no
 * French or English word does. This list is the remainder — the ones the
 * borough's minutes use that those two rules miss. Add to it when a new one
 * turns up; the cost of a miss is one lowercased acronym, not a wall of
 * capitals.
 */
const ACRONYMS = new Set([
  "ABF", "AOP", "BCA", "CCU", "DAI", "DGI", "FFCAQ", "FHCQ", "FILCAN", "INC",
  "LAU", "MAMH", "NDA", "NEQ", "OBNL", "OCA", "OCPM", "PAAL", "PIIA", "PMIR",
  "PRIMADA", "RAAV", "RCA", "REQ", "SENC", "SOCENV", "UCI", "UNESCO", "VAC",
  // Roman numerals, which the clerk uses for centuries and for annexes.
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "XIX", "XX",
]);

const VOWELS = /[AEIOUYÀÂÄÉÈÊËÎÏÔÖÙÛÜ]/;

export function unshout(text: string): string {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return text;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length / letters.length;
  if (upper < 0.8) return text;

  const lowered = text
    .split(/(\s+)/)
    .map((word) => {
      // A reference the reader has to be able to type back into the borough's
      // search: RCA26 17427, PP-151, 2320-2322.
      if (/\d/.test(word)) return word;

      const bare = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
      if (bare.length > 1 && (!VOWELS.test(bare) || ACRONYMS.has(bare))) {
        return word;
      }
      return word.toLocaleLowerCase("fr-CA");
    })
    .join("");

  return lowered.replace(/\p{L}/u, (c) => c.toLocaleUpperCase("fr-CA"));
}

/**
 * The heading of a resolution, with any preamble that leaked into it removed.
 *
 * `parse_pv.py` now stops the heading at the first line the clerk set in
 * sentence case and files the preamble with the body, where it belongs. This
 * guards the page against rows loaded before that fix and against the clerk's
 * template changing again: a heading is a line, and a card that renders four
 * thousand characters of "Considérant que" at heading size is unreadable
 * whatever put them there.
 *
 * A no-op on a heading that is already one.
 */
export function resolutionTitle(title: string): string {
  const words = title.split(/\s+/);
  let end = words.length;
  for (let i = 0; i < words.length; i++) {
    const letters = words[i].replace(/[^A-Za-zÀ-ÿ]/g, "");
    // Punctuation and figures carry no case and end nothing.
    if (!letters) continue;
    if (letters.replace(/[^a-zà-ÿ]/g, "").length / letters.length > 0.2) {
      end = i;
      break;
    }
  }
  // Every word read as sentence case: the row has no shouted heading at all,
  // so there is nothing to trim and the title stands as stored.
  return end === 0 ? title : words.slice(0, end).join(" ");
}

/** seconds -> "1 h 23" for display. */
export function formatTimestamp(startS: number): string {
  const s = Math.floor(startS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

/**
 * Distinct people in a set of interventions.
 *
 * Falls back to the printed name when a row has no person id, folded the same
 * way the ingest folds `name_key`, so "Joël" and "Joel" stay one person rather
 * than becoming two and inflating every count on the page.
 */
export function distinctPeople(hits: QuestionHit[]): number {
  const keys = new Set(
    hits.map(
      (h) =>
        h.personId ??
        h.name
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase(),
    ),
  );
  return keys.size;
}

export function distinctMeetings(hits: { youtubeId: string }[]): number {
  return new Set(hits.map((h) => h.youtubeId)).size;
}
