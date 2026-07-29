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

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const TILE_OPTIONS = {
  attribution: TILE_ATTRIBUTION,
  maxZoom: 19,
  className: "map-tiles",
} as const;
