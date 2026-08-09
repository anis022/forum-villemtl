/**
 * The people elected for Côte-des-Neiges–Notre-Dame-de-Grâce, and every seat
 * they hold.
 *
 * Held as data rather than fetched from montreal.ca: the source page is
 * rendered client-side behind a query-string filter, and a borough council
 * changes once every four years. A file that is edited by hand after an
 * election is more honest than a scraper that silently returns nothing the day
 * the city redesigns its portal.
 *
 * Portraits are the city's own, copied into `public/elus/` for the same reason —
 * a hotlink to somebody else's CDN is a face that disappears without warning.
 *
 * Institution names carry both languages. They are not translated here so much
 * as recorded: each of these bodies has an official name in each language, and
 * inventing a third one on a municipal site would be worse than leaving it in
 * French.
 *
 * Source: https://montreal.ca/personnes-elues?dc_coverage.boroughs.code=CDNNDG
 * and each person's page beneath it. Checked: 4 August 2026.
 */

import type { Locale } from "@/utils/i18n";

export type Localized = { fr: string; en: string };

export const say = (text: Localized, lang: Locale) => text[lang];

/** One seat: what they are, on what body. */
export type Mandate = {
  /** "Conseiller de la Ville", "Présidente", "Membre" — gendered, so per person. */
  title: Localized;
  /** The council, committee or commission the seat is on. */
  body: Localized;
  /**
   * The file they carry there. Only the executive committee hands these out,
   * and it is the most concrete thing on the page: "responsable de
   * l'optimisation" says what to write to them about far better than a seat
   * name does.
   */
  portfolio?: Localized;
  /** That body's page on montreal.ca, where one exists. */
  url?: string;
};

export type Official = {
  /**
   * The portrait's filename in `public/elus/`, and the handle their profile
   * lives at: `/fr/profil/teodoresco`. Elected officials share the residents'
   * profile page rather than getting a page of their own — the point of this
   * forum is that they are in the conversation, not beside it — and the slug
   * is the handle that works whether or not there is an account behind it.
   */
  slug: string;
  /**
   * Their forum account, once they have one. Null until then; the profile page
   * falls back to an empty history rather than inventing one.
   *
   * The four ids below belong to the demonstration community
   * (`supabase/demo-seed.sql`) and not to the people themselves — nobody on
   * this council has signed up. They are written here rather than looked up
   * because the seed derives them, uuid v5, from the same slugs in this file:
   * the value is a function of the name, so it is knowable without a round trip
   * and stable across every run of the seed. On a database where the seed has
   * not been applied the row simply is not there, and the profile page falls
   * back exactly as it did when this was null.
   */
  profileId: string | null;
  name: string;
  /** Split out for the avatar's initials and for `Prénom Nom` ordering. */
  firstName: string;
  /**
   * The surname, spelled out rather than split off `name`: "de la Rocha" and
   * "Ben Salah" are not the last word of anything, and a list of neighbours'
   * representatives is the wrong place to be clever about people's names.
   */
  surname: string;
  /** The electoral district, or null for the borough mayor, who has no one. */
  district: string | null;
  /** `role` keys resolve against the dictionary — the titles are gendered. */
  role: "mayor" | "councillorF" | "councillorM";
  party: string;
  mandates: Mandate[];
  /**
   * Where this row came from. Not rendered — the profile page shows the seats
   * and nothing else — but a hand-maintained file about real people should say
   * per person what it was copied from, so the next election's edit can be
   * checked against the source rather than against memory.
   */
  profileUrl: string;
};

const MTL = "https://montreal.ca";

const EXECUTIVE: Mandate["body"] = { fr: "Comité exécutif", en: "Executive Committee" };
const CITY_COUNCIL: Mandate["body"] = { fr: "Conseil municipal", en: "City Council" };
const AGGLOMERATION: Mandate["body"] = {
  fr: "Conseil d'agglomération",
  en: "Agglomeration Council",
};
const BOROUGH_COUNCIL: Mandate["body"] = {
  fr: "Conseil d'arrondissement de Côte-des-Neiges–Notre-Dame-de-Grâce",
  en: "Côte-des-Neiges–Notre-Dame-de-Grâce Borough Council",
};

const EXECUTIVE_URL = `${MTL}/conseils-decisionnels/comite-executif`;
const CITY_COUNCIL_URL = `${MTL}/conseils-decisionnels/conseil-municipal`;
const AGGLOMERATION_URL = `${MTL}/conseils-decisionnels/conseil-dagglomeration`;
const BOROUGH_COUNCIL_URL = `${MTL}/conseils-decisionnels/conseil-darrondissement-de-cote-des-neiges-notre-dame-de-grace`;

const COUNCILLOR_M: Localized = { fr: "Conseiller de la Ville", en: "City councillor" };
const COUNCILLOR_F: Localized = { fr: "Conseillère de la Ville", en: "City councillor" };
const MAYOR_F: Localized = { fr: "Mairesse d'arrondissement", en: "Borough mayor" };
const MEMBER_F: Localized = { fr: "Membre", en: "Member" };
const CHAIR_M: Localized = { fr: "Président", en: "Chair" };

const PARTY = "Ensemble Montréal – Équipe Soraya";

const ROSTER: Official[] = [
  {
    slug: "valenzuela",
    profileId: "590744e9-3f01-5feb-9ed0-7aaae61b9257",
    name: "Stéphanie Valenzuela",
    firstName: "Stéphanie",
    surname: "Valenzuela",
    district: null,
    role: "mayor",
    party: PARTY,
    profileUrl: `${MTL}/elus/stephanie-valenzuela-22238`,
    mandates: [
      { title: MAYOR_F, body: BOROUGH_COUNCIL, url: BOROUGH_COUNCIL_URL },
      { title: MAYOR_F, body: CITY_COUNCIL, url: CITY_COUNCIL_URL },
      {
        title: MAYOR_F,
        body: EXECUTIVE,
        url: EXECUTIVE_URL,
        portfolio: {
          fr: "Responsable du rayonnement international et de l'attractivité",
          en: "Responsible for international outreach and attractiveness",
        },
      },
    ],
  },
  {
    slug: "thiagarajah",
    profileId: "228c144e-2413-5749-8178-e8f374534d31",
    name: "Milany Thiagarajah",
    firstName: "Milany",
    surname: "Thiagarajah",
    district: "Darlington",
    role: "councillorF",
    party: PARTY,
    profileUrl: `${MTL}/elus/milany-thiagarajah-100452`,
    mandates: [
      { title: COUNCILLOR_F, body: BOROUGH_COUNCIL, url: BOROUGH_COUNCIL_URL },
      { title: COUNCILLOR_F, body: CITY_COUNCIL, url: CITY_COUNCIL_URL },
      {
        title: MEMBER_F,
        body: {
          fr: "Commission sur les finances et l'administration",
          en: "Commission on Finance and Administration",
        },
      },
      {
        title: MEMBER_F,
        body: {
          fr: "Commission sur le transport et les travaux publics",
          en: "Commission on Transportation and Public Works",
        },
      },
    ],
  },
  {
    slug: "teodoresco",
    profileId: "d9a14b6d-8a9c-5139-a203-8740412426ef",
    name: "Alexandre Teodoresco",
    firstName: "Alexandre",
    surname: "Teodoresco",
    district: "Loyola",
    role: "councillorM",
    party: PARTY,
    profileUrl: `${MTL}/elus/alexandre-teodoresco-100445`,
    mandates: [
      { title: COUNCILLOR_M, body: BOROUGH_COUNCIL, url: BOROUGH_COUNCIL_URL },
      { title: COUNCILLOR_M, body: CITY_COUNCIL, url: CITY_COUNCIL_URL },
      { title: COUNCILLOR_M, body: AGGLOMERATION, url: AGGLOMERATION_URL },
      {
        title: COUNCILLOR_M,
        body: EXECUTIVE,
        url: EXECUTIVE_URL,
        portfolio: {
          fr: "Responsable de l'optimisation, de la performance municipale et de l'innovation",
          en: "Responsible for optimization, municipal performance and innovation",
        },
      },
    ],
  },
  {
    slug: "moroz",
    profileId: "36bbfb80-19dd-5c1c-8771-30eb5e428b6f",
    name: "Sonny Moroz",
    firstName: "Sonny",
    surname: "Moroz",
    district: "Snowdon",
    role: "councillorM",
    party: PARTY,
    profileUrl: `${MTL}/elus/sonny-moroz-22279`,
    mandates: [
      { title: COUNCILLOR_M, body: BOROUGH_COUNCIL, url: BOROUGH_COUNCIL_URL },
      { title: COUNCILLOR_M, body: CITY_COUNCIL, url: CITY_COUNCIL_URL },
      {
        title: CHAIR_M,
        body: {
          fr: "Commission sur le développement social et la diversité montréalaise",
          en: "Commission on Social Development and Montreal Diversity",
        },
      },
    ],
  },
];

/**
 * Alphabetical by first name — the name the cards lead with, so the order the
 * page is in is the order a reader can actually follow. It is also the one
 * order that puts nobody above anybody else. Sorted here rather than kept
 * sorted by hand, so the list above can be edited after an election without the
 * page quietly ending up out of order.
 *
 * `localeCompare` with a locale, not a raw `<`: this is a French page, and
 * codepoint order files "Étienne" after "Zoé".
 */
export const OFFICIALS: Official[] = [...ROSTER].sort((a, b) =>
  a.firstName.localeCompare(b.firstName, "fr"),
);

export const officialBySlug = (slug: string): Official | undefined =>
  OFFICIALS.find((person) => person.slug === slug);

/**
 * The other direction, for the handle a thread actually links with. A reply
 * carries its author's account id, so following an elected person's name out of
 * a conversation arrives at `/profil/<uuid>` rather than at their slug. Without
 * this the same person has two profiles — one with their seats on it, one
 * reading "membre depuis mars" like any resident's.
 */
export const officialByProfileId = (id: string): Official | undefined =>
  OFFICIALS.find((person) => person.profileId === id);
