/**
 * Sync borough events from Montréal's open-data feed.
 *
 *   npm run sync:events                    write straight to the database
 *   npm run sync:events -- --sql out.sql   emit SQL to paste into Supabase
 *
 * The second mode exists because outbound Postgres (5432/6543) is blocked on
 * some networks while HTTPS is not. Rather than stashing a service-role key —
 * a secret that bypasses RLS across the whole API — the run emits a statement
 * file to paste into the SQL editor, which needs no new credential at all.
 *
 * Safe to run repeatedly either way: a run replaces the table's contents in
 * one transaction, so events that disappear upstream disappear here too. At
 * ~300 rows a full replace is cheaper and far more predictable than diffing.
 */

import { writeFileSync } from "node:fs";
import { Client } from "pg";

const CSV_EVENTS =
  "https://donnees.montreal.ca/dataset/6a4cbf2c-c9b7-413a-86b1-e8f7081e2578/resource/6decf611-6f11-4f34-bb36-324d804c9bad/download/evenements.csv";
const GEO_DISTRICTS =
  "https://donnees.montreal.ca/dataset/70acec75-c2b4-4d26-a399-facc7b0ad9bf/resource/fa1f8cfc-cdbf-42fd-9979-32c16b68b5ca/download/districts-electoraux-2025.json";
const GEO_PARKS =
  "https://donnees.montreal.ca/dataset/2e9e4d2f-173a-4c3d-a5e3-565d79baa27d/resource/35796624-15df-4503-a569-797665f8768e/download/espace_vert.json";
/**
 * Public buildings and sites. The events feed positions every entry on the
 * exact coordinates of one of these, so this resolves the remaining venue
 * names — and their postal addresses — at zero distance.
 */
const GEO_PLACES =
  "https://donnees.montreal.ca/api/3/action/package_show?id=lieux-batiments-vocation-publique";

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

/**
 * Several facilities share a coordinate — a borough office holds both a
 * cultural centre and a permits counter — so "nearest" alone would name a
 * council sitting after the permits counter. Rank by what the event actually
 * is: indoor events belong to venues, outdoor ones to parks and grounds.
 */
const PLACE_PREFERENCE: Record<string, string[]> = {
  indoor: ["Culturels et communautaires", "Sportifs et récréatifs", "Points de service", "Parc et jardins"],
  outdoor: ["Parc et jardins", "Sportifs et récréatifs", "Culturels et communautaires", "Points de service"],
};

type Place = { name: string; address: string | null; types: string; lat: number; lon: number };

/** Metres between two WGS84 points. */
function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const p = Math.PI / 180;
  const dLat = (bLat - aLat) * p;
  const dLon = (bLon - aLon) * p;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * p) * Math.cos(bLat * p) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}

/** Closest facility within `radius`, preferring the type that fits the event. */
function bestPlace(lat: number, lon: number, setting: string, places: Place[], radius = 60) {
  const near = places.filter((p) => metres(lat, lon, p.lat, p.lon) <= radius);
  if (!near.length) return null;
  const order = PLACE_PREFERENCE[setting] ?? PLACE_PREFERENCE.indoor;
  const rank = (p: Place) => {
    const i = order.findIndex((t) => p.types.includes(t));
    return i === -1 ? order.length : i;
  };
  return near.sort(
    (a, b) => rank(a) - rank(b) || metres(lat, lon, a.lat, a.lon) - metres(lat, lon, b.lat, b.lon),
  )[0];
}

const sqlFlag = process.argv.indexOf("--sql");
const sqlPath = sqlFlag >= 0 ? (process.argv[sqlFlag + 1] ?? "events.sql") : null;

if (!sqlPath && !process.env.DATABASE_URL) {
  console.error("DATABASE_URL absent (.env), ou utiliser --sql <fichier>.");
  process.exit(1);
}

console.log("1/5 telechargement…");
type Collection = { features?: Feature[] };

/** The portal rate-limits and answers with an HTML error page when it does. */
async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const text = await fetch(url).then((r) => r.text());
    if (!text.trimStart().startsWith("<")) return text;
    if (attempt === 3) throw new Error(`reponse HTML (limite de debit) pour ${url}`);
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
}
const fetchJson = async <T,>(url: string): Promise<T> => JSON.parse(await fetchText(url)) as T;

const [csvText, districtsGeo, parksGeo, placesPkg] = await Promise.all([
  fetchText(CSV_EVENTS),
  fetchJson<Collection>(GEO_DISTRICTS),
  fetchJson<Collection>(GEO_PARKS),
  fetchJson<{ result: { resources: { format: string; url: string }[] } }>(GEO_PLACES),
]);

const placesUrl = placesPkg.result.resources.find((r) => /GEOJSON|JSON/i.test(r.format))?.url;
if (!placesUrl) throw new Error("ressource JSON introuvable pour les lieux publics");
const placesGeo = await fetchJson<Collection>(placesUrl);

const places: Place[] = (placesGeo.features ?? [])
  .filter((f) => BOROUGH.test(String(f.properties.arrondissements ?? "")))
  .map((f) => ({
    name: String(f.properties.titre_lieu ?? "").trim(),
    address: blank(f.properties.adresse_principale as string) ? null : String(f.properties.adresse_principale).trim(),
    types: String(f.properties.types ?? ""),
    lat: Number(f.properties.lat),
    lon: Number(f.properties.long),
  }))
  .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));

const districts = (districtsGeo.features ?? []).filter((f) =>
  BOROUGH.test(String(f.properties.NOM_ARR ?? "")),
);
if (districts.length !== 5) {
  throw new Error(`attendu 5 districts, trouve ${districts.length}`);
}

const parks = (parksGeo.features ?? [])
  .map((f) => ({ f, bb: bbox(f), name: String(f.properties.Nom ?? "").trim() }))
  .filter((p) => p.name.length > 0);

console.log(
  `     ${districts.length} districts, ${parks.length} espaces verts nommes, ${places.length} lieux publics dans l'arrondissement`,
);

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
let byPark = 0;
let byPlace = 0;

const prepared = events.map((e) => {
  const lat = parseFloat(e.lat);
  const lon = parseFloat(e.long);
  const hasCoord = Number.isFinite(lat) && Number.isFinite(lon) && lat !== 0 && lon !== 0;
  const setting = SETTINGS[e.emplacement] ?? "indoor";

  let district: string | null = null;
  let venue: string | null = clean(e.titre_adresse);
  let address: string | null = clean(e.adresse_principale);

  if (hasCoord) {
    const d = districts.find((f) => inFeature(lon, lat, f));
    district = d ? String(d.properties.NOM_DISTRICT) : null;
    if (!district) outside++;

    // A containment test beats a nearest-neighbour guess, so parks win first
    // for anything actually inside one.
    //
    // The feed's `emplacement` is not always right — "Animation du terrain
    // multisports au parc Nelson-Mandela" is filed as "En salle" — so a title
    // that names a park overrides it. Believing the flag there named the event
    // after a nearby arena.
    const titleNamesPark = /\bparcs?\b/i.test(e.titre);
    if (!venue && (setting === "outdoor" || titleNamesPark)) {
      const park = parks.find(
        (p) => lon >= p.bb[0] && lon <= p.bb[2] && lat >= p.bb[1] && lat <= p.bb[3] && inFeature(lon, lat, p.f),
      );
      if (park) { venue = park.name; byPark++; }
    }

    if (!venue) {
      const place = bestPlace(lat, lon, setting, places);
      if (place) {
        venue = place.name;
        address ??= place.address;
        byPlace++;
      }
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
    address,
    lat: hasCoord ? lat : null,
    lon: hasCoord ? lon : null,
    district,
  };
});

const unnamed = prepared.filter((p) => !p.venue_name).length;
console.log(`     ${byPark} nommes par le parc contenant le point`);
console.log(`     ${byPlace} nommes par le lieu public le plus proche`);
console.log(`     ${unnamed} sans nom de lieu`);
console.log(`     ${outside} points hors des 5 districts`);

const COLS = [
  "source_url", "title", "description", "starts_on", "ends_on", "event_type",
  "audience", "setting", "cost", "venue_name", "address", "lat", "lon", "district",
] as const;

// The feed repeats a few source_urls; a duplicate would abort the whole insert.
const seen = new Set<string>();
const unique = prepared.filter((p) => !seen.has(p.source_url) && seen.add(p.source_url));

if (sqlPath) {
  console.log("4/4 generation SQL…");
  const lit = (v: unknown): string => {
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  };
  const body = unique
    .map((p) => `  (${COLS.map((c) => lit(p[c])).join(", ")})`)
    .join(",\n");

  const sql =
    `-- Generated by scripts/ingest/events.ts on ${new Date().toISOString()}\n` +
    `-- ${unique.length} events. Paste into the Supabase SQL editor and run.\n\n` +
    `begin;\n\ndelete from borough_events;\n\n` +
    `insert into borough_events (${COLS.join(", ")}) values\n${body};\n\ncommit;\n`;

  writeFileSync(sqlPath, sql, "utf8");
  console.log(
    `     ${unique.length} evenements -> ${sqlPath} (${Math.round(Buffer.byteLength(sql) / 1024)} Ko)`,
  );
  process.exit(0);
}

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

  for (let i = 0; i < unique.length; i += 50) {
    const slice = unique.slice(i, i + 50);
    const values: unknown[] = [];
    const tuples = slice.map((p, k) => {
      COLS.forEach((c) => values.push(p[c]));
      return `(${COLS.map((_, n) => `$${k * COLS.length + n + 1}`).join(",")})`;
    });
    await client.query(
      `insert into borough_events (${COLS.join(",")}) values ${tuples.join(",")}`,
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
