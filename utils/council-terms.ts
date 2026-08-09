/**
 * Bilingual query expansion for the council search.
 *
 * The corpus is bilingual and so are the people searching it. Someone types
 * "sidewalk"; the clerk wrote "trottoir". Postgres indexes the transcript under
 * both a French and an English configuration, but that only handles stemming --
 * it will match "sidewalks" to "sidewalk" and never to "trottoir". Nothing in
 * full-text search crosses a language.
 *
 * Counting is done on literal word matches (see 0018): that is what makes a
 * number on the page defensible, and it is also what makes this file load-
 * bearing. A resident who asks in English and is told "0 people raised this"
 * because the answer was filed in French has been given a wrong answer, not a
 * partial one.
 *
 * So the query is widened before it reaches SQL. This is deliberately a hand-
 * written list of the borough's own vocabulary rather than a general
 * translation model: it runs in microseconds, it costs nothing, it is
 * inspectable, and when it is wrong it is wrong in a way someone can fix by
 * editing a line. It lives in TypeScript rather than in the migration so that
 * correcting it is a deploy, not a schema change.
 */

/**
 * Groups of words that mean the same thing here. Order within a group does not
 * matter -- matching any member pulls in all the others.
 *
 * Kept to the things a resident actually brings to a council meeting. A
 * thesaurus of general French would add noise and cost recall precision.
 */
const SYNONYMS: string[][] = [
  ["trottoir", "trottoirs", "sidewalk", "sidewalks"],
  ["piste cyclable", "pistes cyclables", "bike lane", "bike lanes", "bike path", "cycling"],
  ["vélo", "velo", "vélos", "bicycle", "bike", "cyclist", "cycliste"],
  ["déneigement", "deneigement", "neige", "snow removal", "snow", "plow", "déneiger"],
  ["stationnement", "parking", "vignette", "permit parking"],
  ["circulation", "traffic", "congestion"],
  ["sécurité routière", "securite routiere", "road safety", "traffic calming", "apaisement"],
  ["piéton", "pieton", "piétons", "pedestrian", "pedestrians", "traverse", "crosswalk"],
  ["logement", "logements", "housing", "logement social", "social housing", "affordable"],
  ["itinérance", "itinerance", "homeless", "homelessness", "sans-abri"],
  ["propreté", "proprete", "cleanliness", "garbage", "déchets", "dechets", "trash", "litter"],
  ["ruelle", "ruelles", "alley", "alleyway", "laneway"],
  ["parc", "parcs", "park", "parks", "green space", "espace vert"],
  ["arbre", "arbres", "tree", "trees", "canopée", "canopee", "canopy"],
  ["bruit", "noise", "nuisance sonore"],
  ["taxes", "taxe", "tax", "budget", "impôt", "impot"],
  ["zonage", "zoning", "urbanisme", "urban planning", "dérogation", "derogation"],
  ["construction", "chantier", "travaux", "works", "roadwork", "réfection", "refection"],
  ["transport collectif", "public transit", "transit", "autobus", "bus", "stm", "métro", "metro"],
  ["aréna", "arena", "piscine", "pool", "centre sportif", "sports centre"],
  ["bibliothèque", "bibliotheque", "library"],
  ["chien", "chiens", "dog", "dogs", "canin"],
  ["rat", "rats", "rongeur", "vermin", "raton", "racoon", "raccoon"],
  ["accessibilité", "accessibilite", "accessibility", "universal access"],
  ["consultation", "consultation publique", "public consultation", "référendum", "referendum"],
  ["sécurité", "securite", "safety", "security", "police", "spvm", "crime"],
  ["école", "ecole", "school", "schools", "scolaire"],
  ["aîné", "aine", "aînés", "seniors", "elderly", "personnes âgées", "personnes agees"],
  ["inondation", "flooding", "flood", "égout", "egout", "sewer", "refoulement"],
  ["eau", "water", "aqueduc", "drinking water", "eau potable"],
];

/** word (lowercased, unaccented) -> every phrase in its group. */
const EXPANSIONS = new Map<string, Set<string>>();

/** Accents and case are noise for matching; the tsvector folds them anyway. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

for (const group of SYNONYMS) {
  for (const term of group) {
    const key = fold(term);
    const set = EXPANSIONS.get(key) ?? new Set<string>();
    for (const other of group) set.add(other);
    EXPANSIONS.set(key, set);
  }
}

/** The longest phrase in the table, so multi-word terms are found first. */
const MAX_PHRASE_WORDS = Math.max(
  ...SYNONYMS.flat().map((t) => t.split(/\s+/).length),
);

/**
 * Widen a user's query with the borough's other word for the same thing.
 *
 * The result is fed to `websearch_to_tsquery`, whose OR is the bare word `or`.
 * Every alternative for one concept is grouped, and the groups are left
 * adjacent -- which `websearch_to_tsquery` reads as AND. So "sidewalk Wilson"
 * becomes roughly `(trottoir or sidewalk) and Wilson`: still a query about a
 * specific sidewalk, not about every sidewalk ever mentioned.
 *
 * Words with no entry pass through untouched, which is what keeps street and
 * resident names working -- they are the majority of real searches.
 */
export function expandQuery(query: string): string {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return query.trim();

  const out: string[] = [];
  let i = 0;

  while (i < words.length) {
    let matched = false;

    // Longest phrase first: "piste cyclable" must win over "piste" alone.
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length - i); n >= 1; n--) {
      const phrase = words.slice(i, i + n).join(" ");
      const group = EXPANSIONS.get(fold(phrase));
      if (!group) continue;

      // Multi-word alternatives are quoted so the tsquery keeps them together.
      const alts = [...group].map((t) => (t.includes(" ") ? `"${t}"` : t));
      out.push(alts.length > 1 ? `(${alts.join(" or ")})` : alts[0]);
      i += n;
      matched = true;
      break;
    }

    if (!matched) {
      out.push(words[i]);
      i += 1;
    }
  }

  return out.join(" ");
}

/**
 * Whether the query mentions any term this file knows about. The page uses it
 * to explain, when a search finds nothing, whether it widened the words or
 * took them literally.
 */
export function hasKnownTerms(query: string): boolean {
  return expandQuery(query) !== query.trim();
}
