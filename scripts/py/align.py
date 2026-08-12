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
import math
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
MIN_NAME_SCORE = 0.5

# The chair opens the question period by reading the list of everyone who
# registered to speak:
#
#   "So we'll start with Alessia Proietti, Jill Murray, Michael Shafter,
#    Alexander Gorchkov, Marc Gagnon, Hallah... Those are the top ten."
#
# Six names in one breath, all of them real mentions, none of them the moment
# that person actually spoke. Anchoring on the roll call gave the first six
# residents of the 13 April sitting the same timestamp -- a citation pointing at
# the chair reading a list -- and, because the assignment has to run in order,
# it consumed the early part of the recording and left the next three speakers
# with nowhere to go despite their names being right there in the transcript.
#
# A roll call is recognisable without knowing the words: several *different*
# people named within a breath of each other. Nothing here needs to know how the
# chair phrases it, which matters because that changes every sitting and between
# languages.
#
# The threshold is measured against the symptom rather than guessed. A roll call
# betrays itself by giving several residents the *same* timestamp, and people do
# not speak simultaneously -- so sweeping the threshold and counting how many
# aligned interventions land on a distinct minute says which value is right:
#
#     threshold   aligned   same-minute   distinct
#       none         73          25          48
#         3          64           8          56
#         5          65           8          57
#         7          67          14          53
#
# Unfiltered, a third of the timestamps were wrong: the 4 May sitting reported a
# flawless 21 of 21 while six of those residents shared 1h37 and five more shared
# 2h10, all of them pointing at the chair reading a list rather than at anyone
# speaking. Five is the value that leaves the most citations standing on a moment
# of their own.
ROLLCALL_WINDOW = 25
ROLLCALL_MIN_NAMES = 5

# The floor on how long one person holds the microphone.
#
# Two residents cannot start speaking eight seconds apart, so an assignment that
# says they did has placed at least one of them wrong. Measured across the 2026
# sittings the two populations do not overlap at all: genuine consecutive turns
# run 227 to 1834 seconds apart, while the bad ones cluster at 3 to 17 -- the
# residue of shorter name lists that slip under the roll-call filter.
#
# Enforced inside the assignment rather than as a cleanup afterwards, so a
# speaker crowded out of one position can be given a later one instead of simply
# being dropped.
MIN_TURN_S = 60.0

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

    # Short tokens must match exactly.
    #
    # This used to treat a single letter as an initial, so "S." would match
    # "Steven". In French that is a disaster: elision and filler leave single
    # letters scattered through every sentence -- "il y a", "j'ai", "l'avenue" --
    # and each one matched any name starting with the same letter. Every "y" in
    # the sitting became Yvan Burman, giving him 78 spurious mentions to Lisa
    # Freeman's 2, and the ordering pass then had no way to tell which was real.
    #
    # Below four characters the ratio test is meaningless anyway: two of three
    # shared letters already clears any sane threshold.
    if len(a) < 4 or len(b) < 4:
        return 0.0

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


def match_positions(words: list[dict], token: str) -> list[int]:
    """Every word index that reads as `token`, allowing for ASR mangling."""
    return [i for i, w in enumerate(words) if similar(w["t"], token) >= TOKEN_SIMILARITY]


def candidates(words: list[dict], people: list[list[str]]) -> list[list[tuple[int, float]]]:
    """
    Per person, every moment in the recording that looks like their name.

    Anchored on the *rarest* part of the name, weighted by how rare each part
    is. Both details are load-bearing, and getting them wrong cost thirteen of
    sixteen speakers on the first real run:

      - Anchoring on the first token assumes the given name survives. It often
        does not: the record's "Joël Coppieters" reaches the transcript as
        "Coppieters" alone, and "Hartley Barber" as "Hartley" alone. Requiring
        both parts to sit together threw those away.

      - Weighting by rarity is what keeps that leniency safe. "Marc" occurs
        twelve times in one sitting and means almost nothing on its own;
        "Rouleau" occurs three times and means almost everything. Scoring a
        lone "Marc" as half a match invited exactly the false anchors that
        ordering then had to clean up.

    A name whose parts are all absent yields no candidates, and that person
    keeps a null timestamp rather than being placed by guesswork.
    """
    # Where each name part occurs, computed once per distinct token.
    positions: dict[str, list[int]] = {}
    for tokens in people:
        for tok in tokens:
            if tok not in positions:
                positions[tok] = match_positions(words, tok)

    def weight(tok: str) -> float:
        n = len(positions[tok])
        # Absent parts cannot be found, so they neither help nor penalise.
        return 0.0 if n == 0 else 1.0 / (1.0 + math.log(n))

    out: list[list[tuple[int, float]]] = []

    for tokens in people:
        weights = {t: weight(t) for t in tokens}
        total = sum(weights.values())
        present = [t for t in tokens if weights[t] > 0]
        if total <= 0 or not present:
            out.append([])
            continue

        anchor = min(present, key=lambda t: len(positions[t]))
        hits: list[tuple[int, float]] = []

        for p in positions[anchor]:
            # Look both ways: the anchor may be the surname, with the given
            # name sitting before it.
            lo, hi = p - NAME_WINDOW, p + NAME_WINDOW
            found = sum(
                w
                for t, w in weights.items()
                if w > 0 and any(lo <= q <= hi for q in positions[t])
            )
            score = found / total
            if score < MIN_NAME_SCORE:
                continue
            # The same name said twice over ("madame Freeman, Lisa Freeman") is
            # one mention; two speakers announced back to back are not. Judged
            # on the window actually used.
            if hits and p - hits[-1][0] <= NAME_WINDOW:
                if score > hits[-1][1]:
                    hits[-1] = (p, score)
                continue
            hits.append((p, score))

        out.append(hits)

    return drop_rollcalls(out)


def drop_rollcalls(
    cands: list[list[tuple[int, float]]],
) -> list[list[tuple[int, float]]]:
    """
    Discard mentions that are part of the chair reading the sign-up list.

    Judged by company, not by wording: a position keeps its candidate only if
    fewer than ROLLCALL_MIN_NAMES *other* people are named within a breath of
    it. Nothing here needs to know what a roll call sounds like, which matters
    because the chair introduces it differently every sitting and in either
    language.

    A person named only in the roll call ends up with no candidates at all, and
    that is the right outcome: no timestamp is better than one that opens the
    video on somebody reading a list.
    """
    marks: list[tuple[int, int]] = [
        (pos, person) for person, hits in enumerate(cands) for pos, _ in hits
    ]
    marks.sort()

    def crowd(pos: int, person: int) -> int:
        """Distinct other people named within ROLLCALL_WINDOW words of `pos`."""
        others = {
            p
            for q, p in marks
            if p != person and abs(q - pos) <= ROLLCALL_WINDOW
        }
        return len(others)

    return [
        [(pos, s) for pos, s in hits if crowd(pos, person) < ROLLCALL_MIN_NAMES]
        for person, hits in enumerate(cands)
    ]


def align(
    cands: list[list[tuple[int, float]]], words: list[dict]
) -> list[int | None]:
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
                # Strictly later, and far enough later to be a separate turn.
                if pos > last and (
                    last < 0 or words[pos]["start"] - words[last]["start"] >= MIN_TURN_S
                ):
                    nxt.append((pos, total + s, path + (pos,)))

        # Prune: for a given "last index", only the best score can ever win,
        # and a state with a later index and lower score is dominated.
        best_by_last: dict[int, tuple[int, float, tuple]] = {}
        for st in nxt:
            cur = best_by_last.get(st[0])
            if cur is None or st[1] > cur[1]:
                best_by_last[st[0]] = st

        # Keep the Pareto frontier over (earliest position, best score).
        #
        # One state beats another only when it is better on both counts: it ends
        # no later in the recording *and* it has scored no worse. An earlier
        # position is an asset, because it leaves more of the sitting available
        # to the speakers still to be placed.
        #
        # This ran backwards at first, keeping a state only when it beat those
        # positioned later. That threw away every early, modest-scoring state --
        # including the one that had just placed Findley at 1h28 with two
        # matches, discarded in favour of a single lucky match at 4h03. With the
        # early states gone there was nowhere left for the remaining thirteen
        # speakers to go, and they all came back unplaced.
        frontier = sorted(best_by_last.values(), key=lambda s: s[0])
        pruned: States = []
        best_so_far = float("-inf")
        for st in frontier:
            if st[1] > best_so_far:
                pruned.append(st)
                best_so_far = st[1]
        frontier = pruned

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

    # The copy of the minutes inside a transcript is a snapshot taken when the
    # audio was transcribed, which is hours of GPU time ago and several parser
    # fixes ago. Re-read the parsed file it came from, so a correction to
    # parse_pv.py reaches the alignment without re-transcribing the sitting.
    # Without this the aligner kept placing rows the parser had since dropped,
    # among them "4e question" and "(question", which are the clerk's asides and
    # not residents.
    fresh = ROOT / "data" / "docs" / "parsed" / f"{Path(pv['source']).stem}.json"
    if fresh.exists():
        pv = json.loads(fresh.read_text(encoding="utf-8"))
        data["pv"] = pv

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
    chosen = align(candidates(words, people), words)

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
        # Concatenated, not joined on a space.
        #
        # Whisper hands back each word with its own leading space already
        # attached, and it withholds that space exactly where French elides:
        # the tokens are "j" and "'aimerais", " l" and "'ordre". Stripping each
        # one and rejoining on a space put a space inside every elision in the
        # corpus -- "j 'ai", "l 'arrondissement", "d 'habitation", "20 ,000" --
        # so every quotation printed under a resident's name read as broken
        # French. Concatenating reproduces the segment text exactly.
        text = "".join(
            w["word"]
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
