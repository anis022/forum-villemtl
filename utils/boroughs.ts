/**
 * The boroughs this forum can serve, and everything that changes between them.
 *
 * The site was written for Côte-des-Neiges–Notre-Dame-de-Grâce and said so in
 * five separate places: the map bounds, the outline file, the pin validation,
 * the page copy and the officials list. Five copies of one fact is four chances
 * for them to disagree, and none of them could be swapped without touching the
 * others. They read from here instead.
 *
 * Only CDN-NDG is listed. That is deliberate rather than unfinished: a borough
 * belongs in this list once its outline, its elected officials and its council
 * archive exist, and listing one before its data lands would offer residents a
 * choice that leads to an empty forum. Adding the second borough is an entry
 * here plus its data, not a change to the pages.
 */

import type { Localized } from "@/utils/officials";

export const BOROUGH_SLUGS = ["cdn-ndg"] as const;
export type BoroughSlug = (typeof BOROUGH_SLUGS)[number];

export type Borough = {
  slug: BoroughSlug;
  /** As the city writes it, in full. Page titles and legal lines. */
  name: Localized;
  /**
   * What a resident calls it out loud. The full name is 38 characters and
   * breaks every tight row on a 320px screen; this is what goes in a chip, a
   * selector or a sentence that already has other words in it.
   */
  shortName: Localized;
  /**
   * The borough with padding, as [[south, west], [north, east]].
   *
   * Every map on the site is fenced to this and the report form refuses a pin
   * outside it, so it is a box around the territory rather than a tight fit.
   */
  bounds: [[number, number], [number, number]];
  /** A point, for anything that cannot use a box. */
  center: [number, number];
  /** The outline drawn over the basemap, served from `public/`. */
  outlineUrl: string;
};

export const BOROUGHS: readonly Borough[] = [
  {
    slug: "cdn-ndg",
    name: {
      fr: "Côte-des-Neiges–Notre-Dame-de-Grâce",
      en: "Côte-des-Neiges–Notre-Dame-de-Grâce",
    },
    shortName: { fr: "CDN-NDG", en: "CDN-NDG" },
    bounds: [
      [45.4495, -73.665],
      [45.5095, -73.598],
    ],
    center: [45.4795, -73.6315],
    outlineUrl: "/cdn-ndg.geojson",
  },
];

/**
 * What a resident gets before they have chosen, and what the public pages use.
 *
 * The forum is readable signed out, so there is always a borough in play even
 * when there is nobody to have picked one.
 */
export const DEFAULT_BOROUGH_SLUG: BoroughSlug = "cdn-ndg";

export const isBoroughSlug = (value: string): value is BoroughSlug =>
  (BOROUGH_SLUGS as readonly string[]).includes(value);

/**
 * The borough for a slug, falling back rather than throwing.
 *
 * A profile row written before a borough was retired, or by a newer deploy
 * than the one reading it, must not take the page down with it.
 */
export function getBorough(slug: string | null | undefined): Borough {
  const found = slug ? BOROUGHS.find((b) => b.slug === slug) : undefined;
  return found ?? BOROUGHS.find((b) => b.slug === DEFAULT_BOROUGH_SLUG)!;
}

export const DEFAULT_BOROUGH = getBorough(DEFAULT_BOROUGH_SLUG);
