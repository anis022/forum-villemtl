// One basemap for the whole site, so the events map, the reports map and the
// location picker cannot drift apart.
//
// CARTO Voyager keeps the street hierarchy quiet enough for coloured pins but
// restores the things a resident uses to orient themselves: parks, water,
// transit, buildings and neighbourhood labels. The previous Positron layer was
// intentionally grey and then desaturated again in CSS, which removed most of
// that local character.
export const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

/**
 * The borough, with padding. Every map on the site is fenced to this, and the
 * report form refuses a pin outside it.
 *
 * Defined here rather than beside the events or the issues, because both were
 * carrying their own copy and a boundary that disagrees with itself is worse
 * than no boundary.
 */
export const BOROUGH_BOUNDS: [[number, number], [number, number]] = [
  [45.4495, -73.665],
  [45.5095, -73.598],
];

/** Centre of the borough, for anything that needs a point rather than a box. */
export const BOROUGH_CENTER: [number, number] = [45.4795, -73.6315];

/**
 * Open every map on the whole borough, and make that view the floor.
 *
 * A fixed zoom cannot do this. At zoom 14 a 320px-wide frame shows about 40% of
 * the borough's width, so a phone opened on Côte-des-Neiges with the other four
 * districts somewhere off screen — you had to know to zoom out before the map
 * could tell you anything. Fitting the bounds asks the frame how much room it
 * has, which is the only way one rule holds from a 320px phone to a 1200px
 * desktop column.
 *
 * The fitted zoom then becomes `minZoom`, so the opening view is also as far
 * out as anyone can go: no zooming out to the whole province, and no way to
 * lose the five districts once you have them.
 */
export function frameBorough(
  L: typeof import("leaflet"),
  map: import("leaflet").Map,
  pad = 0.3,
): void {
  map.setMaxBounds(L.latLngBounds(BOROUGH_BOUNDS).pad(pad));
  map.fitBounds(L.latLngBounds(BOROUGH_BOUNDS), { padding: [8, 8], animate: false });
  map.setMinZoom(map.getZoom());
}

/**
 * Shared map options.
 *
 * `fadeAnimation: false` is not cosmetic. Leaflet starts every tile at opacity
 * 0 and raises it from a `requestAnimationFrame` callback; when that callback
 * does not complete the tiles stay invisible and the map renders as a blank
 * white box with no error anywhere — loaded images, correct panes, nothing to
 * see. Painting tiles at full opacity removes the failure mode entirely, and
 * on a map that is usually below the fold nobody was watching the fade.
 *
 * Scroll wheel zoom is off so the page still scrolls when the pointer crosses
 * a map.
 */
export const MAP_OPTIONS = {
  scrollWheelZoom: false,
  zoomControl: false,
  fadeAnimation: false,
} as const;

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const TILE_OPTIONS = {
  attribution: TILE_ATTRIBUTION,
  maxZoom: 19,
  className: "map-tiles",
} as const;

/** Served from our own origin: see scripts/ingest/borough-outline.ts. */
const OUTLINE_URL = "/cdn-ndg.geojson";

type BoroughFeature = {
  geometry: { type: string; coordinates: number[][][][] };
};

let cached: Promise<BoroughFeature> | null = null;

/**
 * Draw the borough: everything outside it is dimmed, and its edge is traced.
 *
 * The dimming does the real work. An outline alone still leaves the reader
 * scanning a map of half the island for where the boundary runs; veiling the
 * outside makes CDN-NDG the figure and the rest the ground, so it is obvious
 * at a glance which streets this site is about.
 *
 * Both layers are non-interactive, so they never swallow a click meant for a
 * pin — or, in the location picker, a click meant to place one.
 */
export async function addBoroughOutline(
  L: typeof import("leaflet"),
  map: import("leaflet").Map,
): Promise<void> {
  cached ??= fetch(OUTLINE_URL).then((r) => r.json() as Promise<BoroughFeature>);

  let feature: BoroughFeature;
  try {
    feature = await cached;
  } catch {
    // A missing outline is a cosmetic loss; the map still works without it.
    cached = null;
    return;
  }

  // The caller does not await this, so the map may have been torn down while
  // the outline was in flight — React runs effects twice in development.
  if (!map.getContainer()?.isConnected) return;

  // GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
  const outerRings = feature.geometry.coordinates.map((polygon) =>
    polygon[0].map(([lng, lat]) => [lat, lng] as [number, number]),
  );

  // A rectangle over the whole world, with the borough punched out of it.
  //
  // ±85, not ±90: Web Mercator sends the poles to infinity, and a ring with an
  // unprojectable corner produces a degenerate path that fills the entire map
  // instead of leaving a hole. ±85.05 is where the projection is normally cut.
  const world: [number, number][] = [
    [-85, -180],
    [-85, 180],
    [85, 180],
    [85, -180],
  ];

  L.polygon([world, ...outerRings], {
    stroke: false,
    fillColor: "#fef7f0",
    fillOpacity: 0.72,
    interactive: false,
  }).addTo(map);

  L.polygon(outerRings, {
    color: "#fa3250",
    weight: 2,
    opacity: 0.75,
    fill: false,
    interactive: false,
  }).addTo(map);
}
