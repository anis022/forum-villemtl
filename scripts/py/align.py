"""
Stage 2: give every name in the official record a moment in the recording.

The proces-verbal says Steven Jass raised the Terrebonne bike path. The
transcript says what was said, second by second. Neither alone can answer
"show me". This joins them.

The join is possible because of one fact about how a council sitting runs: the
chair calls the next speaker by name, and the minutes list those speakers in
the order they were called. So the resident names in the record and the name
mentions in the transcript are two readings of the same sequence, and matching
them is sequence alignment rather than search.

That framing is what makes this reliable. Matching each name independently
would let "Michael Tessler" bind to whichever of the evening's four Michaels
scored highest. Requiring the assignment to run in order -- nobody can be
called before the person the clerk listed above them -- throws away almost
every wrong answer, because a wrong answer is nearly always out of sequence.

Skipping is allowed and costs something. A chair who says "next please" without
a name leaves that resident unlocatable, and an alignment that shrugged and
guessed would put a citation on the wrong person. Those rows keep a null
timestamp and the page says so.

    python scripts/py/align.py --all
    python scripts/py/align.py eAdQaeKWXxE

Writes alignment back into data/transcripts/<id>.json.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRANSCRIPTS = ROOT / "data" / "transcripts"

# How far past a name mention we look for the rest of that name. "Monsieur
# Irwin Rapoport" puts two words between the tokens we are matching, and a
# courtesy or a hesitation adds one or two more.
#
# Kept deliberately tight. A wide window lets a first name reach forward and
# capture an unrelated surname: on "monsieur Michael Shafter [...] monsieur
# Michael Tessler", a window of fourteen let Tessler bind to Shafter's
# "Michael", which then blocked the real Tessler later in the sequence and cost
# him his timestamp entirely.
NAME_WINDOW = 6

# A token pair closer than this is treated as the same word. Whisper mangles
# surnames; "Rapoport" coming back as "Rapaport" must still match.
TOKEN_SIMILARITY = 0.78

# Below this fraction of a person's name tokens found, it is not a mention.
MIN_NAME_SCORE = 0.55

# Leaving a resident unaligned costs this much score. Set below the weakest
# real match so a genuine mention always beats skipping, and above noise so a
# single common first name does not drag someone to the wrong minute.
SKIP_PENALTY = 0.5

# Speakers are given a few minutes each; used only to bound the last one.
MAX_TURN_S = 600.0

# Names carry no information when they are this common in French address.
STOPWORDS = {
    "monsieur", "madame", "m", "mme", "dr", "me", "de", "du", "des", "la",
    "le", "les", "et", "d", "l", "van", "di",
}


def deaccent(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def norm_token(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", deaccent(s).lower())


def similar(a: str, b: str) -> float:
    """
    Cheap normalised similarity, no dependencies.

    Uses the ratio of the longest common subsequence to the longer string,
    which tolerates the substitutions and dropped letters that ASR makes on a
    surname without matching two unrelated names of similar length.
    """
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0
    # An initial against a full name is a real match: "S. Jass" for "Steven".
    if len(a) == 1 or len(b) == 1:
        return 1.0 if a[0] == b[0] else 0.0

    prev = [0] * (len(b) + 1)
    for ca in a:
        cur = [0]
        for j, cb in enumerate(b):
            cur.append(prev[j] + 1 if ca == cb else max(prev[j + 1], cur[j]))
        prev = cur
    return prev[-1] / max(len(a), len(b))


def name_tokens(name: str) -> list[str]:
    out = []
    for raw in re.split(r"[\s\-']+", name):
        tok = norm_token(raw)
        if tok and tok not in STOPWORDS and len(tok) > 1:
            out.append(tok)
    return out


def flatten(transcript: dict) -> list[dict]:
    """Every word in the sitting, in order, with the time it was said."""
    words: list[dict] = []
    for seg in transcript["segments"]:
        for w in seg["words"]:
            tok = norm_token(w["word"])
            if tok:
                words.append({"t": tok, "start": w["start"], "end": w["end"]})
    return words


def score_at(words: list[dict], i: int, tokens: list[str]) -> tuple[float, int]:
    """
    How much of `tokens` appears in the window starting at word `i`, and where
    the match ended.

    The first token must match at `i` itself -- otherwise every position inside
    the window scores alike and the timestamp drifts off the actual mention.
    """
    if not tokens:
        return 0.0, i
    if similar(words[i]["t"], tokens[0]) < TOKEN_SIMILARITY:
        return 0.0, i

    found = 1
    j = i + 1
    last = i
    limit = min(len(words), i + NAME_WINDOW)
    for tok in tokens[1:]:
        k = j
        while k < limit:
            if similar(words[k]["t"], tok) >= TOKEN_SIMILARITY:
                found += 1
                j, last = k + 1, k
                break
            k += 1
    return found / len(tokens), last


def candidates(words: list[dict], people: list[list[str]]) -> list[list[tuple[int, float]]]:
    """Per person, every position in the recording that looks like their name."""
    out: list[list[tuple[int, float]]] = []
    for tokens in people:
        hits: list[tuple[int, float]] = []
        ends: list[int] = []
        for i in range(len(words)):
            s, last = score_at(words, i, tokens)
            if s < MIN_NAME_SCORE:
                continue
            # The same name said twice over ("madame Freeman, Lisa Freeman") is
            # one mention. Two different people are not, so overlap is judged
            # on the words the match actually consumed rather than on a fixed
            # gap -- which would merge two speakers announced back to back.
            if hits and i <= ends[-1]:
                if s > hits[-1][1]:
                    hits[-1] = (i, s)
                    ends[-1] = last
                continue
            hits.append((i, s))
            ends.append(last)
        out.append(hits)
    return out


def align(cands: list[list[tuple[int, float]]]) -> list[int | None]:
    """
    Choose at most one position per person, strictly in order, best total score.

    Straight dynamic programming over (person, chosen position). `best[j]` is
    the best score achievable for the people already placed, given the last one
    landed at word index j; a new person may take any candidate after that.
    """
    n = len(cands)
    if not n:
        return []

    # state: (last word index used, total score, back-pointer chain)
    # Kept as a list of frontier states, pruned to those that are not dominated.
    States = list[tuple[int, float, tuple]]
    frontier: States = [(-1, 0.0, ())]

    for person in range(n):
        nxt: States = []
        for last, total, path in frontier:
            # Skip this person.
            nxt.append((last, total - SKIP_PENALTY, path + (None,)))
            for pos, s in cands[person]:
                if pos > last:
                    nxt.append((pos, total + s, path + (pos,)))

        # Prune: for a given "last index", only the best score can ever win,
        # and a state with a later index and lower score is dominated.
        best_by_last: dict[int, tuple[int, float, tuple]] = {}
        for st in nxt:
            cur = best_by_last.get(st[0])
            if cur is None or st[1] > cur[1]:
                best_by_last[st[0]] = st

        frontier = sorted(best_by_last.values(), key=lambda s: s[0])
        pruned: States = []
        best_so_far = float("-inf")
        # Walking from the latest index backwards, keep a state only if it beats
        # everything that starts later -- anything else can be replaced by that
        # later state without cost.
        for st in reversed(frontier):
            if st[1] > best_so_far:
                pruned.append(st)
                best_so_far = st[1]
        frontier = list(reversed(pruned))

    best = max(frontier, key=lambda s: s[1])
    return list(best[2])


def run_one(path: Path, force: bool) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    if "alignment" in data and not force:
        print(f"  {path.stem}: deja aligne")
        return

    pv = data.get("pv")
    if not pv:
        print(f"  {path.stem}: pas de proces-verbal joint — ignore", file=sys.stderr)
        return

    # Only spoken questions happen in the room. Written ones are tabled, not
    # read out, so there is no moment in the recording to point at.
    oral = [q for q in pv["publicQuestions"] if q["mode"] == "orale"]
    if not oral:
        print(f"  {path.stem}: aucune question orale")
        return

    words = flatten(data)
    if not words:
        print(f"  {path.stem}: transcription sans horodatage de mots", file=sys.stderr)
        return

    people = [name_tokens(q["name"]) for q in oral]
    chosen = align(candidates(words, people))

    # Each speaker holds the floor until the next one is called.
    starts = [None if c is None else words[c]["start"] for c in chosen]
    aligned = []
    for idx, q in enumerate(oral):
        start = starts[idx]
        if start is None:
            aligned.append({**q, "startS": None, "endS": None, "transcript": None})
            continue
        later = [s for s in starts[idx + 1 :] if s is not None]
        end = min(later[0], start + MAX_TURN_S) if later else start + MAX_TURN_S
        text = " ".join(
            w["word"].strip()
            for seg in data["segments"]
            for w in seg["words"]
            if start <= w["start"] < end
        )
        aligned.append({**q, "startS": start, "endS": end, "transcript": text.strip()})

    # The agenda is fixed: the public question period sits between the council's
    # own comments and the resolutions. So the two moments we located bracket
    # the sitting into the sections the search page filters on. This is a
    # structural inference, not a claim about any individual sentence.
    located = [s for s in starts if s is not None]
    q_start = min(located) if located else None
    q_end = max(a["endS"] for a in aligned if a["endS"] is not None) if located else None

    def section_for(t: float) -> str:
        if q_start is None:
            return "autre"
        if t < q_start:
            return "commentaires"
        if t <= q_end:
            return "questions"
        return "resolutions"

    sections = [
        {"start": s["start"], "end": s["end"], "section": section_for(s["start"])}
        for s in data["segments"]
    ]

    data["alignment"] = {
        "questions": aligned,
        "sections": sections,
        "questionPeriod": {"start": q_start, "end": q_end},
    }
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    hit = sum(1 for a in aligned if a["startS"] is not None)
    print(f"  {path.stem}: {hit}/{len(oral)} interventions reperees dans l'enregistrement")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    files = (
        [TRANSCRIPTS / f"{i}.json" for i in args.ids]
        if args.ids
        else sorted(TRANSCRIPTS.glob("*.json"))
    )
    files = [f for f in files if f.exists()]
    if not files:
        print("aucune transcription. Lancer transcribe.py d'abord.", file=sys.stderr)
        sys.exit(1)

    for f in files:
        run_one(f, args.force)


if __name__ == "__main__":
    main()
