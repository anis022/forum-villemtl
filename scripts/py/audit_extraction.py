"""
How much of each proces-verbal reaches the database, and how clean it is.

Two separate questions, both easy to hand-wave and neither safe to assume:

  COVERAGE   Do the words on the page survive into some stored field? Measured
             per word, not per line: the parser deliberately restructures --
             "Alexandre Teodoresco, conseiller du district de Loyola;" is stored
             as a name and a district, so the line never reappears verbatim.
             A line-level metric scored that as data loss and reported 78 %
             coverage for a parser that had lost nothing.

  FIDELITY   Are the words intact? PDF files store no spaces. The reader infers
             them from glyph positions, and where the layout packs characters
             tightly the inference fails: "Sonny Moroz" arrives as "SonnyMoroz",
             which no search will ever match.

    python scripts/py/audit_extraction.py
    python scripts/py/audit_extraction.py --show-missing
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parse_pv import (  # noqa: E402
    AGENDA_CODE,
    PAGE_NUMBER,
    QUESTION_HEADER,
    RESOLUTION,
    SECTION_HEAD,
    SEPARATOR,
    read_lines,
)

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "data" / "docs"
PARSED = DOCS / "parsed"
OUT = ROOT / "data" / "extraction-audit.txt"

# A lowercase letter running straight into a capital: two words the extractor
# fused. The borough's own name is hyphenated and capitalised by nature, so it
# is excluded rather than reported 130 times as a defect.
GLUED_CASE = re.compile(r"[a-zà-ÿ]{2}[A-ZÀ-Ý]")
BOROUGH = re.compile(r"c[oô]te-des-neiges|notre-dame-de-gr[aâ]ce", re.I)
LONG_TOKEN = 24

# Procedural scaffolding: read for its content, never stored as prose.
PROCEDURAL = re.compile(
    r"^(il est propos|appuy[ée] par|ainsi que|pr[ée]sences?\s*:|absences?\s*:"
    r"|proc[èe]s-verbal de la s[ée]ance|un d[ée]bat s'engage|nom\s+sujet)",
    re.I,
)


def deaccent(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def words_of(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", deaccent(text).lower()) if len(w) > 2]


def collect_text(parsed: dict) -> list[str]:
    out: list[str] = []
    for r in parsed["resolutions"]:
        out += [r["number"], r["title"], r["body"] or "", r["movedBy"] or ""]
        out += [r["secondedBy"] or "", r["outcome"] or ""]
    for q in parsed["publicQuestions"]:
        out += [q["name"], q["subject"]]
    for r in parsed.get("councilRemarks", []):
        out += [r["name"], r["topic"]]
    out += [s["title"] for s in parsed["sections"]]
    out += parsed.get("notes", [])
    p = parsed["presences"]
    out.append(p.get("president") or "")
    for c in p.get("councillors", []):
        out += [c["name"], c["district"]]
    for s in p.get("staff", []):
        out += [s["name"], s["role"]]
    return [x for x in out if x]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--show-missing", action="store_true")
    args = ap.parse_args()

    pdfs = sorted(DOCS.glob("pv-*.pdf"))
    grand = Counter()
    missing_lines: list[str] = []
    glued: list[str] = []
    report: list[str] = []

    for pdf in pdfs:
        pfile = PARSED / f"{pdf.stem}.json"
        if not pfile.exists():
            continue
        parsed = json.loads(pfile.read_text(encoding="utf-8"))
        kept = set()
        for field in collect_text(parsed):
            kept.update(words_of(field))

        for line in read_lines(pdf):
            text = line.text.strip()
            if (
                not text
                or SEPARATOR.match(text)
                or PAGE_NUMBER.match(text)
                or AGENDA_CODE.match(text)
                or QUESTION_HEADER.match(text)
                or SECTION_HEAD.match(text)
                or RESOLUTION.match(text)
            ):
                grand["structurelles"] += 1
                continue

            ws = words_of(text)
            if not ws:
                continue
            found = sum(1 for w in ws if w in kept)
            grand["mots_page"] += len(ws)
            grand["mots_retenus"] += found

            # A line is "lost" only when almost none of it survived anywhere.
            if found <= len(ws) * 0.25:
                grand["lignes_perdues"] += 1
                if not PROCEDURAL.match(text) and len(missing_lines) < 40:
                    missing_lines.append(f"{pdf.stem}: {text[:100]}")
            grand["lignes_contenu"] += 1

        for field in collect_text(parsed):
            for tok in field.split():
                grand["mots_stockes"] += 1
                if BOROUGH.search(tok):
                    continue
                if GLUED_CASE.search(tok) or len(tok) > LONG_TOKEN:
                    grand["mots_soudes"] += 1
                    if len(glued) < 40:
                        glued.append(f"{pdf.stem}: {tok}")

    mp, mr = grand["mots_page"], grand["mots_retenus"]
    pct = 100 * mr / mp if mp else 0
    report.append(f"{len(pdfs)} proces-verbaux\n")
    report.append("COUVERTURE (par mot, sur les lignes de contenu)")
    report.append(f"  mots sur la page       {mp:6d}")
    report.append(f"  retrouves en base      {mr:6d}   ({pct:.1f} %)")
    report.append(f"  perdus                 {mp - mr:6d}   ({100 - pct:.1f} %)")
    report.append(f"  lignes quasi perdues   {grand['lignes_perdues']:6d} / {grand['lignes_contenu']}")
    report.append("")
    report.append("FIDELITE (sur le texte stocke)")
    report.append(f"  mots stockes           {grand['mots_stockes']:6d}")
    g = grand["mots_soudes"]
    report.append(f"  mots soudes            {g:6d}   ({100 * g / max(grand['mots_stockes'],1):.2f} %)")

    if glued:
        report.append("\nmots soudes :")
        report += [f"  {x}" for x in glued]
    if args.show_missing and missing_lines:
        report.append("\nlignes non retenues (hors procedure) :")
        report += [f"  {x}" for x in missing_lines]

    OUT.write_text("\n".join(report), encoding="utf-8")
    print(f"rapport ecrit dans {OUT.relative_to(ROOT)}")
    print("\n".join(report[:14]))


if __name__ == "__main__":
    main()
