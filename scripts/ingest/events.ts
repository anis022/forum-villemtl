/**
 * Sync borough events from Montréal's open-data feed.
 *
 *   npm run sync:events
 *
 * Safe to run repeatedly — a run replaces the table's contents in one
 * transaction, so events that disappear upstream disappear here too. At ~300
 * rows a full replace is cheaper and far more predictable than diffing.
 */

import { Client } from "pg";

const CSV_EVENTS =
  "https://donnees.montreal.ca/dataset/6a4cbf2c-c9b7-413a-86b1-e8f7081e2578/resource/6decf611-6f11-4f34-bb36-324d804c9bad/download/evenements.csv";
const GEO_DISTRICTS =
  "https://donnees.montreal.ca/dataset/70acec75-c2b4-4d26-a399-facc7b0ad9bf/resource/fa1f8cfc-cdbf-42fd-9979-32c16b68b5ca/download/districts-electoraux-2025.json";
const GEO_PARKS =
  "https://donnees.montreal.ca/dataset/2e9e4d2f-173a-4c3d-a5e3-565d79baa27d/resource/35796624-15df-4503-a569-797665f8768e/download/espace_vert.json";

const BOROUGH = /Côte-des-Neiges/i;

type Ring = [number, number][];
type Feature = {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

/** The feed writes missing values as the literal string "nan". */
const blank = (v: string | undefined) => !v || v === "nan" || v.trim() === "";
const clean = (v: string | undefined) => (blank(v) ? null : v!.trim());

function parseCsv(s: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Ray casting. Coordinates are [lon, lat] throughout, as GeoJSON specifies. */
function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Outer ring contains the point and no hole excludes it. */
function inPolygon(lon: number, lat: number, poly: Ring[]): boolean {
  if (!poly.length || !inRing(lon, lat, poly[0])) return false;
  return !poly.slice(1).some((hole) => inRing(lon, lat, hole));
}

function inFeature(lon: number, lat: number, f: Feature): boolean {
  const g = f.geometry;
  if (g?.type === "Polygon") return inPolygon(lon, lat, g.coordinates as Ring[]);
  if (g?.type === "MultiPolygon") {
    return (g.coordinates as Ring[][]).some((p) => inPolygon(lon, lat, p));
  }
  return false;
}

/** Skip features whose bounding box cannot contain the point — 2246 parks. */
function bbox(f: Feature): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      const [x, y] = c as [number, number];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(f.geometry?.coordinates);
  return [minX, minY, maxX, maxY];
}

const SETTINGS: Record<string, string> = {
  "À l'extérieur": "outdoor",
  "En salle": "indoor",
  "En ligne": "online",
};

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env).");
  process.exit(1);
}

console.log("1/5 telechargement…");
type Collection = { features?: Feature[] };

const [csvText, districtsGeo, parksGeo] = await Promise.all([
  fetch(CSV_EVENTS).then((r) => r.text()),
  fetch(GEO_DISTRICTS).then((r) => r.json() as Promise<Collection>),
  fetch(GEO_PARKS).then((r) => r.json() as Promise<Collection>),
]);

const districts = (districtsGeo.features ?? []).filter((f) =>
  BOROUGH.test(String(f.properties.NOM_ARR ?? "")),
);
if (districts.length !== 5) {
  throw new Error(`attendu 5 districts, trouve ${districts.length}`);
}

const parks = (parksGeo.features ?? [])
  .map((f) => ({ f, bb: bbox(f), name: String(f.properties.Nom ?? "").trim() }))
  .filter((p) => p.name.length > 0);

console.log(`     ${districts.length} districts, ${parks.length} espaces verts nommes`);

console.log("2/5 filtrage…");
const rows = parseCsv(csvText);
const header = rows[0];
const today = new Date().toISOString().slice(0, 10);

const events = rows
  .slice(1)
  .filter((r) => r.length === header.length)
  .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])) as Record<string, string>)
  .filter((e) => BOROUGH.test(e.arrondissement ?? ""))
  // Keep anything not yet over: a season-long series stays visible all summer.
  .filter((e) => (clean(e.date_fin) ?? e.date_debut) >= today);

console.log(`     ${events.length} evenements courants dans l'arrondissement`);

console.log("3/5 district et lieu…");
let outside = 0;
let named = 0;

const prepared = events.map((e) => {
  const lat = parseFloat(e.lat);
  const lon = parseFloat(e.long);
  const hasCoord = Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0;

  let district: string | null = null;
  let venue: string | null = clean(e.titre_adresse);

  if (hasCoord) {
    const d = districts.find((f) => inFeature(lon, lat, f));
    district = d ? String(d.properties.NOM_DISTRICT) : null;
    if (!district) outside++;

    if (!venue) {
      const park = parks.find(
        (p) => lon >= p.bb[0] && lon <= p.bb[2] && lat >= p.bb[1] && lat <= p.bb[3] && inFeature(lon, lat, p.f),
      );
      if (park) { venue = park.name; named++; }
    }
  }

  return {
    source_url: e.url_fiche,
    title: e.titre,
    description: clean(e.description),
    starts_on: e.date_debut,
    ends_on: clean(e.date_fin),
    event_type: clean(e.type_evenement),
    audience: clean(e.public_cible),
    setting: SETTINGS[e.emplacement] ?? null,
    cost: clean(e.cout),
    venue_name: venue,
    address: clean(e.adresse_principale),
    lat: hasCoord ? lat : null,
    lon: hasCoord ? lon : null,
    district,
  };
});

console.log(`     ${named} lieux retrouves par le parc contenant le point`);
console.log(`     ${outside} points hors des 5 districts`);

console.log("4/5 ecriture…");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query("begin");
  // Full replace: an event pulled upstream must vanish here too.
  await client.query("delete from borough_events");

  const cols = [
    "source_url", "title", "description", "starts_on", "ends_on", "event_type",
    "audience", "setting", "cost", "venue_name", "address", "lat", "lon", "district",
  ] as const;

  // Duplicate source_url would abort the batch; the feed repeats a few.
  const seen = new Set<string>();
  const unique = prepared.filter((p) => !seen.has(p.source_url) && seen.add(p.source_url));

  for (let i = 0; i < unique.length; i += 50) {
    const slice = unique.slice(i, i + 50);
    const values: unknown[] = [];
    const tuples = slice.map((p, k) => {
      cols.forEach((c) => values.push(p[c]));
      return `(${cols.map((_, n) => `$${k * cols.length + n + 1}`).join(",")})`;
    });
    await client.query(
      `insert into borough_events (${cols.join(",")}) values ${tuples.join(",")}`,
      values,
    );
  }
  await client.query("commit");

  console.log("5/5 verification…");
  const { rows: check } = await client.query<{ district: string | null; n: string }>(
    `select district, count(*)::text as n from borough_events group by district order by n desc`,
  );
  for (const r of check) console.log(`     ${r.n.padStart(4)}  ${r.district ?? "(hors districts)"}`);
} catch (err) {
  await client.query("rollback").catch(() => {});
  throw err;
} finally {
  await client.end();
}
