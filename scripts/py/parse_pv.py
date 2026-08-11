"""
Stage 0b: proces-verbal PDF -> structured JSON.

No AI anywhere in this file, on purpose. The proces-verbal is a form document
produced by the same clerk's office template for a decade, so its structure is
regular enough to read with rules -- and rules, unlike a model, cannot invent a
resident who never spoke or drop one who did. Everything downstream that claims
"x personnes" counts rows produced here, so this parser is the place where
being boring is a feature.

What it recovers per sitting:

  presences          the mayor, councillors by district, and senior staff
  resolutions        CA26 170123 -> title, mover, seconder, body, outcome,
                     agenda code (20.04) and dossier number
  public questions   the 10.05 / 10.06 tables: one row per resident, with the
                     subject the clerk recorded and the order they spoke in
  council periods    10.04 comments and 10.07 questions, per councillor

The question tables are the delicate part. They are laid out in two columns,
and flat text extraction glues them together -- "Lisa Freeman Budget pour
l'accessibilite universelle" gives no way to tell where the name stops. So this
reads word coordinates instead and splits on the column gap, which the template
places at the same x for every row of a table.

    python scripts/py/parse_pv.py              # everything not yet parsed
    python scripts/py/parse_pv.py --force      # re-parse all
    python scripts/py/parse_pv.py data/docs/pv-8440.pdf
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "data" / "docs"
OUT = DOCS / "parsed"

# --- shapes in the document ------------------------------------------------

# The clerk rules off with two different lengths, and they mean opposite things:
#
#     ____________________________   28 — end of a resolution or a section
#     __________________             18 — wraps "Un débat s'engage" *inside* one
#     ______________________         22 — introduces the annexes of one
#
# Treating any run of underscores as a block end stopped every debated
# resolution at its first inline rule, before the verdict printed below it. That
# is why 79 of 142 resolutions had no recorded outcome and why not one of them
# recorded a debate: the parser never read that far.
SEPARATOR = re.compile(r"^_{25,}$")

# Shorter rules are punctuation within a block: skipped, never a boundary.
INLINE_RULE = re.compile(r"^_{5,24}$")
RESOLUTION = re.compile(r"^R[EÉ]SOLUTION\s+((?:CA|OCA)\d{2})\s+(\d{5,7})\s*$", re.I)
# The clerk files each item under its agenda code, optionally with the
# decision-record number the city uses internally: "20.04 1268524001".
AGENDA_CODE = re.compile(r"^(\d{2}\.\d{2})(?:\s+(\d{7,12}))?\s*$")
SECTION_HEAD = re.compile(r"^(\d{2}\.\d{2})\s*[-–—]\s*(.+?)\s*$")
MOVED_BY = re.compile(r"^Il est propos[ée]\s+par\s+(.+?)\s*$", re.I)
SECONDED_BY = re.compile(r"^appuy[ée]\s+par\s+(.+?)\s*$", re.I)
DEBATE = re.compile(r"^Un d[ée]bat s'engage", re.I)

# How a decision is recorded.
#
# Matched by shape rather than against a list of exact strings, because the
# clerk writes the same verdict several ways: "ADOPTÉ" as often as "ADOPTÉE",
# and a resolution that survived an amendment closes with "LA PROPOSITION
# PRINCIPALE EST ADOPTÉE À LA MAJORITÉ." rather than the bare verdict. Exact
# matching read those as body text and left the resolution with no outcome.
#
# Deliberately anchored to the whole line: "adoptée" appears inside the prose of
# many resolutions ("les mesures adoptées reflètent..."), and matching that
# would record a verdict where there is none.
OUTCOME_RE = re.compile(
    r"^(?:(?:LA|L')\s*(?:PROPOSITION\s+PRINCIPALE|AMENDEMENT[^.]*?)\s+EST\s+)?"
    r"(ADOPT[EÉ]E?|REJET[EÉ]E?|RETIR[EÉ]E?|REPORT[EÉ]E?)"
    r"(\s+(?:[AÀ]\s+L'UNANIMIT[EÉ]|[AÀ]\s+LA\s+MAJORIT[EÉ](?:\s+DES\s+VOIX)?"
    r"|TELLE\s+QUE\s+MODIFI[EÉ]E?))?\s*\.?$",
    re.I,
)

# Canonical spellings, so a count can group by outcome without seeing the same
# decision under three labels.
VERDICT_CANON = {
    "adopt": "ADOPTÉE",
    "rejet": "REJETÉE",
    "retir": "RETIRÉE",
    "report": "REPORTÉE",
}


def read_outcome(text: str) -> str | None:
    """The verdict on this line, in canonical form, or None."""
    m = OUTCOME_RE.match(text.strip())
    if not m:
        return None
    stem = deaccent(m.group(1)).lower().rstrip("e")
    verdict = VERDICT_CANON.get(stem)
    if not verdict:
        return None

    qualifier = (m.group(2) or "").strip()
    if not qualifier:
        return verdict
    q = norm(qualifier)
    if "unanimit" in q:
        return f"{verdict} À L'UNANIMITÉ"
    if "majorit" in q:
        return f"{verdict} À LA MAJORITÉ"
    return f"{verdict} TELLE QUE MODIFIÉE"

QUESTION_HEADER = re.compile(r"^Nom\s+Sujet de la question\s*$", re.I)

# "40.04 - Parcomètres sur la rue Sherbrooke Ouest" -> the subject alone.
SUBJECT_AGENDA_PREFIX = re.compile(r"^\d{2}\.\d{2}\s*[-–—]\s*")

# A role written after the name rather than before it. Anchored to the end so
# it cannot bite into a name that merely contains one of these words.
TRAILING_TITLE = re.compile(
    r"\s+(le|la)\s+(maire|mairesse)(\s+suppl[ée]ant(e)?)?\s*$"
    r"|\s+(le|la)\s+conseill(er|[èe]re)\s*$",
    re.I,
)

# The clerk sometimes writes in the name column rather than a name -- most often
# "Personne non entendue faute de temps" when the period ran out. Counting that
# as a resident would inflate every total that follows, so it is kept as a note
# on the sitting instead. Matched against the deaccented text.
CLERK_NOTE = re.compile(
    r"(non entendue?s?\b|faute de temps|aucune? (question|personne|intervenant)"
    r"|pas ete entendue?s?\b|liste des? personnes)",
    re.I,
)

# No resident's name runs this long; past it the cell holds prose, not a person.
MAX_NAME_WORDS = 6

# The clerk's notes are written as sentences that begin in the name column and
# run on into the subject column, so the name cell reads as a single innocuous
# word:
#
#     Personne | ayant quitté la séance ou ayant retiré sa question
#     Personne | non entendue faute de temps
#
# Judged on the name alone these look like a resident called "Personne", and
# seven of them were being counted as people across the 2026 sittings. No real
# name is one of these words, so the word itself is the signal -- safer than
# scanning subjects for note-like phrasing, which would eventually discard a
# genuine question about, say, personnes itinérantes.
GENERIC_NAME = re.compile(r"^(personnes?|aucune?|aucun|nul(le)?|neant)$", re.I)

# Through 2022 the clerk bulleted the speakers' names with a Wingdings glyph,
# which survives extraction as U+F0B7 and would otherwise become part of the
# name -- " Gale Pettus" and "Gale Pettus" are two different residents as
# far as a GROUP BY is concerned.
BULLET = re.compile(r"^[•●▪\-–—\*\s]+")

PUBLIC_PERIOD = re.compile(r"p[ée]riode de (questions|demandes)", re.I)

# The council's own two periods, 10.04 and 10.07. Distinct from the public ones
# and from each other: one is what the elected members chose to raise, the other
# is what they asked the administration.
COUNCIL_PERIOD = re.compile(
    r"p[ée]riode de (commentaires|questions).{0,40}(membres du conseil|conseillers|mairesse)",
    re.I,
)

# The clerk's bullet, a Wingdings glyph that survives extraction as U+F0B7.
# It is the structural signal in these sections: it opens each new item, and a
# line without one continues the item above.
BULLET_GLYPH = re.compile(r"^[•●▪·-]$")

REMARK_COMMENT = "commentaire"
REMARK_QUESTION = "question"

# A bare page number sits alone on its line; it would otherwise land inside a
# resolution body and corrupt the text.
PAGE_NUMBER = re.compile(r"^\d{1,4}$")

ORAL = "orale"
WRITTEN = "ecrite"


def deaccent(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def norm(s: str) -> str:
    """Comparison key: accents and case folded away, whitespace collapsed."""
    return re.sub(r"\s+", " ", deaccent(s)).strip().lower()


# --- line reconstruction ---------------------------------------------------


class Line:
    __slots__ = ("text", "words", "page", "top", "x0")

    def __init__(self, words: list[dict], page: int) -> None:
        self.words = sorted(words, key=lambda w: w["x0"])
        self.text = " ".join(w["text"] for w in self.words)
        self.page = page
        self.top = self.words[0]["top"]
        self.x0 = self.words[0]["x0"]

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<L p{self.page} {self.text[:60]!r}>"


def read_lines(path: Path) -> list[Line]:
    """Every page flattened into one ordered stream of coordinate-bearing lines."""
    lines: list[Line] = []
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages):
            buckets: dict[int, list[dict]] = defaultdict(list)
            # x_tolerance=2 rather than pdfplumber's default 3.
            #
            # A PDF stores no spaces: the reader decides where one word ends by
            # how wide the gap between glyphs is. At the default, tightly set
            # lines in these minutes come back fused --
            # "stationnementssurl'avenueRidgewood", "5754UpperLachine" -- and a
            # fused word is invisible to full-text search forever after.
            # Dropping the threshold splits those correctly; measured over the
            # 2026 sittings it takes the fused-word count from 17 to near zero
            # without breaking ordinary words apart.
            for w in page.extract_words(x_tolerance=2):
                # Round to the nearest 3pt so a word sitting a hair proud of its
                # neighbours still joins the same line.
                buckets[round(w["top"] / 3)].append(w)
            for key in sorted(buckets):
                line = Line(buckets[key], pno)
                if PAGE_NUMBER.match(line.text):
                    continue
                lines.append(line)
    return lines


def split_column(rows: list[Line]) -> float | None:
    """
    Find the x below which a word belongs to the name column.

    Per row, the widest gap between consecutive words is the column gutter. One
    row can mislead -- a very long name leaves a narrow gutter, a two-word
    subject a wide one -- so the median across the table decides where the
    subject column begins.

    The returned boundary sits a hair to the left of that. Wrapped subject
    lines are typeset a fraction of a point off the column they belong to
    (195.8 against 196.0 in the June 2025 minutes), and a boundary set exactly
    on the column edge files them under the resident's name instead.
    """
    candidates: list[float] = []
    for row in rows:
        best_gap, best_x = 0.0, None
        prev = None
        for w in row.words:
            if prev is not None:
                gap = w["x0"] - prev
                if gap > best_gap:
                    best_gap, best_x = gap, w["x0"]
            prev = w["x1"]
        # Below ~15pt it is word spacing, not a column boundary.
        if best_x is not None and best_gap >= 15:
            candidates.append(best_x)

    if len(candidates) < 2:
        return None
    return statistics.median(candidates) - 3.0


# --- section classification ------------------------------------------------


def question_mode(heading: str) -> str | None:
    h = norm(heading)
    if "question" not in h:
        return None
    if "ecrite" in h:
        return WRITTEN
    if "orale" in h or "public" in h:
        return ORAL
    return None


def parse_questions(
    lines: list[Line], start: int, mode: str, order0: int
) -> tuple[list[dict], list[str], int]:
    """
    Read one Nom | Sujet table beginning at the header line `start`.

    Returns its rows, any clerical notes found in it, and the index just past
    the table.

    The layout is not a simple one-line-per-row grid. A name is typeset
    vertically centred in its cell, so a resident whose subject runs to two
    lines has their name rendered *between* those lines:

        Pierrette Trudel | Coopérative d'habitation
                           Projet 4280 de la Savane [...] le transport en
        Bruno Guerra
                           commun et la circulation

    Read line by line, "commun et la circulation" looks like it continues
    Pierrette Trudel's subject and "Projet 4280" looks orphaned; in truth both
    belong to Bruno Guerra. So subject-only lines are buffered rather than
    attached on sight: if a name-only line comes next, the buffer is that
    person's opening lines; otherwise it is the tail of the row above.
    """
    body: list[Line] = []
    i = start + 1
    while i < len(lines):
        text = lines[i].text
        if (
            SEPARATOR.match(text)
            or RESOLUTION.match(text)
            or SECTION_HEAD.match(text)
            or QUESTION_HEADER.match(text)
        ):
            break
        if not INLINE_RULE.match(text):
            body.append(lines[i])
        i += 1

    split_x = split_column(body)
    if split_x is None:
        return [], [], i

    rows: list[dict] = []
    notes: list[str] = []
    pending: list[str] = []  # subject lines whose owner is not yet known

    def flush_to_previous() -> None:
        if pending and rows:
            rows[-1]["subject"] = " ".join([rows[-1]["subject"], *pending]).strip()
        pending.clear()

    for line in body:
        name = " ".join(w["text"] for w in line.words if w["x0"] < split_x).strip()
        subject = " ".join(w["text"] for w in line.words if w["x0"] >= split_x).strip()

        name = BULLET.sub("", name).strip()
        subject = BULLET.sub("", subject).strip()
        # The clerk sometimes files the subject under the agenda item it relates
        # to ("40.04 - Parcomètres sur la rue Sherbrooke Ouest"). The code is
        # useful to the clerk and noise to a reader, and it splits one subject
        # into two when only some rows carry it.
        subject = SUBJECT_AGENDA_PREFIX.sub("", subject).strip()

        # The clerk records who could not be reached; it is not a question.
        if name and (
            GENERIC_NAME.match(deaccent(name).strip())
            or CLERK_NOTE.search(deaccent(name))
            or len(name.split()) > MAX_NAME_WORDS
        ):
            notes.append(" ".join(filter(None, [name, subject])))
            continue

        if not name and not subject:
            continue

        if not name:
            pending.append(subject)
            continue

        # A name with no subject beside it owns the lines buffered above it.
        opening = list(pending) if not subject else []
        if subject:
            flush_to_previous()
        pending.clear()

        rows.append(
            {
                "name": name,
                "subject": " ".join([*opening, subject]).strip(),
                "mode": mode,
                "order": order0 + len(rows),
                "page": line.page,
            }
        )

    flush_to_previous()
    return rows, notes, i


def parse_remarks(
    lines: list[Line], start: int, kind: str, order0: int
) -> tuple[list[dict], int]:
    """
    Read a council comment or question period (10.04 / 10.07).

    Laid out on three x positions rather than two, which is what makes it
    readable without guessing:

        Peter McQueen   •  Marquage de la piste cyclable Notre-Dame-de-Grâce
                        •  Augmentation des actes racistes – affiches face au LCC
                           et événement à Shawinigan
                        •  Circulation des piétons

    The bullet opens an item, the name column names its owner, and a line with
    neither continues the item above. One councillor raises several things in a
    sitting, so this yields a row per item rather than a row per person: "what
    did McQueen say about bike lanes" has to be able to match one bullet without
    dragging in the other five.
    """
    body: list[Line] = []
    i = start + 1
    while i < len(lines):
        text = lines[i].text
        if SEPARATOR.match(text) or RESOLUTION.match(text) or SECTION_HEAD.match(text):
            break
        if not INLINE_RULE.match(text):
            body.append(lines[i])
        i += 1

    # The bullet column, taken from the document rather than assumed.
    bullet_xs = [
        w["x0"] for line in body for w in line.words if BULLET_GLYPH.match(w["text"])
    ]
    if not bullet_xs:
        return [], i
    bullet_x = statistics.median(bullet_xs)

    rows: list[dict] = []
    current_name: str | None = None
    pending_name: list[str] = []

    for line in body:
        words = line.words
        bullet_at = next(
            (k for k, w in enumerate(words) if BULLET_GLYPH.match(w["text"])), None
        )

        if bullet_at is None:
            text = " ".join(w["text"] for w in words).strip()
            if not text:
                continue
            # Right of the bullet column: the tail of the item above.
            if words[0]["x0"] >= bullet_x and rows:
                rows[-1]["topic"] = f"{rows[-1]['topic']} {text}".strip()
            elif words[0]["x0"] < bullet_x:
                # A name too long for its line ("Gracia Kasoki" / "Katahwa").
                pending_name.append(text)
            continue

        before = " ".join(w["text"] for w in words[:bullet_at]).strip()
        topic = " ".join(w["text"] for w in words[bullet_at + 1 :]).strip()

        if before or pending_name:
            current_name = " ".join([*pending_name, before]).strip() or current_name
            pending_name = []

        if not topic:
            continue
        rows.append(
            {
                "name": current_name or "",
                "topic": topic,
                "kind": kind,
                "order": order0 + len(rows),
                "page": line.page,
            }
        )

    return [r for r in rows if r["name"]], i


def parse_resolution(lines: list[Line], start: int) -> tuple[dict, int]:
    """Read one RÉSOLUTION block; returns it and the index just past it."""
    m = RESOLUTION.match(lines[start].text)
    assert m
    number = f"{m.group(1).upper()} {m.group(2)}"

    title_parts: list[str] = []
    body_parts: list[str] = []
    moved_by = seconded_by = outcome = agenda_code = dossier = None
    debate = False
    in_body = False

    i = start + 1
    while i < len(lines):
        text = lines[i].text

        if SEPARATOR.match(text) or RESOLUTION.match(text):
            break

        # An inline rule is punctuation, not content and not a boundary.
        if INLINE_RULE.match(text):
            i += 1
            continue

        code = AGENDA_CODE.match(text)
        if code:
            agenda_code, dossier = code.group(1), code.group(2)
            i += 1
            continue

        if DEBATE.match(text):
            debate = True
            i += 1
            continue

        mv = MOVED_BY.match(text)
        if mv:
            moved_by, in_body = mv.group(1), True
            i += 1
            continue

        sb = SECONDED_BY.match(text)
        if sb:
            seconded_by, in_body = sb.group(1), True
            i += 1
            continue

        hit = read_outcome(text)
        if hit:
            outcome = hit
            i += 1
            continue

        # Before the mover, uppercase lines are the title; after it, prose is
        # the operative text of the decision.
        if not in_body and not moved_by:
            title_parts.append(text)
        else:
            body_parts.append(text)
        i += 1

    return (
        {
            "number": number,
            "title": re.sub(r"\s+", " ", " ".join(title_parts)).strip(),
            "movedBy": moved_by,
            "secondedBy": seconded_by,
            "body": re.sub(r"[ \t]+", " ", "\n".join(body_parts)).strip(),
            "outcome": outcome,
            "agendaCode": agenda_code,
            "dossier": dossier,
            "debate": debate,
            "page": lines[start].page,
        },
        i,
    )


def parse_presences(lines: list[Line]) -> dict:
    """The header block: who presided, which councillors sat, which staff attended."""
    header = " ".join(l.text for l in lines[:40])
    header = re.sub(r"\s+", " ", header)

    president = None
    mp = re.search(
        r"sous la pr[ée]sidence (?:de|du|d')\s*(?:monsieur|madame|M\.|Mme)?\s*"
        r"(?:le maire|la mairesse|le conseiller|la conseill[èe]re)?\s*([A-ZÉÈÀÂÎÔÛÇ][^,;]{2,60}?)\s*,",
        header,
    )
    if mp:
        president = mp.group(1).strip()
        # The clerk puts the title before the name when the mayor presides
        # ("madame la mairesse Stephanie Valenzuela") but after it when a
        # stand-in does ("monsieur Sonny Moroz le maire suppléant"). Only the
        # leading form is consumed above, so the trailing one has to come off
        # here or four sittings out of five name a person who does not exist.
        president = TRAILING_TITLE.sub("", president).strip(" ,;")

    # Whether the chair was the borough mayor or a councillor standing in. Worth
    # keeping rather than flattening to "mayor": Sonny Moroz chaired four of the
    # five 2026 sittings as maire suppléant, and recording that as his role
    # would list the Snowdon councillor as borough mayor everywhere on the site.
    acting = bool(re.search(r"suppl[ée]ant", header, re.I))

    councillors: list[dict] = []
    for m in re.finditer(
        r"([A-ZÉÈÀÂÎÔÛÇ][\w'’\-\.]+(?:\s+[A-ZÉÈÀÂÎÔÛÇ][\w'’\-\.]+)*)\s*,\s*"
        r"conseill(?:er|[èe]re)\s+(?:du|de la|de l'|des)\s+district\s+(?:de\s+|d')?([^;,\.]+)",
        header,
    ):
        councillors.append({"name": m.group(1).strip(), "district": m.group(2).strip()})

    staff: list[dict] = []
    for m in re.finditer(
        r"([A-ZÉÈÀÂÎÔÛÇ][\w'’\-\.]+(?:\s+[A-ZÉÈÀÂÎÔÛÇ][\w'’\-\.]+)*)\s*,\s*"
        r"(directeur[^;,\.]*|directrice[^;,\.]*|secr[ée]taire[^;,\.]*)",
        header,
    ):
        staff.append({"name": m.group(1).strip(), "role": m.group(2).strip()})

    return {
        "president": president,
        "presidentActing": acting,
        "councillors": councillors,
        "staff": staff,
    }


def parse_pv(path: Path) -> dict:
    lines = read_lines(path)

    resolutions: list[dict] = []
    questions: list[dict] = []
    sections: list[dict] = []
    notes: list[str] = []
    remarks: list[dict] = []

    current_mode: str | None = None
    oral_n = written_n = 0

    i = 0
    while i < len(lines):
        text = lines[i].text

        sec = SECTION_HEAD.match(text)
        if sec:
            title = sec.group(2)
            sections.append({"code": sec.group(1), "title": title, "page": lines[i].page})

            # The council's own periods are read here, before the public-period
            # branch below: "PÉRIODE DE QUESTIONS DES MEMBRES DU CONSEIL" would
            # otherwise look like a public question period to it.
            if COUNCIL_PERIOD.search(deaccent(title)):
                kind = (
                    REMARK_COMMENT
                    if "commentaire" in norm(title)
                    else REMARK_QUESTION
                )
                order0 = sum(1 for r in remarks if r["kind"] == kind)
                rows, i = parse_remarks(lines, i, kind, order0)
                remarks.extend(rows)
                continue

            mode = question_mode(title)
            if mode:
                current_mode = mode
            i += 1
            continue

        # A question period can resume under a bare heading after the council
        # votes itself more time ("PROLONGATION DE LA PÉRIODE...", "RETOUR À LA
        # PÉRIODE..."). Those tables carry no section code, so the mode has to
        # be carried over from, or corrected by, the heading itself.
        if PUBLIC_PERIOD.search(deaccent(text)):
            mode = question_mode(text)
            if mode:
                current_mode = mode
            i += 1
            continue

        if QUESTION_HEADER.match(text):
            mode = current_mode or ORAL
            order0 = oral_n if mode == ORAL else written_n
            rows, table_notes, i = parse_questions(lines, i, mode, order0)
            if mode == ORAL:
                oral_n += len(rows)
            else:
                written_n += len(rows)
            questions.extend(rows)
            notes.extend(table_notes)
            continue

        if RESOLUTION.match(text):
            res, i = parse_resolution(lines, i)
            res["order"] = len(resolutions)
            resolutions.append(res)
            continue

        i += 1

    return {
        "source": str(path.relative_to(ROOT)).replace("\\", "/"),
        "presences": parse_presences(lines),
        "sections": sections,
        "resolutions": resolutions,
        "publicQuestions": questions,
        "councilRemarks": remarks,
        "notes": notes,
        "counts": {
            "resolutions": len(resolutions),
            "remarks": len(remarks),
            "oral": sum(1 for q in questions if q["mode"] == ORAL),
            "written": sum(1 for q in questions if q["mode"] == WRITTEN),
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*", help="PDF precis; sinon tous les pv-*.pdf")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    targets = [Path(f) for f in args.files] or sorted(DOCS.glob("pv-*.pdf"))
    if not targets:
        print("aucun proces-verbal. Lancer crawl_docs.py d'abord.", file=sys.stderr)
        sys.exit(1)

    ok = failed = 0
    for path in targets:
        dest = OUT / f"{path.stem}.json"
        if dest.exists() and not args.force:
            continue
        try:
            parsed = parse_pv(path)
        except Exception as e:  # noqa: BLE001 - one odd year must not stop the batch
            print(f"  ECHEC {path.name}: {e}", file=sys.stderr)
            failed += 1
            continue

        dest.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
        c = parsed["counts"]
        print(
            f"  {path.name}: {c['resolutions']:3d} resolutions, "
            f"{c['oral']:3d} questions orales, {c['written']:3d} ecrites"
        )
        ok += 1

    print(f"\n{ok} analyses, {failed} echecs -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
