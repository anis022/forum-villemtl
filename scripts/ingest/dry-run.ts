/**
 * Inspect what stage 1 produces for a video, without writing anything.
 *
 *   node --experimental-strip-types scripts/ingest/dry-run.ts <youtubeId>
 */

import { fetchCues, toWindows } from "./captions.ts";

const youtubeId = process.argv[2];
if (!youtubeId) {
  console.error("usage: dry-run.ts <youtubeId>");
  process.exit(1);
}

const cues = await fetchCues(youtubeId);
const windows = toWindows(cues);

const durations = windows.map((w) => w.endS - w.startS);
const chars = windows.map((w) => w.text.length);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const covered = cues.at(-1)!.end;

console.log(`cues retenus   : ${cues.length}`);
console.log(`couverture     : ${(covered / 60).toFixed(1)} min`);
console.log(`fenetres       : ${windows.length}`);
console.log(`duree moyenne  : ${avg(durations).toFixed(1)} s`);
console.log(`chars moyens   : ${Math.round(avg(chars))}`);
console.log(`chars max      : ${Math.max(...chars)}`);

// Ordering and overlap are the two things easy to get silently wrong.
const outOfOrder = windows.filter((w, i) => i > 0 && w.startS < windows[i - 1].startS).length;
const overlaps = windows.filter((w, i) => i > 0 && w.startS < windows[i - 1].endS).length;
console.log(`hors ordre     : ${outOfOrder}`);
console.log(`avec recouvr.  : ${overlaps}/${windows.length - 1}`);

for (const w of [windows[Math.floor(windows.length * 0.35)], windows[Math.floor(windows.length * 0.6)]]) {
  console.log(`\n--- ${Math.floor(w.startS / 60)} min (${(w.endS - w.startS).toFixed(0)} s) ---`);
  console.log(w.text);
}
