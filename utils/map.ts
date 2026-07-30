// One basemap for the whole site, so the events map, the reports map and the
// location picker cannot drift apart.
//
// Carto Positron rather than standard OpenStreetMap: OSM's default renders
// every road class in a different saturated colour, every park in green and
// every building in ochre, which is beautiful cartography and terrible
// background. Coloured pins have to compete with it. Positron draws the same
// city in near-greys, so the only saturated things on screen are ours.
//
// The tiles are then nudged through a filter (see `.map-tiles` in globals.css)
// toward the page's own green-biased neutrals, so a map reads as part of this
// site instead of an embed borrowed from somewhere else.

// Positron lives at the bucket root; only Voyager sits under `rastertiles/`.
// Getting that wrong returns 404s for every tile and a blank white map.
export const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

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

/**
 * Opening view, set explicitly rather than by fitting the bounds.
 *
 * `fitBounds` zooms out until both axes fit, so in a wide, short frame the
 * height decides and the map opens on half the island with the borough a
 * smudge in the middle. A fixed centre and zoom holds the neighbourhood at any
 * aspect ratio; `setMaxBounds` still stops anyone wandering off it.
 */
export const BOROUGH_CENTER: [number, number] = [45.4795, -73.6315];
export const BOROUGH_ZOOM = 14;

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
    fillColor: "#f8faf9",
    fillOpacity: 0.72,
    interactive: false,
  }).addTo(map);

  L.polygon(outerRings, {
    color: "#097d6c",
    weight: 2,
    opacity: 0.75,
    fill: false,
    interactive: false,
  }).addTo(map);
}
