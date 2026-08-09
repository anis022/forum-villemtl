"""
Fetch the Whisper weights, resumably, into the project.

huggingface_hub's own downloader gave up part-way through the 3 GB model file
and each retry started from zero rather than resuming, which on a home
connection never finishes. This asks for byte ranges instead: an interrupted
transfer picks up where it stopped, so the download survives a dropped
connection, a closed laptop, or a stopped script.

The files land in data/models/ rather than the shared HF cache, so the model
the pipeline uses is visible next to the data it produced and can be deleted
with it.

    python scripts/py/fetch_model.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "data" / "models" / "faster-whisper-large-v3"

REPO = "Systran/faster-whisper-large-v3"
BASE = f"https://huggingface.co/{REPO}/resolve/main"

# Everything ctranslate2 needs to load the model from a directory.
FILES = [
    "config.json",
    "preprocessor_config.json",
    "tokenizer.json",
    "vocabulary.json",
    "model.bin",
]

CHUNK = 1 << 20  # 1 MiB
ATTEMPTS = 40
UA = "cdnndg-forum/1.0"


def remote_size(url: str) -> int | None:
    try:
        req = Request(url, method="HEAD", headers={"User-Agent": UA})
        with urlopen(req, timeout=30) as r:
            length = r.headers.get("Content-Length")
            return int(length) if length else None
    except Exception:  # noqa: BLE001
        return None


def fetch(name: str) -> None:
    url = f"{BASE}/{name}"
    dest = DEST / name
    part = dest.with_suffix(dest.suffix + ".part")
    total = remote_size(url)

    if dest.exists() and (total is None or dest.stat().st_size == total):
        print(f"  {name}: deja complet")
        return

    for attempt in range(1, ATTEMPTS + 1):
        have = part.stat().st_size if part.exists() else 0
        if total is not None and have >= total:
            break

        headers = {"User-Agent": UA}
        if have:
            headers["Range"] = f"bytes={have}-"

        try:
            with urlopen(Request(url, headers=headers), timeout=60) as r:
                # A server that ignores Range answers 200 and would otherwise
                # append the whole file to what we already hold.
                mode = "ab" if (have and r.status == 206) else "wb"
                if mode == "wb":
                    have = 0
                with open(part, mode) as f:
                    started, last = time.time(), have
                    while True:
                        block = r.read(CHUNK)
                        if not block:
                            break
                        f.write(block)
                        have += len(block)
                        if time.time() - started > 2:
                            rate = (have - last) / (time.time() - started) / 1e6
                            pct = f"{100 * have / total:5.1f}%" if total else "  ?  "
                            sys.stdout.write(
                                f"\r  {name}: {pct} {have / 1e6:8.1f} Mo  {rate:5.1f} Mo/s"
                            )
                            sys.stdout.flush()
                            started, last = time.time(), have
        except (HTTPError, URLError, TimeoutError, ConnectionError, OSError) as e:
            got = part.stat().st_size if part.exists() else 0
            print(f"\n  {name}: coupure a {got / 1e6:.1f} Mo ({type(e).__name__}), reprise…")
            time.sleep(min(2 * attempt, 20))
            continue

        if total is None or (part.exists() and part.stat().st_size >= total):
            break

    got = part.stat().st_size if part.exists() else 0
    if total is not None and got < total:
        raise RuntimeError(f"{name}: {got} octets sur {total} apres {ATTEMPTS} tentatives")

    part.replace(dest)
    print(f"\r  {name}: {dest.stat().st_size / 1e6:.1f} Mo" + " " * 30)


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    print(f"{REPO} -> {DEST.relative_to(ROOT)}")
    for name in FILES:
        fetch(name)
    print("\nmodele pret.")


if __name__ == "__main__":
    main()
