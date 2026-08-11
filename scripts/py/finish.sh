#!/usr/bin/env bash
# Wait out the transcription pass, then align and load everything.
#
# Transcribing the 2026 sittings takes hours, and the two stages that follow are
# fast and idempotent. Chaining them means the corpus finishes itself rather
# than waiting on someone noticing the GPU went quiet.
#
#   bash scripts/py/finish.sh
#
# Waits on the artifacts, not on a process: one transcript per sitting in
# meetings.ts. Process-watching needed pgrep, which Git Bash on Windows does not
# ship, and "the process is gone" is in any case a weaker signal than "the files
# it was supposed to write are all there".
#
# Safe to re-run: align skips transcripts it has already aligned, and the
# transcript ingest replaces a meeting's segments wholesale.
set -u
cd "$(dirname "$0")/../.."

# Only the array entries. A bare `youtubeId:` also matches the type definition,
# which would leave this waiting forever for a seventh transcript.
expected=$(grep -c 'youtubeId: "' scripts/ingest/meetings.ts)
echo "attente de ${expected} transcription(s)…"

while :; do
  have=$(ls data/transcripts/*.json 2>/dev/null | wc -l)
  [ "$have" -ge "$expected" ] && break
  sleep 60
done

echo "  ${expected} transcriptions presentes."
echo
echo "=== alignement ==="
.venv-asr/Scripts/python.exe scripts/py/align.py --all

echo
echo "=== chargement des transcriptions ==="
npm run ingest:transcript

echo
echo "termine."
