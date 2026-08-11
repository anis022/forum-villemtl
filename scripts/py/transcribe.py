"""
Stage 1: council recording -> a transcript worth searching.

This replaces YouTube's auto-captions, which were the ceiling on everything
built above them. Those captions carry no punctuation, no casing, and mangle
precisely the words a resident would search for -- "deenagement" for
"deneigement", "chestinan" for "Palestinian". No amount of ranking cleverness
recovers a word the transcript does not contain.

Three things make this pass better than a stock Whisper run:

  1. large-v3 with word-level timestamps, so a citation can point at the second
     a sentence began rather than at a 45-second bucket around it.

  2. Bilingual decoding. Speakers here switch language mid-sentence; forcing
     French makes the model *translate* English speech instead of transcribing
     it, which silently destroys the English half of the corpus.

  3. The sitting's own proces-verbal as the decoding prompt. We know, before
     listening, exactly who addressed the council that night and what about --
     the borough published it. Feeding those names and subjects to the decoder
     is what turns "Monsieur Rapo-por" into "Irwin Rapoport" and "la piste
     cyclable de Terrebonne" into itself. This is the whole reason stage 0 runs
     first.

    python scripts/py/transcribe.py --list
    python scripts/py/transcribe.py RGOnvurDyxs
    python scripts/py/transcribe.py --all

Re-running skips videos already transcribed unless --force is given. Audio is
kept so a re-decode costs no download.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

def _enable_cuda_dlls() -> None:
    """
    Let ctranslate2 find the CUDA libraries pip put in the virtualenv.

    `nvidia-cublas-cu12` and `nvidia-cudnn-cu12` install their DLLs under
    site-packages/nvidia/*/bin, which is not on the Windows loader path. Without
    this the model loads, reports a CUDA device, and then dies on the first
    encode with "Library cublas64_12.dll is not found or cannot be loaded" --
    after the VAD pass has already chewed through the whole recording.

    A no-op anywhere the directories do not exist, which covers Linux and a
    CPU-only machine.
    """
    if not hasattr(os, "add_dll_directory"):
        return
    nvidia = Path(sys.prefix) / "Lib" / "site-packages" / "nvidia"
    for path in sorted(nvidia.glob("*/bin")):
        os.add_dll_directory(str(path))
        # ctranslate2 consults PATH too, depending on how it was built.
        os.environ["PATH"] = f"{path}{os.pathsep}{os.environ.get('PATH', '')}"


_enable_cuda_dlls()

ROOT = Path(__file__).resolve().parents[2]
AUDIO = ROOT / "data" / "audio"
TRANSCRIPTS = ROOT / "data" / "transcripts"
PARSED = ROOT / "data" / "docs" / "parsed"
INDEX = ROOT / "data" / "docs" / "index.json"
MEETINGS_TS = ROOT / "scripts" / "ingest" / "meetings.ts"

# Loaded from disk rather than by name: scripts/py/fetch_model.py puts the
# weights here, because the hub client could not carry a 3 GB file to the end
# of a home connection without restarting from zero.
MODEL_DIR = ROOT / "data" / "models" / "faster-whisper-large-v3"
MODEL = str(MODEL_DIR) if MODEL_DIR.exists() else "large-v3"

# 4 GB of VRAM on the laptop 3050 Ti. int8_float16 keeps large-v3 resident with
# room for the cross-attention that word timestamps need; float16 alone does
# not fit, and dropping to a smaller model costs more accuracy than the
# quantisation does.
DEVICE = "cuda"
COMPUTE = "int8_float16"

# Whisper's prompt window is ~224 tokens. That is far too small for a borough
# gazetteer, but ample for one sitting's cast when the record tells us who it is.
PROMPT_TOKEN_BUDGET = 200

YTDLP_BASE = [
    "-m",
    "yt_dlp",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    # The percentage counter rewrites its line hundreds of times; useful in a
    # terminal, unreadable in a log.
    "--no-progress",
    "--quiet",
    "--no-warnings",
]

MEETING_RE = re.compile(
    r'youtubeId:\s*"([^"]+)"\s*,\s*date:\s*"(\d{4}-\d{2}-\d{2})"\s*,\s*title:\s*"([^"]*)"'
)


def load_meetings() -> list[dict]:
    """
    The canonical video list lives in meetings.ts, which the TypeScript ingest
    also imports. Read rather than duplicate it: two lists of meeting IDs that
    can drift apart is a bug waiting to happen.
    """
    src = MEETINGS_TS.read_text(encoding="utf-8")
    return [
        {"youtubeId": m.group(1), "date": m.group(2), "title": m.group(3)}
        for m in MEETING_RE.finditer(src)
    ]


def pv_for_date(date: str) -> dict | None:
    """The parsed proces-verbal of the sitting held on `date`, if we have it."""
    if not INDEX.exists():
        return None
    index = json.loads(INDEX.read_text(encoding="utf-8"))
    for meeting in index:
        if meeting["date"] != date:
            continue
        for doc in meeting["docs"]:
            if doc["type"] != "pv":
                continue
            parsed = PARSED / f"pv-{doc['docId']}.json"
            if parsed.exists():
                return json.loads(parsed.read_text(encoding="utf-8"))
    return None


def build_prompt(pv: dict | None) -> tuple[str, str]:
    """
    Turn the official record into (initial_prompt, hotwords).

    The prompt is written as ordinary prose because that is what Whisper
    conditions on -- a bare word list biases the decoder toward emitting lists.
    Names come first: they are what the model gets wrong most and what a reader
    is most likely to search by.
    """
    if not pv:
        return "", ""

    people = [c["name"] for c in pv["presences"].get("councillors", [])]
    if pv["presences"].get("president"):
        people.insert(0, pv["presences"]["president"])

    residents = [q["name"] for q in pv.get("publicQuestions", []) if q.get("name")]
    subjects = [q["subject"] for q in pv.get("publicQuestions", []) if q.get("subject")]

    # Deduplicate while keeping the order the record puts them in.
    def uniq(xs: list[str]) -> list[str]:
        seen, out = set(), []
        for x in xs:
            k = x.lower()
            if k not in seen:
                seen.add(k)
                out.append(x)
        return out

    people, residents, subjects = uniq(people), uniq(residents), uniq(subjects)

    parts = [
        "Séance du conseil d'arrondissement de Côte-des-Neiges–Notre-Dame-de-Grâce.",
    ]
    if people:
        parts.append("Membres du conseil : " + ", ".join(people) + ".")
    if residents:
        parts.append("Personnes ayant pris la parole : " + ", ".join(residents) + ".")
    if subjects:
        parts.append("Sujets abordés : " + "; ".join(subjects) + ".")

    prompt = " ".join(parts)
    # Rough token budget: French averages a shade under four characters a token.
    prompt = prompt[: PROMPT_TOKEN_BUDGET * 4]

    # Hotwords bias the decoder directly and are the better home for names.
    hotwords = ", ".join(people + residents)[: PROMPT_TOKEN_BUDGET * 4]
    return prompt, hotwords


def fetch_audio(youtube_id: str) -> Path:
    """
    Pull the audio-only stream. No ffmpeg post-processing is requested, so no
    ffmpeg binary is needed: PyAV, which faster-whisper already depends on,
    decodes the container directly.
    """
    AUDIO.mkdir(parents=True, exist_ok=True)
    existing = list(AUDIO.glob(f"{youtube_id}.*"))
    if existing:
        return existing[0]

    subprocess.run(
        [
            sys.executable,
            *YTDLP_BASE,
            "-f",
            "bestaudio",
            "-o",
            str(AUDIO / f"{youtube_id}.%(ext)s"),
            f"https://www.youtube.com/watch?v={youtube_id}",
        ],
        check=True,
    )

    found = list(AUDIO.glob(f"{youtube_id}.*"))
    if not found:
        raise RuntimeError(f"aucun fichier audio pour {youtube_id}")
    return found[0]


def transcribe(model, audio: Path, prompt: str, hotwords: str) -> dict:
    segments, info = model.transcribe(
        str(audio),
        # Bilingual sittings: let the decoder pick per window rather than
        # forcing French and having English speech come back translated.
        multilingual=True,
        language=None,
        task="transcribe",
        beam_size=5,
        word_timestamps=True,
        initial_prompt=prompt or None,
        hotwords=hotwords or None,
        # A council recording opens with ten-plus minutes of an empty room.
        # Without VAD the decoder fills that silence with invented speech.
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 700, "speech_pad_ms": 200},
        hallucination_silence_threshold=2.0,
        # Three hours is long enough for a decoding slip to feed on itself and
        # loop. Each window standing alone costs a little context and buys
        # immunity from that.
        condition_on_previous_text=False,
        temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
    )

    out_segments = []
    started = time.time()
    for seg in segments:
        out_segments.append(
            {
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
                # Deliberately not recorded per segment. faster-whisper's
                # Segment carries no language field: `multilingual` lets the
                # decoder switch languages but never reports which one it used,
                # so the only value available here is the single file-level
                # guess. Stamping that on every segment produced a 6 July
                # transcript labelled English from end to end while most of it
                # is French. The ingest reads the language off the words
                # instead, where a 40-second window gives it something to go on.
                "avgLogprob": round(seg.avg_logprob, 4),
                "noSpeechProb": round(seg.no_speech_prob, 4),
                "compressionRatio": round(seg.compression_ratio, 3),
                "words": [
                    {
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "word": w.word,
                        "p": round(w.probability, 3),
                    }
                    for w in (seg.words or [])
                ],
            }
        )
        if len(out_segments) % 50 == 0:
            covered = out_segments[-1]["end"]
            rate = covered / max(time.time() - started, 1e-6)
            sys.stdout.write(
                f"\r     {len(out_segments):5d} segments  "
                f"{covered / 60:6.1f} min transcrites  ({rate:.1f}x temps réel)"
            )
            sys.stdout.flush()
    sys.stdout.write("\n")

    return {
        # The label, not the path: what matters downstream is which model
        # produced the text, not where its weights happened to sit.
        "model": "large-v3",
        "compute": COMPUTE,
        "duration": round(info.duration, 2),
        "durationAfterVad": round(getattr(info, "duration_after_vad", info.duration), 2),
        "language": info.language,
        "languageProbability": round(info.language_probability, 3),
        "promptUsed": prompt,
        "hotwordsUsed": hotwords,
        "segments": out_segments,
    }


def run_one(model, meeting: dict, force: bool) -> bool:
    yid = meeting["youtubeId"]
    dest = TRANSCRIPTS / f"{yid}.json"
    if dest.exists() and not force:
        print(f"  {yid} deja transcrit")
        return True

    pv = pv_for_date(meeting["date"])
    prompt, hotwords = build_prompt(pv)
    print(f"  {yid}  {meeting['date']}")
    print(f"     proces-verbal : {'oui' if pv else 'ABSENT'}")
    if pv:
        print(
            f"     amorce : {len(pv['presences'].get('councillors', []))} elus, "
            f"{len(pv.get('publicQuestions', []))} interventions citoyennes"
        )

    audio = fetch_audio(yid)
    result = transcribe(model, audio, prompt, hotwords)
    result["youtubeId"] = yid
    result["meetingDate"] = meeting["date"]
    result["title"] = meeting["title"]
    # The record travels with the transcript so alignment needs only this file,
    # and so a transcript is always readable against the minutes it was
    # conditioned on rather than whatever the parser produces later.
    result["pv"] = pv

    TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    words = sum(len(s["words"]) for s in result["segments"])
    print(
        f"     {len(result['segments'])} segments, {words} mots, "
        f"{result['duration'] / 60:.0f} min -> {dest.relative_to(ROOT)}"
    )
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="identifiants YouTube; sinon --all")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    meetings = load_meetings()
    if args.ids:
        wanted = {i for i in args.ids}
        meetings = [m for m in meetings if m["youtubeId"] in wanted]
    elif not args.all and not args.list:
        ap.error("preciser des identifiants, --all ou --list")

    if args.list:
        for m in meetings:
            done = (TRANSCRIPTS / f"{m['youtubeId']}.json").exists()
            pv = pv_for_date(m["date"])
            print(
                f"  {'OK  ' if done else 'vide'} {m['youtubeId']:13s} {m['date']}  "
                f"pv={'oui' if pv else 'non'}  {m['title'][:50]}"
            )
        return

    if not meetings:
        print("aucune seance correspondante.", file=sys.stderr)
        sys.exit(1)

    from faster_whisper import WhisperModel

    print(f"chargement de {MODEL} ({COMPUTE} sur {DEVICE})…")
    model = WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE)

    for m in meetings:
        try:
            run_one(model, m, args.force)
        except Exception as e:  # noqa: BLE001 - one bad video must not stop the batch
            print(f"  ECHEC {m['youtubeId']}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
