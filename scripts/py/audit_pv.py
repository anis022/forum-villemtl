"""
Quality report on the parsed proces-verbaux.

Everything downstream counts rows this parser produced, so a silent failure --
a year whose layout changed, a table read as prose -- would show up not as an
error but as a resident who never gets counted. This looks for the shapes that
failure takes.

    python scripts/py/audit_pv.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PARSED = ROOT / "data" / "docs" / "parsed"

# A name the clerk typed should look like one: a couple of capitalised words.
NAME_SHAPE = re.compile(r"^[A-ZÉÈÀÂÎÔÛÇ][\w'’\-\.]*(?:\s+[\w'’\-\.]+){0,5}$")


def deaccent(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def main() -> None:
    files = sorted(PARSED.glob("pv-*.json"))
    if not files:
        print("rien a auditer.")
        return

    per_year: dict[str, Counter] = {}
    odd_names: list[tuple[str, str]] = []
    empty_subject = 0
    no_questions: list[str] = []
    no_resolutions: list[str] = []
    total_q = total_r = 0
    names = Counter()

    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        c = d["counts"]
        total_q += c["oral"] + c["written"]
        total_r += c["resolutions"]

        # The portal id is not a date, so bucket by the resolution prefix
        # (CA26 -> 2026), which the clerk stamps on every decision.
        year = "?"
        for r in d["resolutions"]:
            m = re.match(r"^(?:CA|OCA)(\d{2})", r["number"])
            if m:
                year = f"20{m.group(1)}"
                break
        per_year.setdefault(year, Counter())
        per_year[year]["files"] += 1
        per_year[year]["oral"] += c["oral"]
        per_year[year]["written"] += c["written"]
        per_year[year]["resolutions"] += c["resolutions"]

        if c["oral"] + c["written"] == 0:
            no_questions.append(f.name)
        if c["resolutions"] == 0:
            no_resolutions.append(f.name)

        for q in d["publicQuestions"]:
            names[q["name"]] += 1
            if not NAME_SHAPE.match(q["name"]):
                odd_names.append((f.name, q["name"]))
            if not q["subject"].strip():
                empty_subject += 1

    print(f"{len(files)} proces-verbaux analyses")
    print(f"{total_q} interventions citoyennes, {total_r} resolutions\n")

    print("par annee :")
    for year in sorted(per_year):
        c = per_year[year]
        print(
            f"  {year}  {c['files']:3d} seances  "
            f"{c['oral']:4d} orales  {c['written']:4d} ecrites  "
            f"{c['resolutions']:4d} resolutions"
        )

    print(f"\nsans aucune question : {len(no_questions)}")
    for n in no_questions[:10]:
        print(f"    {n}")
    print(f"sans aucune resolution : {len(no_resolutions)}")
    for n in no_resolutions[:10]:
        print(f"    {n}")

    print(f"\nsujets vides : {empty_subject}")
    print(f"noms de forme douteuse : {len(odd_names)}")
    for f, n in odd_names[:25]:
        print(f"    {f}: {n!r}")

    print(f"\npersonnes distinctes : {len(names)}")
    print("les plus frequentes :")
    for n, k in names.most_common(15):
        print(f"    {k:3d}  {n}")


if __name__ == "__main__":
    main()
