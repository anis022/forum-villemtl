"""
Stage 0 of council ingestion: the borough's own paperwork.

The arrondissement publishes, for every sitting, an *ordre du jour* and a
*proces-verbal* as PDF. The proces-verbal is the authoritative record: it names
every resident who addressed the council and the subject they raised, it
numbers every resolution, and it does so in the order things actually happened.

That matters more than it sounds. Asking "how many people complained about this
sidewalk" over a Whisper transcript alone means trusting a model to recognise
that two mangled names are two different residents. Asking it over this record
means counting rows in a table the borough itself published. The transcript is
then only needed for what was *said* and *when* -- never for who or how many.

The archive goes back to at least 2015 and is navigated by a plain query
parameter, so the whole thing is crawlable without a session or a key.

    python scripts/py/crawl_docs.py            # 2015 -> current year
    python scripts/py/crawl_docs.py --from 2020
    python scripts/py/crawl_docs.py --list     # show what exists, download nothing

Downloads are skipped when the file is already on disk, so re-running costs a
dozen HTML fetches and nothing else.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import date
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "docs"

PORTAL = (
    "https://ville.montreal.qc.ca/portal/page"
    "?_pageid=7497,81055570&_dad=portal&_schema=PORTAL"
)
PDF_BASE = "https://ville.montreal.qc.ca"

# The archive reaches back to 2015, but the corpus is deliberately scoped to
# the current year: those are the sittings with recordings we transcribe, so
# they are the only ones an answer can cite to the second. Earlier years also
# use two older, messier layouts for the question period, and carrying parsers
# for records nothing links to buys nothing. Pass --from to reach further back.
FIRST_YEAR = 2026

# A courteous pause between requests to a municipal server that owes us nothing.
PAUSE_S = 1.0

UA = "Mozilla/5.0 (compatible; cdnndg-forum/1.0; +https://cdnndg.vercel.app)"

# Each sitting is wrapped in a div whose id is its own primary key:
# id="2026-07-0618:30ordinaire_o" -> date, time, kind. Far steadier than trying
# to read the French date rendered beside it ("1er juin", "6&nbsp;juillet").
MEETING_RE = re.compile(
    r'<div\s+id="(\d{4}-\d{2}-\d{2})(\d{2}:\d{2})([a-zA-Zé\-]*?)_o"',
    re.I,
)

DOC_RE = re.compile(
    r'href="(/sel/adi-public/afficherpdf/fichier\.pdf\?typeDoc=(\w+)&(?:amp;)?doc=(\d+))"'
    r"[^>]*>(.*?)</a>",
    re.I | re.S,
)

# "Ordre du jour et documents décisionnels" is the agenda with every supporting
# file inline -- often 80 MB of scanned annexes. The plain "Ordre du jour" says
# the same thing about what was on the table in 90 kB, which is what we index.
BULKY = "documents"


def fetch(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=60) as r:
        return r.read()


def strip_tags(s: str) -> str:
    return unescape(re.sub(r"<[^>]+>", "", s)).replace("\xa0", " ").strip()


def parse_year(html: str, year: int) -> list[dict]:
    """Split one year page into sittings, each carrying its document links."""
    marks = list(MEETING_RE.finditer(html))
    meetings: list[dict] = []

    for i, m in enumerate(marks):
        # Everything up to the next sitting belongs to this one.
        end = marks[i + 1].start() if i + 1 < len(marks) else len(html)
        chunk = html[m.end() : end]

        docs = []
        for d in DOC_RE.finditer(chunk):
            href, kind, doc_id, label = d.group(1), d.group(2), d.group(3), strip_tags(d.group(4))
            docs.append(
                {
                    "type": kind.lower(),  # 'odj' | 'pv'
                    "docId": doc_id,
                    "label": label,
                    "url": PDF_BASE + href.replace("&amp;", "&"),
                    # The agenda ships in two forms; keep the light one for text.
                    "bulky": BULKY in label.lower(),
                }
            )

        if not docs:
            continue

        meetings.append(
            {
                "date": m.group(1),
                "time": m.group(2),
                "kind": strip_tags(m.group(3)) or "ordinaire",
                "year": year,
                "docs": docs,
            }
        )

    return meetings


def crawl(first: int, last: int) -> list[dict]:
    all_meetings: list[dict] = []
    for year in range(first, last + 1):
        url = f"{PORTAL}&dateDebut={year}"
        try:
            html = fetch(url).decode("cp1252", errors="replace")
        except Exception as e:  # noqa: BLE001 - a bad year should not sink the crawl
            print(f"  {year}: echec ({e})", file=sys.stderr)
            continue

        found = parse_year(html, year)
        pv = sum(1 for m in found for d in m["docs"] if d["type"] == "pv")
        print(f"  {year}: {len(found)} seances, {pv} proces-verbaux")
        all_meetings.extend(found)
        time.sleep(PAUSE_S)

    # Newest first, matching how the site itself reads.
    all_meetings.sort(key=lambda m: m["date"], reverse=True)
    return all_meetings


def download(meetings: list[dict]) -> tuple[int, int]:
    """Pull every non-bulky PDF we do not already hold."""
    DATA.mkdir(parents=True, exist_ok=True)
    got = skipped = 0

    for m in meetings:
        for d in m["docs"]:
            if d["bulky"]:
                continue
            path = DATA / f"{d['type']}-{d['docId']}.pdf"
            d["file"] = str(path.relative_to(ROOT)).replace("\\", "/")

            if path.exists() and path.stat().st_size > 0:
                skipped += 1
                continue

            try:
                blob = fetch(d["url"])
            except Exception as e:  # noqa: BLE001
                print(f"  echec {d['type']}-{d['docId']}: {e}", file=sys.stderr)
                continue

            if not blob.startswith(b"%PDF"):
                print(f"  pas un PDF: {d['type']}-{d['docId']}", file=sys.stderr)
                continue

            path.write_bytes(blob)
            got += 1
            print(f"  + {m['date']} {d['type']}-{d['docId']} ({len(blob) // 1024} ko)")
            time.sleep(PAUSE_S)

    return got, skipped


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="first", type=int, default=FIRST_YEAR)
    ap.add_argument("--to", dest="last", type=int, default=date.today().year)
    ap.add_argument("--list", action="store_true", help="inventaire seulement")
    args = ap.parse_args()

    print(f"portail CDN-NDG, {args.first} a {args.last}")
    meetings = crawl(args.first, args.last)

    pv_total = sum(1 for m in meetings for d in m["docs"] if d["type"] == "pv")
    print(f"\n{len(meetings)} seances, {pv_total} proces-verbaux")

    if args.list:
        return

    print("\ntelechargement…")
    got, skipped = download(meetings)
    print(f"\n{got} nouveaux, {skipped} deja presents")

    DATA.mkdir(parents=True, exist_ok=True)
    index = DATA / "index.json"
    index.write_text(
        json.dumps(meetings, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"index: {index.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
