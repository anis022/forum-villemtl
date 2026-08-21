import { google } from "@ai-sdk/google";
import { mistral } from "@ai-sdk/mistral";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import {
  answerAboutQuestions,
  getMeeting,
  listMeetingSummaries,
  searchCouncil,
  searchRemarks,
  searchResolutions,
} from "@/utils/supabase/council";
import {
  distinctMeetings,
  distinctPeople,
  excerptAround,
  keywordsFrom,
  resolutionTitle,
  searchTerms,
  unshout,
} from "@/utils/council";
import { expandQuery } from "@/utils/council-terms";
import type {
  CouncilAnswer,
  MeetingSummary,
  QuestionHit,
  RemarkHit,
  ResolutionHit,
} from "@/utils/council";

/**
 * The council archive, handed to a model as six tools.
 *
 * Everything here wraps a query function that already existed, so a number the
 * chat gives out is the same number the archive would give out. Nothing is
 * counted here that is not counted there.
 *
 * The one thing this layer adds is the numbering. Every row a tool returns
 * carries a `source` number, and the answer is only allowed to state something
 * by writing that number after the sentence. The route then keeps the sources
 * whose number appears in the text and throws the rest away, which is what
 * makes the list under an answer the evidence for that answer rather than a
 * dump of everything the search happened to touch.
 */
/** One rung of the ladder: a model, and a name to say so in the log. */
export type CouncilModel = { provider: string; model: LanguageModel };

/**
 * The models, in the order the route tries them, and the only place any of them
 * is named.
 *
 * Called straight at each provider rather than through the Vercel AI Gateway,
 * because the gateway will not serve a project without a card on file even to
 * spend its own free credits, and this site is not to cost anything. Every rung
 * here is reachable with a free key and no card.
 *
 * Mistral leads because of what its free tier is counted in. Google's is
 * counted in requests per day, and one question here is nowhere near one
 * request: the agent searches, sometimes searches again, then writes, so a
 * handful of questions can spend a day. Mistral's is counted in tokens per
 * month, on the order of a billion of them, which is the same question asked a
 * thousand times a day rather than ten. It also writes French as a first
 * language, which is what this corpus and this borough are.
 *
 * The middle rung is deliberately nameless: a base URL, a key and a model id,
 * all three read from the environment. Every free tier worth having speaks
 * OpenAI's shape, so putting Groq or Cerebras or OpenRouter behind this page is
 * three settings in the dashboard rather than a deployment. It is skipped
 * entirely when those settings are absent, which is the state it ships in.
 *
 * Google stays, on the bottom rung. Its allowance is small but it refills at
 * midnight, its key is already configured, and a rung that answers one question
 * in ten is worth more than no rung at all.
 *
 * Ids and order are environment variables with defaults rather than literals.
 * Free tiers move: Google has already narrowed which models they cover, and the
 * day one of these falls off the list the fix has to be a setting somebody
 * changes in the dashboard, not a deployment.
 *
 * Whatever happens here, no question is ever left unanswered: every failure
 * path in the route falls through to `searchTheCorpus` below, which costs
 * nothing and asks no third party for permission. An empty ladder, which is
 * what no keys at all produces, is not an error state; it is that search.
 */
const RUNGS: Record<string, () => CouncilModel | null> = {
  mistral: () =>
    process.env.MISTRAL_API_KEY
      ? {
          provider: "mistral",
          model: mistral(process.env.COUNCIL_MISTRAL_MODEL_ID ?? "mistral-medium-latest"),
        }
      : null,

  compatible: () => {
    const baseURL = process.env.COUNCIL_COMPATIBLE_BASE_URL;
    const apiKey = process.env.COUNCIL_COMPATIBLE_API_KEY;
    const id = process.env.COUNCIL_COMPATIBLE_MODEL_ID;
    if (!baseURL || !apiKey || !id) return null;

    // Named after the host so a failure in the log says which company said no.
    const host = URL.canParse(baseURL) ? new URL(baseURL).hostname : "compatible";
    return { provider: host, model: createOpenAICompatible({ name: host, baseURL, apiKey })(id) };
  },

  google: () =>
    process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ? { provider: "google", model: google(process.env.COUNCIL_MODEL_ID ?? "gemini-3.6-flash") }
      : null,
};

export const COUNCIL_MODELS: CouncilModel[] = (
  process.env.COUNCIL_PROVIDERS ?? "mistral,compatible,google"
)
  .split(",")
  .map((name) => RUNGS[name.trim().toLowerCase()]?.() ?? null)
  .filter((rung): rung is CouncilModel => rung !== null);

/**
 * A retrieved row is up to eight thousand characters of transcript. A dozen of
 * those in one tool result is most of a context window spent before the model
 * has written a word, so every tool sends the window around the match and says
 * how many rows it left out rather than sending them.
 */
const MAX_QUOTE = 360;
const MAX_ROWS = 10;
const MAX_RELATED = 4;

/** One thing an answer rests on, rendered under it as a passage and a moment. */
export type Citation = {
  /** What the model writes in brackets. Stable for the length of one answer. */
  n: number;
  /** Position in the list the reader sees. Assigned once the answer is written. */
  i: number;
  key: string;
  kind: "passage" | "question" | "resolution" | "remark" | "meeting";
  /** ISO date of the sitting. Formatted in the reader's language, client side. */
  date: string;
  who: string | null;
  /** The subject line, when the row has one. A passage has only its words. */
  what: string | null;
  /** The words themselves, verbatim. Null when the row is a record, not speech. */
  quote: string | null;
  /**
   * Whether `who` is known to have said `quote`.
   *
   * False on every question row, and the page has to say so. The clerk's record
   * is solid on who spoke and in what order; the recording is solid on what was
   * said and when. What nothing here establishes is which of them said which
   * words, because the alignment window runs from one name being called to the
   * next and carries the borough's answer inside it. Printing that under a
   * resident's name as a quotation puts an official's words in their mouth.
   *
   * A passage from the recording is `true` in the only sense that matters: it
   * carries no name at all, so it claims nothing about anybody.
   */
  attributed: boolean;
  youtubeId: string;
  startS: number | null;
  pvUrl: string | null;
};

/**
 * The ceiling on the list under an answer.
 *
 * It was ten, which was too few and failed in the one way that matters. Asked
 * who raised snow clearing, the answer named nine residents and cited nine
 * sources for them, then leaned on three more for what the councillor said
 * back. The last three fell off the end, so three sentences lost the passage
 * that proved them and three markers vanished mid-paragraph.
 *
 * A cap has to sit above the honest maximum, not at the comfortable one. Nine
 * people is nine sources whether or not that is a tidy number of rows.
 */
const MAX_CITATIONS = 16;

function clip(text: string, max = MAX_QUOTE): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()} …`;
}

/**
 * The sentence the answer has to open on, as a fact rather than as an order.
 *
 * Phrased as something true about the archive, so the model paraphrases it into
 * its own prose instead of quoting it. Naming the trap in the zero case is
 * deliberate: told only "start with the nine", a model still reaches for the
 * absence first, because an absence feels like the honest thing to lead with.
 * It is not — the reader asked what the archive holds, and it holds nine.
 */
function leadFor(answer: CouncilAnswer): string {
  if (answer.counted.length > 0) {
    return `${answer.people} personne(s) ont fait inscrire ce sujet au procès-verbal. Commence par ce chiffre, nomme-les avec leurs dates, puis donne les entendus dans une phrase à part.`;
  }
  if (answer.heard.length > 0) {
    return `Personne n'a fait inscrire ce sujet au procès-verbal, mais il revient ${answer.heard.length} fois dans les enregistrements. Ouvre sur ces ${answer.heard.length} fois. N'ouvre pas sur l'absence : « Aucune personne… » en tête de réponse est interdit ici, l'absence vient après, dans la phrase suivante.`;
  }
  return "Rien dans les archives là-dessus. Dis-le franchement, en une phrase.";
}

function trimSummary(m: MeetingSummary) {
  return {
    identifiant: m.youtubeId,
    date: m.meetingDate,
    titre: m.title,
    presidee_par: m.president,
    questions_orales: m.oral,
    questions_ecrites: m.written,
    personnes_au_micro: m.people,
    resolutions: m.resolutions,
    resolutions_unanimes: m.unanimous,
    resolutions_partagees: m.divided,
    interventions_elus: m.remarks,
    sujets_recurrents: m.topSubjects,
  };
}

/**
 * The tools, plus the sources they fill as they run.
 *
 * Sources are collected here rather than asked of the model, because a model
 * asked for a URL will eventually write one that does not exist. The model
 * chooses which of them to stand behind; it never writes their contents.
 *
 * Only rows that literally contain the words searched for are collected. A row
 * an embedding merely placed nearby is worth reading and is not evidence of
 * anything, and a passage printed under an answer reads as evidence.
 */
export function councilTools() {
  const citations: Citation[] = [];
  const byKey = new Map<string, number>();

  /** Files a source and hands back the number the model has to write. */
  const cite = (c: Omit<Citation, "n" | "i">): number => {
    const already = byKey.get(c.key);
    if (already !== undefined) return already;
    const n = citations.length + 1;
    byKey.set(c.key, n);
    citations.push({ ...c, n, i: 0 });
    return n;
  };

  const citeQuestion = (hit: QuestionHit) =>
    cite({
      key: `question:${hit.id}`,
      kind: "question",
      date: hit.meetingDate,
      who: hit.name,
      what: hit.subject,
      quote: hit.excerpt ? clip(hit.excerpt) : null,
      // The clerk's subject line beside this name is attributed; the words in
      // the window beside it are not, and the two arrive in the same row.
      attributed: false,
      youtubeId: hit.youtubeId,
      startS: hit.startS,
      pvUrl: hit.pvUrl,
    });

  const citeResolution = (hit: ResolutionHit) =>
    cite({
      key: `resolution:${hit.id}`,
      kind: "resolution",
      date: hit.meetingDate,
      who: hit.movedBy,
      what: `${hit.number} ${unshout(resolutionTitle(hit.title))}`,
      quote: hit.body ? clip(hit.body) : null,
      // The minutes name the mover of a resolution and print its text. Both
      // come from the same published document.
      attributed: true,
      youtubeId: hit.youtubeId,
      startS: hit.startS,
      pvUrl: hit.pvUrl ?? hit.odjUrl,
    });

  const citeRemark = (hit: RemarkHit) =>
    cite({
      key: `remark:${hit.id}`,
      kind: "remark",
      date: hit.meetingDate,
      who: hit.name,
      what: hit.topic,
      quote: null,
      // No quote to misattribute: this is the clerk's line and nothing else.
      attributed: true,
      youtubeId: hit.youtubeId,
      startS: hit.startS,
      pvUrl: hit.pvUrl,
    });

  const tools = {
    chercher_dans_les_enregistrements: tool({
      description:
        "Cherche dans ce qui a été dit à voix haute pendant les séances, transcrit depuis les " +
        "enregistrements. Renvoie les passages eux-mêmes avec le moment exact de la vidéo. " +
        "C'est l'outil à utiliser quand la question porte sur ce que quelqu'un a dit, sur les " +
        "termes employés ou sur la réponse donnée à quelqu'un.",
      inputSchema: z.object({
        sujet: z
          .string()
          .describe("Les mots de la chose cherchée, pas la phrase entière. Exemple : « parcomètres Sherbrooke »."),
        partie: z
          .enum(["questions", "resolutions", "elus"])
          .optional()
          .describe(
            "Restreindre à un moment de la soirée : la période de questions du public, l'examen " +
              "des résolutions, ou les points soulevés par les élus.",
          ),
      }),
      execute: async ({ sujet, partie }) => {
        const { hits } = await searchCouncil(sujet, partie, MAX_ROWS);

        return {
          total: hits.length,
          passages: hits.map((hit) => ({
            source: cite({
              key: `passage:${hit.id}`,
              kind: "passage",
              date: hit.meetingDate,
              who: hit.speaker,
              what: null,
              quote: clip(hit.text),
              // Carries no name, so it claims nothing about anyone.
              attributed: true,
              youtubeId: hit.youtubeId,
              startS: hit.startS,
              pvUrl: null,
            }),
            date: hit.meetingDate,
            qui: hit.speaker,
            moment_s: hit.startS,
            texte: clip(hit.text, 700),
          })),
        };
      },
    }),

    chercher_questions_du_public: tool({
      description:
        "Cherche dans les questions posées par le public pendant les périodes de questions, orales " +
        "et écrites. Trois champs, et ils ne disent pas la même chose. « comptes » : le greffe a " +
        "inscrit ces mots comme sujet de cette personne, c'est le seul champ qui donne un nombre. " +
        "« entendus » : les mots ont bel et bien été prononcés dans la salle à ce moment de la " +
        "séance, sans qu'on sache par qui, car la fenêtre contient aussi la réponse de " +
        "l'administration. C'est un vrai résultat, à donner avec son nombre (total_entendus, " +
        "personnes_entendues, seances_entendues) ; ce qu'on ne peut pas faire, c'est l'attribuer " +
        "à quelqu'un ou l'additionner aux comptes. « rapprochees » : un simple voisinage de sens, " +
        "à ne jamais chiffrer.",
      inputSchema: z.object({
        sujet: z
          .string()
          .describe("Les mots de la chose cherchée, pas la phrase entière. Exemple : « parcomètres Sherbrooke »."),
        mode: z
          .enum(["orale", "ecrite"])
          .optional()
          .describe("Restreindre à la période de questions orales ou aux questions écrites."),
      }),
      execute: async ({ sujet, mode }) => {
        const answer = await answerAboutQuestions(sujet, mode);

        return {
          // Computed here, not left to the model.
          //
          // The ordering rule in the prompt — lead with what was found, never
          // with what was not — held for two calls in three and then produced
          // "Aucune personne n'a inscrit le déneigement…" again, which is the
          // exact sentence it exists to prevent. A rule a model follows most of
          // the time is not a rule; it is a tendency. The server knows which of
          // the three cases this is before the model sees a single row, so it
          // says so, and the model is left with the writing rather than the
          // arithmetic. Same division of labour as the citations: the server
          // decides what is true, the model decides how it reads.
          commencer_par: leadFor(answer),
          recherche: answer.expanded,
          total_comptes: answer.counted.length,
          personnes_distinctes: answer.people,
          seances_distinctes: answer.meetings,
          // The heard tier gets its own totals, and it needs them: `entendus`
          // below is capped at MAX_ROWS, so a model counting the rows it can
          // see reports ten when the answer is forty. It reported "neuf
          // personnes" correctly only because nine is under the cap.
          total_entendus: answer.heard.length,
          personnes_entendues: distinctPeople(answer.heard),
          seances_entendues: distinctMeetings(answer.heard),
          comptes: answer.counted.slice(0, MAX_ROWS).map((hit) => ({
            source: citeQuestion(hit),
            personne: hit.name,
            date: hit.meetingDate,
            sujet: hit.subject,
            mode: hit.mode,
            moment_s: hit.startS,
            // Named `enregistrement_autour` and not `extrait`, because the model
            // writes what the field is called. Given `extrait` beside
            // `personne` it wrote "X a dit ...", and the window it was quoting
            // routinely holds the borough's reply rather than X.
            enregistrement_autour: hit.excerpt ? clip(hit.excerpt, 700) : null,
          })),
          entendus: answer.heard.slice(0, MAX_ROWS).map((hit) => ({
            source: citeQuestion(hit),
            personne_au_micro_a_ce_moment: hit.name,
            date: hit.meetingDate,
            sujet_inscrit: hit.subject,
            moment_s: hit.startS,
            enregistrement_autour: hit.excerpt ? clip(hit.excerpt, 700) : null,
          })),
          rapprochees: answer.related.slice(0, MAX_RELATED).map((hit) => ({
            personne: hit.name,
            date: hit.meetingDate,
            sujet: hit.subject,
          })),
        };
      },
    }),

    chercher_resolutions: tool({
      description:
        "Cherche dans les résolutions du conseil, c'est-à-dire ses décisions numérotées. Même " +
        "distinction : « comptes » contient les mots cherchés, « rapprochees » ne les contient pas.",
      inputSchema: z.object({
        sujet: z.string().describe("Les mots de l'objet cherché, pas la phrase entière."),
      }),
      execute: async ({ sujet }) => {
        const found = await searchResolutions(sujet);

        return {
          recherche: found.expanded,
          total_comptes: found.counted.length,
          comptes: found.counted.slice(0, MAX_ROWS).map((hit) => ({
            source: citeResolution(hit),
            numero: hit.number,
            date: hit.meetingDate,
            titre: clip(hit.title, 300),
            resultat: hit.outcome,
            propose_par: hit.movedBy,
            debat: hit.debate,
          })),
          rapprochees: found.related.slice(0, MAX_RELATED).map((hit) => ({
            numero: hit.number,
            date: hit.meetingDate,
            titre: clip(hit.title, 200),
          })),
        };
      },
    }),

    chercher_interventions_elus: tool({
      description:
        "Cherche dans ce que les élus ont soulevé eux-mêmes, aux points 10.04 et 10.07 de l'ordre " +
        "du jour. Une ligne par sujet soulevé, pas une par élu.",
      inputSchema: z.object({
        sujet: z.string().describe("Les mots de l'objet cherché, pas la phrase entière."),
        type: z
          .enum(["commentaire", "question"])
          .optional()
          .describe("Restreindre aux commentaires ou aux questions des élus."),
      }),
      execute: async ({ sujet, type }) => {
        const found = await searchRemarks(sujet, type);

        return {
          recherche: found.expanded,
          total_comptes: found.counted.length,
          comptes: found.counted.slice(0, MAX_ROWS).map((hit) => ({
            source: citeRemark(hit),
            elu: hit.name,
            date: hit.meetingDate,
            objet: hit.topic,
            type: hit.kind,
            moment_s: hit.startS,
          })),
          rapprochees: found.related.slice(0, MAX_RELATED).map((hit) => ({
            elu: hit.name,
            date: hit.meetingDate,
            objet: hit.topic,
          })),
        };
      },
    }),

    liste_des_seances: tool({
      description:
        "Toutes les séances du conseil, de la plus récente à la plus ancienne, avec leurs chiffres " +
        "et les sujets que plusieurs résidents y ont soulevés. Sert à répondre aux questions de " +
        "période, par exemple ce qui s'est passé en juin, et à retrouver l'identifiant d'une séance.",
      inputSchema: z.object({}),
      execute: async () => {
        const meetings = await listMeetingSummaries();
        return { total: meetings.length, seances: meetings.map(trimSummary) };
      },
    }),

    detail_seance: tool({
      description:
        "Le contenu d'une séance : ses questions du public, ses résolutions et ce que les élus y " +
        "ont soulevé. L'identifiant vient de liste_des_seances.",
      inputSchema: z.object({
        identifiant: z
          .string()
          .describe("L'identifiant de la séance, tel que renvoyé par liste_des_seances."),
      }),
      execute: async ({ identifiant }) => {
        const meeting = await getMeeting(identifiant);
        if (!meeting) return { trouve: false as const };

        // A sitting holds forty resolutions and twenty ten-minute interventions.
        // Sent whole it is the whole context window, so this is the shape of the
        // sitting rather than its transcript; the model can search for the words
        // if it needs them.
        return {
          trouve: true as const,
          source: cite({
            key: `meeting:${meeting.summary.youtubeId}`,
            kind: "meeting",
            date: meeting.summary.meetingDate,
            who: meeting.summary.president,
            what: meeting.summary.title,
            // Who chaired a sitting is in the minutes, and there is no quote.
            attributed: true,
            quote: null,
            youtubeId: meeting.summary.youtubeId,
            startS: null,
            pvUrl: meeting.summary.pvUrl ?? meeting.summary.odjUrl,
          }),
          seance: trimSummary(meeting.summary),
          questions: meeting.questions.slice(0, 20).map((hit) => ({
            source: citeQuestion(hit),
            personne: hit.name,
            sujet: hit.subject,
            mode: hit.mode,
            moment_s: hit.startS,
          })),
          questions_omises: Math.max(0, meeting.questions.length - 20),
          resolutions: meeting.resolutions.slice(0, 40).map((hit) => ({
            source: citeResolution(hit),
            numero: hit.number,
            titre: clip(hit.title, 200),
            resultat: hit.outcome,
          })),
          resolutions_omises: Math.max(0, meeting.resolutions.length - 40),
          interventions_elus: meeting.remarks.map((hit) => ({
            source: citeRemark(hit),
            elu: hit.name,
            objet: hit.topic,
            type: hit.kind,
          })),
        };
      },
    }),
  };

  /**
   * The sources the answer actually stood behind, in the order it used them.
   *
   * `used` holds the numbers found in the finished text. Anything the search
   * turned up and the answer did not lean on is dropped: it was a search
   * result, and printing it as a source would claim it backed something.
   */
  const collect = (used: number[]): Citation[] => {
    const wanted = used.filter((n, at) => used.indexOf(n) === at);
    const picked = wanted
      .map((n) => citations.find((c) => c.n === n))
      .filter((c): c is Citation => Boolean(c));

    // Nothing cited, which happens when the model answers from a count alone
    // or ignores the instruction. Everything it read is then the honest list.
    const list = picked.length > 0 ? picked : citations;
    return list.slice(0, MAX_CITATIONS).map((c, at) => ({ ...c, i: at + 1 }));
  };

  return { tools, collect };
}

/**
 * The same archive, without a model.
 *
 * This is what the page falls back to, and it is the reason the tab cannot go
 * dark: it runs on the borough's own rows, costs nothing per question, has no
 * daily allowance, and answers the same whether one person is asking or ten
 * thousand. Everything above it is an improvement on this, not a replacement
 * for it.
 *
 * There is no prose here and there is deliberately none. Writing "three people
 * raised this" is a claim, and a claim needs a writer that can be held to it.
 * What comes back is the passages themselves, in the reader's hands, with the
 * second of the recording where each was said.
 *
 * Passages first, then the clerk's own record of who asked what. A resident
 * searching for their street wants the sentence somebody said before they want
 * a subject line, and the passages carry timestamps far more often.
 */
export async function searchTheCorpus(question: string): Promise<Citation[]> {
  const words = keywordsFrom(question);

  const terms = searchTerms(expandQuery(words));

  const [passages, questions] = await Promise.all([
    searchCouncil(words, undefined, 6, true).catch(() => ({ hits: [] })),
    answerAboutQuestions(words, undefined, true).catch(() => ({ counted: [] as QuestionHit[] })),
  ]);

  // Words only, decided before the ranking rather than after it. A nearest
  // neighbour always exists, so a search that ranks by meaning answers an
  // off-topic question with six confident passages about something else. Under
  // a line promising "the passages where your words come up", that is a lie.
  // Asked for cryptocurrency, this now returns nothing, which is the truth.
  const found: Omit<Citation, "n" | "i">[] = [
    ...passages.hits.map((hit) => ({
      key: `passage:${hit.id}`,
      kind: "passage" as const,
      date: hit.meetingDate,
      who: hit.speaker,
      // Diarisation has never run, so `speaker` is null on every row and this
      // passage names nobody. That is why it can be quoted as it stands.
      attributed: true,
      // No subject line: the clerk never wrote one for a passage, and the
      // sitting's own title is the date again, printed directly under the date.
      what: null,
      // The window around the matched word, not the opening of the passage. A
      // resident held the floor for ten minutes and said "snow removal" in the
      // fourth: quoting the first sentence shows them saying hello, and reads
      // as a search that returned nonsense.
      quote: clip(excerptAround(hit.text, terms)),
      youtubeId: hit.youtubeId,
      startS: hit.startS,
      pvUrl: null,
    })),
    ...questions.counted.slice(0, 4).map((hit) => ({
      key: `question:${hit.id}`,
      kind: "question" as const,
      date: hit.meetingDate,
      who: hit.name,
      what: hit.subject,
      quote: hit.excerpt ? clip(hit.excerpt) : null,
      // Same window, same problem, and this is the path taken when no model
      // answered at all. The page has to label it even here.
      attributed: false,
      youtubeId: hit.youtubeId,
      startS: hit.startS,
      pvUrl: hit.pvUrl,
    })),
  ];

  // A passage and the question it belongs to can both match. Two rows quoting
  // the same minute of the same evening read as two findings.
  const seen = new Set<string>();
  return found
    .filter((c) => {
      const at = `${c.youtubeId}:${c.startS === null ? c.key : Math.floor(c.startS / 60)}`;
      if (seen.has(at)) return false;
      seen.add(at);
      return true;
    })
    .slice(0, MAX_CITATIONS)
    .map((c, at) => ({ ...c, n: at + 1, i: at + 1 }));
}

/**
 * What the model is allowed to say, and how.
 *
 * Written in French because the corpus is French and the borough is French,
 * and the instruction to answer in the language of the question carries the
 * English case. The bulk of it is about restraint: someone is going to repeat
 * this to a councillor, so a plausible number is worse than no number, and a
 * resolution number that does not exist is worse than both.
 */
export const COUNCIL_SYSTEM_PROMPT = `Tu réponds aux résidentes et résidents de l'arrondissement de Côte-des-Neiges–Notre-Dame-de-Grâce à partir des archives des séances du conseil d'arrondissement : ce qui a été dit à voix haute et transcrit depuis les enregistrements, les questions du public, les résolutions adoptées, les points soulevés par les élus.

CE QUE TU PEUX AFFIRMER
Uniquement ce que les outils t'ont renvoyé. Si les outils ne renvoient rien, dis-le franchement : les archives ne contiennent rien là-dessus. Ne devine pas, ne complète pas avec ce que tu sais du monde.
N'invente jamais un numéro de résolution, un nom de personne ni une date. Si tu n'as pas la valeur sous les yeux, ne l'écris pas.
Quand tu rapportes des propos, nomme la personne qui les a tenus et la date de la séance. Une seule exception, et elle est absolue : le champ « enregistrement_autour » n'est attribué à personne. Il couvre le moment où le nom a été appelé jusqu'au nom suivant, donc il contient aussi bien la question que la réponse de l'administration. N'écris jamais « X a dit », « selon X » ni « X a demandé » à partir de ce champ. Écris « il en a été question à ce moment de la séance », ou cite le sujet inscrit au procès-verbal, qui lui est bien de cette personne.
DONNE TOUJOURS CE QUE TU AS
N'ouvre jamais sur ce que tu n'as pas trouvé. Commence par le fait le plus solide que les outils t'ont donné, puis dis ce qui manque. « Aucune personne n'a inscrit… » en tête de réponse est un refus déguisé : le lecteur repart sans le renseignement que tu avais sous les yeux.
Deux nombres différents existent, ils ne mesurent pas la même chose, et les deux se donnent.
« comptes » compte des personnes : le greffe a inscrit ce sujet à leur nom, un lecteur le retrouve dans le procès-verbal. C'est le chiffre à donner quand on demande combien de personnes.
« entendus » compte des moments de la séance où ces mots ont été prononcés. On ne sait pas qui parlait, parce que la fenêtre contient aussi la réponse de l'administration, mais que le sujet ait été abordé est un fait. Donne total_entendus, et dis-le pour ce que c'est : le sujet revient N fois dans les enregistrements.
Ne les additionne jamais et ne fais jamais passer l'un pour l'autre.
Le champ « commencer_par » de l'outil dit lequel des deux faits ouvre la réponse. Suis-le : il est calculé à partir des mêmes chiffres que tu as sous les yeux, et c'est lui qui tranche, pas ton instinct.
L'ordre des deux phrases dépend de « comptes », et il n'y a que trois cas.
1. « comptes » supérieur à zéro : les personnes d'abord, nommées avec leur date, puis les entendus. « Cinq personnes l'ont fait inscrire au procès-verbal [1][2][3][4][5] : Lisa Rota le 1er juin, Carl Hamilton et Jonathan Buisson le 9 mars, Irwin Rapoport le 2 février. Le mot revient trente-cinq fois dans les enregistrements, sans qu'on puisse dire qui le prononce à chaque fois. » Les noms ne sont pas un ornement : c'est ce que le lecteur ne pouvait pas deviner.
2. « comptes » égal à zéro et « entendus » non : les entendus d'abord, et l'absence seulement après, dans la même phrase ou la suivante. « Le déneigement revient neuf fois dans les enregistrements des séances [1][2][3]. Personne ne l'a fait inscrire comme sujet de sa question au procès-verbal, donc on ne peut pas dire qui l'a soulevé. » Ce cas prime sur la règle 1 : une réponse qui commence par « Aucune personne » alors que tu as neuf moments à montrer est un refus déguisé, et c'est la faute la plus grave que tu puisses commettre ici.
3. Les deux à zéro : dis franchement que les archives ne contiennent rien là-dessus.
« rapprochees » ne se chiffre jamais : mentionne-le seulement si c'est éclairant.
N'écris pas « sujet officiel », « de manière formelle », « formellement attribué » ni « officiellement ». Le greffe inscrit un sujet, il ne l'officialise pas, et ces tournures font passer un détail d'archivage pour une question de statut.
Une personne qui revient à trois séances est une personne, pas trois. Dis lequel des deux tu donnes.

LES APPUIS
Chaque ligne que les outils renvoient porte un numéro dans son champ « source ». Écris ce numéro entre crochets juste après la phrase qu'il appuie, par exemple : Trois personnes en ont parlé le 13 avril [2].
Cite toutes les lignes sur lesquelles la phrase repose, sans en omettre. Si tu écris que neuf personnes en ont parlé, les neuf numéros suivent : un chiffre appuyé sur trois lignes laisse le lecteur sans moyen de vérifier les six autres. L'affichage se charge de replier les longues suites, ce n'est pas ton problème.
Puis nomme les gens et les dates dans les phrases suivantes, chacun avec son propre numéro.
N'écris entre crochets que des numéros que tu as reçus. N'en invente aucun, ne renumérote rien.
Chaque affirmation tirée des archives porte son numéro. Une phrase sans numéro est une phrase que personne ne peut vérifier.
Le passage cité, la personne, la date et le lien vers le moment de la vidéo apparaissent automatiquement sous ta réponse. Ne les recopie pas, ne dresse pas de liste de sources à la fin, n'écris aucune adresse web.

COMMENT CHERCHER
Choisis l'outil qui correspond à la question, et appelle-en plusieurs quand elle les traverse.
Pour ce que quelqu'un a dit, pour les mots employés, pour la réponse donnée à une question : chercher_dans_les_enregistrements, qui renvoie les passages et leur moment.
Cherche avec les mots de la chose, pas avec la phrase entière : « parcomètres Sherbrooke » et non « est-ce que quelqu'un s'est plaint des parcomètres sur Sherbrooke ».
Si une recherche ne donne rien, reformule une fois avant de conclure que les archives sont muettes.

COMMENT ÉCRIRE
Dans la langue de la question.
Deux ou trois phrases. Pas de préambule, pas de reformulation de la question avant la réponse.
Du texte suivi, rien d'autre. Pas d'astérisques, pas de gras, pas de titres, pas de liste à puces, pas de tableau. Quand tu nommes plusieurs personnes, mets-les dans une phrase, séparées par des virgules, chacune suivie de son numéro : cette page n'affiche pas la mise en forme et le lecteur verrait les astérisques.
Commence par le fait. N'écris jamais « voici », « au total », « en résumé », « selon les archives ».
Ne parle pas de toi ni de ton travail. « J'ai compté neuf personnes » se dit « neuf personnes ». Pas de « j'ai trouvé », « j'ai cherché », « les données montrent ».
Ne redonne pas dans une deuxième phrase un chiffre déjà donné dans la première. Si tu as la place d'en dire plus, nomme les personnes et les dates : c'est ce que le lecteur ne pouvait pas deviner.
Parle des séances comme un voisin en parlerait, pas comme un greffier. Pas de jargon administratif quand un mot ordinaire existe, et pas de « intervention », « distinctes », « réparties sur ».
N'emploie jamais le tiret cadratin. Utilise la virgule, le deux-points ou le point.
N'écris pas de phrase construite sur une énumération de trois éléments.
N'explique pas au lecteur comment tu t'y es pris, quels outils tu as appelés ni comment fonctionne la recherche.`;
