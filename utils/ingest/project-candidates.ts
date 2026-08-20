/**
 * Which council decisions look like a project, and what to propose from one.
 *
 * The cron does not scrape montreal.ca. `utils/projects.ts` explains why that
 * would be a bad idea — the city rebuilds and retires those pages on its own
 * schedule, and a scraper that silently returns nothing is worse than nothing —
 * and it turns out there is a better source already in this database. The
 * council record is ingested every sitting, it is the borough's own published
 * account of what it decided, and it carries the dossier number and the date.
 *
 * What it does not carry is any notion of "project". So this file decides, and
 * the honest thing to say about that decision is that it is a filter over
 * titles written by a clerk, not an understanding of municipal works. It is
 * tuned to be roughly right and to fail toward proposing too much, because
 * everything it proposes lands in a waitlist that a person reads. A missed
 * project is invisible; a wrongly proposed one costs somebody one click.
 *
 * Measured against the 2026 sittings, of 142 resolutions:
 *
 *   49 carry a 20.xx agenda code, the contracts-and-subsidies series
 *   16 of those are the contract family rather than a grant to an organisation
 *   10 of those name a place — Mackenzie-King, the Loyola chalet, Trenholme,
 *      Jean-Brillant, the Côte-des-Neiges sports centre, Le Manoir
 *
 * The other six are backhoe rentals and sidewalk-sweeper leases, which are
 * contracts about equipment rather than about anywhere, and those are what the
 * exclusion below is for.
 */

// Relative, with the extension: this module is imported both by the Next
// bundler and by a bare `node --experimental-strip-types` script, and the `@/`
// alias only exists for the first of those.
import { unshout } from "../council.ts";

/**
 * Repair a word the PDF broke across a line.
 *
 * `parse_pv.py` reads the proces-verbal as text, and where the clerk's template
 * wrapped a hyphenated name the hyphen keeps its line break: the corpus holds
 * "MACKENZIE- KING", "CÔTE-DES- NEIGES" and "PRR-PCPR-2026" side by side. Only
 * the first two are damage, and they are distinguishable — a hyphen followed by
 * a space, inside a word, is never how anybody writes.
 */
export const mendHyphens = (text: string): string =>
  text.replace(/(\p{L})-\s+(\p{L})/gu, "$1-$2").replace(/\s+/g, " ").trim();

/** One council decision, as much of it as this needs. */
export type ResolutionCandidate = {
  number: string;
  title: string;
  body: string | null;
  outcome: string | null;
  dossier: string | null;
  meetingDate: string;
  youtubeId: string | null;
};

/**
 * The contract family.
 *
 * A grant to a community organisation is a real decision and belongs in the
 * council archive, which already has it. It is not a project: there is no place
 * to photograph and no work to follow. Twenty-five of the forty-nine 20.xx rows
 * are those, and letting them through would bury the ten that matter.
 */
const CONTRACT = /^(contrats?|renouvellement contrat|d[ée]pense additionnelle|r[ée]siliation|cession de \d+ contrats?)\b/i;

/**
 * Something with an address, or work done to it.
 *
 * Two ways to qualify, because the clerk writes both ways round: "CONTRAT –
 * GROUPE PICHÉ – CENTRE SPORTIF TRENHOLME" names the place and not the work,
 * while "CONTRAT – URBEX – PROJETS D'AMÉNAGEMENT ET DE DÉMINÉRALISATION" names
 * the work and not the place.
 */
const PLACE = /\b(parc|centre|chalet|piscine|biblioth[èe]que|ar[ée]na|stade|terrain|jardin|place|maison|pavillon|complexe|patinoire|rue|avenue|boulevard|chemin|ruelle|square)\b/i;
const WORKS = /\b(travaux|r[ée]am[ée]nagement|r[ée]fection|am[ée]nagement|construction|d[ée]min[ée]ralisation|verdissement|r[ée]novation|mise aux normes|planage|rev[êe]tement)\b/i;

/**
 * Contracts about a thing rather than about a place.
 *
 * Renting a backhoe is not a project even though the sentence contains the word
 * contract, and "location d'appareil lave-trottoirs" contains none of the place
 * words either — but "service d'hydro-excavation" would slip past on nothing,
 * and an equipment lease that happens to name a street would slip past on the
 * street. Checked before the two above, so it wins.
 */
const EQUIPMENT = /\b(location|louer|service d[e']|acquisition de|achat d[e']|fourniture de|[ée]lagage|abattage|essouchement|d[ée]neigement m[ée]canique)\b/i;

/** True when a decision is worth putting in front of somebody as a project. */
export function looksLikeProject(title: string): boolean {
  const clean = mendHyphens(title);
  if (!CONTRACT.test(clean)) return false;
  if (EQUIPMENT.test(clean)) return false;
  return PLACE.test(clean) || WORKS.test(clean);
}

/**
 * The part of a resolution title that names the thing.
 *
 * The clerk's format is "WHAT - WHO - WHERE": "CONTRAT - LIMOGES ET FILS INC. -
 * RÉAMÉNAGEMENT DU PARC MACKENZIE-KING". The last segment is the only one a
 * resident would recognise, and the middle one is a contractor's legal name,
 * which is exactly what should not become the title of a page about a park.
 */
export function subjectOf(title: string): string {
  const parts = mendHyphens(title)
    .split(/\s+[-–]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? title).trim();
}

/**
 * A URL slug from a subject line.
 *
 * Never guaranteed unique — two sittings can award two contracts on the same
 * park, and the second proposal will collide. The cron resolves that by
 * proposing an *edit* to the project that already holds the slug rather than a
 * second project beside it, which is the behaviour anybody would want anyway.
 */
export function slugOf(subject: string): string {
  return subject
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter((w) => !["de", "du", "des", "la", "le", "les", "et", "au", "aux", "d", "l"].includes(w))
    .join("-")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * What the machine is prepared to assert, and nothing beyond it.
 *
 * Deliberately incomplete. There is no photograph, because there is no
 * photograph to have, and there is one milestone, because one thing has
 * happened. `project_content_complete` will refuse this, which is the intended
 * outcome: it sits in the waitlist until a person adds the picture and the
 * second date. Writing a plausible second milestone here — "travaux prévus" —
 * would be the machine inventing a schedule nobody announced.
 *
 * The English half is the French half. A translation is not available at this
 * point and a machine-translated municipal commitment is worse than an obvious
 * gap, so the field is filled with the original and the reviewer replaces it.
 * The completeness check cannot tell the difference, which is a known limit of
 * the check and not of this: the person who approves is the one who reads.
 */
export function draftFrom(candidate: ResolutionCandidate) {
  const subject = unshout(subjectOf(candidate.title));
  const full = unshout(candidate.title);

  return {
    slug: slugOf(subjectOf(candidate.title)),
    content: {
      title: { fr: subject, en: subject },
      summary: { fr: full, en: full },
      status: "decided" as const,
      address: "",
      description: [
        {
          fr: `Le conseil d'arrondissement a adopté la résolution ${candidate.number} le ${candidate.meetingDate}. ${full}.`,
          en: `The borough council adopted resolution ${candidate.number} on ${candidate.meetingDate}. ${full}.`,
        },
      ],
      photos: [] as never[],
      milestones: [
        {
          on: candidate.meetingDate,
          title: { fr: subject, en: subject },
          body: candidate.outcome
            ? { fr: unshout(candidate.outcome), en: unshout(candidate.outcome) }
            : undefined,
          resolution: candidate.number,
        },
      ],
      sources: [] as never[],
    },
  };
}

// --- planning -------------------------------------------------------------

/** A project as the planner needs to see it. */
export type KnownProject = { id: string; slug: string; content: ProjectContentish };

/** Only the parts of a project's content the planner touches. */
export type ProjectContentish = {
  councilTerm?: string;
  milestones: unknown[];
  [key: string]: unknown;
};

export type Proposal = {
  project_id: string | null;
  slug: string;
  content: Record<string, unknown>;
  resolution_number: string;
  source_note: string;
  /** Which of the two things this is, for the report the caller prints. */
  kind: "created" | "edited";
};

export type Plan = { proposals: Proposal[]; skipped: string[] };

/**
 * Decide what to propose, without touching a database.
 *
 * Pure, and that is the point: the cron route reaches Postgres through the
 * Supabase client and `npm run sync:projects` reaches it through `pg`, and the
 * one thing that must not exist in two versions is the judgement about what
 * counts as a project and which project a decision belongs to. Both callers
 * fetch, call this, and write what it returns.
 */
export function planProposals(input: {
  candidates: ResolutionCandidate[];
  projects: KnownProject[];
  /** Resolution numbers already proposed once, whatever the verdict was. */
  alreadyProposed: Set<string>;
  /** Project ids, or slugs for new ones, that already have something waiting. */
  pendingTargets: Set<string>;
}): Plan {
  const { candidates, projects, alreadyProposed } = input;
  const pending = new Set(input.pendingTargets);

  const proposals: Proposal[] = [];
  const skipped: string[] = [];

  for (const candidate of candidates) {
    if (alreadyProposed.has(candidate.number)) continue;

    const subject = subjectOf(candidate.title);
    const slug = slugOf(subject);
    if (!slug) {
      skipped.push(`${candidate.number} (aucun intitulé exploitable)`);
      continue;
    }

    // A project this decision belongs to: the same slug, or one whose
    // councilTerm the borough put there so the record could be matched back.
    const match = projects.find(
      (p) =>
        p.slug === slug ||
        (p.content.councilTerm &&
          subject.toLowerCase().includes(p.content.councilTerm.toLowerCase())),
    );

    // The unique partial index refuses a second pending proposal for one
    // target. Checked here so the report says "already waiting" instead of the
    // caller catching a constraint violation and printing it at somebody.
    const target = match?.id ?? slug;
    if (pending.has(target)) {
      skipped.push(`${candidate.number} (déjà en attente : ${match?.slug ?? slug})`);
      continue;
    }

    const drafted = match
      ? { project_id: match.id, slug: match.slug, content: withMilestone(match.content, candidate) }
      : { project_id: null, ...draftFrom(candidate) };

    proposals.push({
      ...drafted,
      content: drafted.content as Record<string, unknown>,
      resolution_number: candidate.number,
      source_note: sourceNote(candidate),
      kind: match ? "edited" : "created",
    });
    pending.add(target);
  }

  return { proposals, skipped };
}

/**
 * The project as it stands, plus one dated line for what just happened.
 *
 * Nothing else is touched. An automatic edit that rewrote the summary or
 * reordered the photographs would be a machine editing prose a person wrote,
 * and the reviewer would have to read the whole page to find what changed.
 * Appending is the one change that can be checked at a glance.
 */
export function withMilestone(
  content: ProjectContentish,
  candidate: ResolutionCandidate,
): ProjectContentish {
  const subject = unshout(subjectOf(candidate.title));
  return {
    ...content,
    milestones: [
      ...content.milestones,
      {
        on: candidate.meetingDate,
        title: { fr: subject, en: subject },
        body: candidate.outcome
          ? { fr: unshout(candidate.outcome), en: unshout(candidate.outcome) }
          : undefined,
        resolution: candidate.number,
      },
    ],
  };
}

/** What the machine read, so a reviewer can check it rather than trust it. */
export function sourceNote(candidate: ResolutionCandidate): string {
  return [
    `Résolution ${candidate.number}, séance du ${candidate.meetingDate}`,
    candidate.dossier ? `dossier ${candidate.dossier}` : null,
    candidate.outcome ? unshout(candidate.outcome) : null,
    unshout(candidate.title),
  ]
    .filter(Boolean)
    .join(" · ");
}
