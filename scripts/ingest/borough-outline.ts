/**
 * Fetch the official CDN-NDG boundary and write it to public/.
 *
 *   npm run outline
 *
 * Downloaded once and committed rather than fetched at page load: it changes
 * about once a decade, the open-data portal rate-limits, and a map whose
 * outline sometimes fails to arrive is worse than no outline.
 *
 * The source polygon is 64 kB of sub-metre vertices. Nothing on this site
 * shows the borough above zoom 17, where a metre is a third of a pixel, so it
 * is simplified down to what can actually be seen.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE =
  "https://donnees.montreal.ca/api/3/action/package_show?id=limites-administratives-agglomeration";
const BOROUGH = /Côte-des-Neiges/i;

/** ~4 m at this latitude: below one pixel at the deepest zoom we allow. */
const TOLERANCE = 0.00004;

type Ring = [number, number][];
type Feature = {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
};

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const text = await fetch(url).then((r) => r.text());
    if (!text.trimStart().startsWith("<")) return JSON.parse(text) as T;
    if (attempt === 3) throw new Error(`reponse HTML (limite de debit) pour ${url}`);
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
}

/** Perpendicular distance from `p` to the segment `a`–`b`. */
function distance(p: [number, number], a: [number, number], b: [number, number]): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas-Peucker. Keeps corners, drops the points between them. */
function simplify(points: Ring, tolerance: number): Ring {
  if (points.length < 3) return points;

  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distance(points[i], points[0], points[points.length - 1]);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }

  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

const pkg = await getJson<{ result: { resources: { name: string; url: string }[] } }>(PACKAGE);
const resource = pkg.result.resources.find((r) => /WGS\s*84/i.test(r.name));
if (!resource) throw new Error("ressource WGS 84 introuvable");

console.log("1/3 telechargement…");
const collection = await getJson<{ features: Feature[] }>(resource.url);

const borough = collection.features.find((f) => BOROUGH.test(String(f.properties.NOM ?? "")));
if (!borough) throw new Error("arrondissement introuvable dans le jeu de donnees");

console.log("2/3 simplification…");
const before = JSON.stringify(borough.geometry).length;

// A MultiPolygon is polygons of rings; a Polygon is rings. Handle both so a
// change upstream does not silently produce an empty outline.
const rings: Ring[][] =
  borough.geometry.type === "MultiPolygon"
    ? (borough.geometry.coordinates as number[][][][]).map((poly) => poly as Ring[])
    : [borough.geometry.coordinates as Ring[]];

const simplified = rings.map((poly) =>
  poly.map((ring) => {
    const out = simplify(ring as Ring, TOLERANCE);
    // A ring has to close; simplification can drop the repeated last point.
    const [fx, fy] = out[0];
    const [lx, ly] = out[out.length - 1];
    return fx === lx && fy === ly ? out : [...out, out[0]];
  }),
);

const geometry = { type: "MultiPolygon", coordinates: simplified };
const after = JSON.stringify(geometry).length;
const points = simplified.flat().reduce((n, r) => n + r.length, 0);
console.log(
  `     ${(before / 1024).toFixed(0)} ko -> ${(after / 1024).toFixed(0)} ko (${points} points)`,
);

console.log("3/3 ecriture…");
const out = join(import.meta.dirname, "..", "..", "public", "cdn-ndg.geojson");
writeFileSync(
  out,
  JSON.stringify({
    type: "Feature",
    properties: {
      name: "Côte-des-Neiges–Notre-Dame-de-Grâce",
      source: "Ville de Montréal, limites administratives (WGS 84)",
      simplifiedTolerance: TOLERANCE,
    },
    geometry,
  }),
  "utf8",
);
console.log(`     ${out}`);
