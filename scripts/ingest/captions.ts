/**
 * Stage 1 of ingestion: YouTube video -> timestamped transcript windows.
 *
 * Deliberately free of any AI dependency. Embedding happens in stage 2, so
 * this stage can run (and be re-run) without touching a paid API.
 *
 * The arrondissement publishes no real subtitles despite what the video titles
 * claim, so this pulls YouTube's *auto*-generated French track. Quality is
 * mediocre — proper nouns are frequently mangled ("chestinan" for
 * "Palestinian") — which is why `transcript_source` distinguishes these from a
 * later Whisper pass over the same schema.
 */

import { spawn } from "node:child_process";
import { readFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/** One caption cue as YouTube's json3 format delivers it. */
type Cue = { start: number; end: number; text: string };

/** A retrieval unit: several cues merged into a searchable span. */
export type Window = { startS: number; endS: number; text: string };

/**
 * Cues carrying no speech. The first ~12 minutes of a council recording are
 * typically nothing but these, and they would otherwise produce embeddings of
 * pure noise that pollute similarity search.
 */
const NON_SPEECH = /^\s*(\[[^\]]*\]\s*)+$/;

/** yt-dlp needs a JS runtime + the remote challenge solver to reach YouTube. */
const YTDLP_BASE = [
  "-m",
  "yt_dlp",
  "--js-runtimes",
  "node",
  "--remote-components",
  "ejs:github",
];

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`)),
    );
  });
}

/** Download the auto-generated French caption track for one video. */
export async function fetchCues(youtubeId: string): Promise<Cue[]> {
  const dir = join(tmpdir(), `council-${youtubeId}`);
  await mkdir(dir, { recursive: true });
  try {
    await run("python", [
      ...YTDLP_BASE,
      "--write-auto-subs",
      "--sub-langs",
      "fr",
      "--sub-format",
      "json3",
      "--skip-download",
      "-o",
      join(dir, "cap.%(ext)s"),
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]);

    const raw = JSON.parse(await readFile(join(dir, "cap.fr.json3"), "utf8"));
    return (raw.events ?? [])
      .filter((e: { segs?: unknown }) => e.segs)
      .map((e: { tStartMs: number; dDurationMs?: number; segs: { utf8: string }[] }) => ({
        start: e.tStartMs / 1000,
        end: (e.tStartMs + (e.dDurationMs ?? 0)) / 1000,
        text: e.segs
          .map((s) => s.utf8)
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((c: Cue) => c.text && !NON_SPEECH.test(c.text));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Merge cues into overlapping time windows.
 *
 * Auto-captions carry no punctuation or casing, so sentence-boundary chunking
 * is impossible — time is the only structure available. The overlap keeps an
 * exchange that straddles a boundary retrievable from either side.
 */
export function toWindows(cues: Cue[], targetS = 45, overlapS = 10): Window[] {
  const windows: Window[] = [];
  let i = 0;

  while (i < cues.length) {
    const startS = cues[i].start;
    const parts: string[] = [];
    let j = i;

    while (j < cues.length && cues[j].end - startS <= targetS) {
      parts.push(cues[j].text);
      j++;
    }
    // A single cue longer than the target still has to land somewhere.
    if (j === i) {
      parts.push(cues[i].text);
      j = i + 1;
    }

    windows.push({ startS, endS: cues[j - 1].end, text: parts.join(" ") });

    if (j >= cues.length) break;
    // Step back far enough to create the overlap, but always make progress.
    const resumeAt = cues[j - 1].end - overlapS;
    let next = j;
    while (next > i + 1 && cues[next - 1].start >= resumeAt) next--;
    i = next;
  }

  return windows;
}
