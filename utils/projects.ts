/**
 * The borough's projects, as this site tracks them.
 *
 * Held as data in the repository rather than fetched, for the same reason as
 * `utils/officials.ts`: montreal.ca publishes project pages that are rebuilt,
 * renamed and retired on the city's own schedule, and a scraper that silently
 * returns nothing is worse than a file somebody edits after reading the
 * minutes. Everything here is written down somewhere public, and `sources`
 * says where.
 *
 * Three things are required of every project, and the types enforce all three:
 *
 *   description   what it is, in prose, in both languages
 *   photos        at least one, of the actual place
 *   milestones    at least two, so it reads as a history and not as an update
 *
 * That is a deliberately high bar. A project with a paragraph and no picture is
 * a press release; a project with pictures and no dates is an advertisement.
 * The bar is why this file currently holds one project instead of six: the
 * borough decided several things this year (the Loyola chalet, Mackenzie-King,
 * the Trenholme sports centre) that are real and cited in the council record,
 * but each is a single dated contract with no photograph of the place, and
 * padding this page with those would break the rule it exists to keep.
 *
 * Photos are copied into `public/projets/` rather than hotlinked, and credited
 * in `public/projets/CREDITS.md`.
 */

import type { Locale } from "@/utils/i18n";

export type Localized = { fr: string; en: string };

export const say = (text: Localized, lang: Locale) => text[lang];

/**
 * Where a project stands. Not the same vocabulary as a report's status: a
 * report is answered or resolved, a project is decided or under way.
 */
export type ProjectStatus = "study" | "decided" | "underway" | "done";

/** One dated thing that happened, or is scheduled to. */
export type Milestone = {
  /** ISO date when the day is known, `YYYY` or `YYYY-MM` when it is not. */
  on: string;
  /** Rendered when the date is deliberately vague: "été 2026", "2012–2015". */
  onLabel?: Localized;
  title: Localized;
  body?: Localized;
  /**
   * The council resolution that carries it, where there is one. Printed as the
   * borough numbers it, so a reader can find it in the minutes.
   */
  resolution?: string;
  /** Where this is written down, when it is not the council record. */
  source?: { label: Localized; url: string };
};

export type ProjectPhoto = {
  /** A path under `public/`. */
  src: string;
  /** What it shows, and when. An archive photo has to say that it is one. */
  caption: Localized;
  /** Author and licence. CC BY and CC BY-SA require this to be shown. */
  credit: string;
};

export type Project = {
  slug: string;
  title: Localized;
  /** One sentence, for the card. */
  summary: Localized;
  status: ProjectStatus;
  /** Street address, as a resident would say it. */
  address: string;
  /** The description proper, one entry per paragraph. */
  description: Localized[];
  /** At least one. The first is the card image and the page's lead. */
  photos: [ProjectPhoto, ...ProjectPhoto[]];
  /** At least two, oldest first. */
  milestones: [Milestone, Milestone, ...Milestone[]];
  /**
   * What to look for in the council record, so the page can show the sittings
   * where residents actually raised it. Matched literally against the subject
   * lines the clerk recorded. See `councilMentions`.
   */
  councilTerm?: string;
  /** Further reading, shown at the foot of the page. */
  sources: { label: Localized; url: string }[];
};

const PROJECTS: Project[] = [
  {
    slug: "theatre-empress",
    title: { fr: "Théâtre Empress", en: "Empress Theatre" },
    summary: {
      fr: "Déconstruction du cinéma de 1927 avec conservation de la façade néo-égyptienne, et aménagement d'un lieu culturel extérieur temporaire.",
      en: "Deconstruction of the 1927 cinema with its Egyptian Revival façade kept, and a temporary outdoor cultural space on the site.",
    },
    status: "decided",
    address: "5560, rue Sherbrooke Ouest",
    description: [
      {
        fr: "Le Théâtre Empress a ouvert en 1927 au 5560, rue Sherbrooke Ouest. Il est l'œuvre de l'architecte Joseph-Alcide Chaussé, avec des intérieurs d'Emmanuel Briffa, et c'est la seule salle au Canada construite dans le style néo-égyptien. Les figures et le disque ailé de la façade datent de l'engouement qui a suivi la découverte du tombeau de Toutânkhamon.",
        en: "The Empress Theatre opened in 1927 at 5560 Sherbrooke Street West. It was designed by architect Joseph-Alcide Chaussé with interiors by Emmanuel Briffa, and it is the only Egyptian Revival theatre ever built in Canada. The figures and winged disc on the façade come from the craze that followed the opening of Tutankhamun's tomb.",
      },
      {
        fr: "La salle a fonctionné 65 ans, en dernier lieu sous le nom de Cinéma V, jusqu'à ce qu'un incendie la ferme en 1992. La Ville de Montréal en est devenue propriétaire en 1999 et l'arrondissement en a pris possession en 2011. Depuis, trois projets de relance se sont succédé sans aboutir, et le bâtiment s'est détérioré au point d'être jugé structurellement non sécuritaire.",
        en: "It ran for 65 years, latterly as Cinema V, until a fire closed it in 1992. The City of Montreal took ownership in 1999 and the borough took it over in 2011. Three separate revival projects have come and gone since, and the building has decayed to the point of being judged structurally unsound.",
      },
      {
        fr: "Le 24 février 2026, l'arrondissement a annoncé la suite : déconstruire le bâtiment en conservant la façade, et aménager sur le terrain un lieu culturel et communautaire extérieur, présenté comme temporaire. Projections en plein air, activités artistiques participatives et spectacles pourraient s'y tenir à compter de l'automne 2027.",
        en: "On 24 February 2026 the borough announced what comes next: deconstruct the building while keeping the façade, and turn the site into an outdoor cultural and community space, presented as an interim use. Open-air screenings, participatory arts activities and performances could run there from autumn 2027.",
      },
    ],
    photos: [
      {
        src: "/projets/empress-facade.jpg",
        caption: {
          fr: "La façade néo-égyptienne sur Sherbrooke Ouest, barricadée. C'est la partie que l'arrondissement s'engage à conserver.",
          en: "The Egyptian Revival façade on Sherbrooke West, boarded up. This is the part the borough has committed to keeping.",
        },
        credit: "Alanah.Montreal, CC BY 2.0",
      },
      {
        src: "/projets/empress-1940s.jpg",
        caption: {
          fr: "La file d'attente devant l'Empress, photographiée par Conrad Poirier. Fonds de Bibliothèque et Archives nationales du Québec.",
          en: "The queue outside the Empress, photographed by Conrad Poirier. From the Bibliothèque et Archives nationales du Québec collection.",
        },
        credit: "Conrad Poirier, BAnQ (domaine public)",
      },
      {
        src: "/projets/empress-cinema-v.jpg",
        caption: {
          fr: "En juillet 1982, alors exploité sous le nom de Cinéma V. La marquise cache alors les bas-reliefs.",
          en: "In July 1982, then running as Cinema V. The marquee covered the bas-reliefs at the time.",
        },
        credit: "Flickr, CC BY 2.0",
      },
      {
        src: "/projets/empress-etat.jpg",
        caption: {
          fr: "Une des entrées en 2015 : portes condamnées, végétation dans les interstices. C'est cet état qui fonde la décision de déconstruire.",
          en: "One of the entrances in 2015: sealed doors, plants in the gaps. This condition is what the decision to deconstruct rests on.",
        },
        credit: "Anna Frodesiak, CC0",
      },
    ],
    milestones: [
      {
        on: "1927",
        title: { fr: "Ouverture du théâtre", en: "The theatre opens" },
        body: {
          fr: "Conçu par Joseph-Alcide Chaussé, intérieurs d'Emmanuel Briffa. Seule salle de style néo-égyptien au Canada.",
          en: "Designed by Joseph-Alcide Chaussé, interiors by Emmanuel Briffa. The only Egyptian Revival theatre in Canada.",
        },
      },
      {
        on: "1992",
        title: { fr: "Un incendie ferme la salle", en: "A fire closes it" },
        body: {
          fr: "Après 65 ans d'exploitation, en dernier lieu sous le nom de Cinéma V.",
          en: "After 65 years in operation, latterly as Cinema V.",
        },
      },
      {
        on: "1999",
        title: { fr: "La Ville acquiert le bâtiment", en: "The City buys the building" },
      },
      {
        on: "2011-08-15",
        title: { fr: "L'arrondissement en prend possession", en: "The borough takes it over" },
      },
      {
        on: "2009",
        onLabel: { fr: "2009 – 2018", en: "2009 – 2018" },
        title: { fr: "Trois projets de relance échouent", en: "Three revival projects fail" },
        body: {
          fr: "Un plan de restauration de 11,8 M$ perd son financement provincial en 2010 ; le projet Cinéma NDG ne trouve pas de financement entre 2012 et 2015 ; le partenariat avec MK2, annoncé en 2017, est dissous l'année suivante.",
          en: "An $11.8M restoration plan loses its provincial funding in 2010; the Cinema NDG proposal fails to raise money between 2012 and 2015; the MK2 partnership announced in 2017 is dissolved the following year.",
        },
      },
      {
        on: "2020",
        title: { fr: "Bâtiment jugé non sécuritaire", en: "Building judged unsound" },
        body: {
          fr: "Une démolition est annoncée, puis reportée. En 2024, la Ville envisage plutôt de vendre.",
          en: "A demolition is announced, then shelved. In 2024 the city considers selling instead.",
        },
      },
      {
        on: "2026-02-24",
        title: {
          fr: "Déconstruction annoncée, façade conservée",
          en: "Deconstruction announced, façade kept",
        },
        body: {
          fr: "Le terrain doit devenir un lieu culturel et communautaire extérieur, présenté comme temporaire.",
          en: "The site is to become an outdoor cultural and community space, presented as an interim use.",
        },
        source: {
          label: { fr: "Communiqué", en: "News release" },
          url: "https://www.newswire.ca/fr/news-releases/l-arrondissement-de-cote-des-neiges-notre-dame-de-grace-fera-renaitre-l-empress-865337327.html",
        },
      },
      {
        on: "2026-06",
        onLabel: { fr: "Été 2026", en: "Summer 2026" },
        title: { fr: "Séance d'information publique", en: "Public information session" },
        body: {
          fr: "Annoncée pour le projet transitoire.",
          en: "Announced for the interim project.",
        },
      },
      {
        on: "2026-10",
        onLabel: { fr: "Automne 2026", en: "Autumn 2026" },
        title: { fr: "Contrat de déconstruction", en: "Deconstruction contract" },
      },
      {
        on: "2027-01",
        onLabel: { fr: "Début 2027", en: "Early 2027" },
        title: { fr: "Début prévu des travaux", en: "Work expected to begin" },
      },
      {
        on: "2027-10",
        onLabel: { fr: "Automne 2027", en: "Autumn 2027" },
        title: { fr: "Première programmation", en: "First programming" },
      },
    ],
    councilTerm: "empress",
    sources: [
      {
        label: { fr: "Communiqué de l'arrondissement, 24 février 2026", en: "Borough news release, 24 February 2026" },
        url: "https://www.newswire.ca/fr/news-releases/l-arrondissement-de-cote-des-neiges-notre-dame-de-grace-fera-renaitre-l-empress-865337327.html",
      },
      {
        label: { fr: "Ordres du jour et procès-verbaux du conseil d'arrondissement", en: "Borough council agendas and minutes" },
        url: "https://ville.montreal.qc.ca/portal/page?_pageid=7497,81055570&_dad=portal&_schema=PORTAL&dateDebut=2026",
      },
      {
        label: { fr: "Fiche du théâtre, Mémento d'Héritage Montréal", en: "Theatre record, Héritage Montréal's Mémento" },
        url: "https://memento.heritagemontreal.org/en/site/empress-theatre-cinema-v/",
      },
    ],
  },
];

/** Newest activity first is wrong here: a project list is read as a directory. */
export const ALL_PROJECTS: Project[] = PROJECTS;

export const projectBySlug = (slug: string): Project | undefined =>
  PROJECTS.find((p) => p.slug === slug);

/**
 * How a milestone reads on the page: something that happened, or something
 * scheduled. Derived from the date rather than stored, so the page does not
 * quietly keep calling a passed deadline "à venir" months afterwards.
 *
 * A bare `YYYY` or `YYYY-MM` is padded to the *end* of its period: a milestone
 * dated "2026" is not in the past until 2026 is.
 */
export const isPast = (on: string, now = new Date()): boolean => {
  const [y, m] = on.split("-");
  const year = Number(y);
  if (on.length === 4) return now >= new Date(year + 1, 0, 1);
  if (on.length === 7) return now >= new Date(year, Number(m), 1);
  return now >= new Date(on);
};
