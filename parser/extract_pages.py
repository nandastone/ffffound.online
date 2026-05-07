"""
Pull a small set of static ffffound pages out of the May 7 WARCs as raw HTML,
so we can re-serve them through our own chrome.

Usage:
    python -m parser.extract_pages
"""

from __future__ import annotations

import re
from pathlib import Path

from warcio.archiveiterator import ArchiveIterator

SRC_WARCS = sorted(Path("F:/Bittorrent/Other/ffffound.com-warc-archive-2017-05-07").glob("ffffound.com-2017-05-07-*.warc.gz"))
OUT_DIR = Path("F:/ffffound/parser/fixtures/static_pages")

WANTED = {
    "/log/":   "log.html",
}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    found: dict[str, bytes] = {}

    for warc in SRC_WARCS:
        if all(p in found for p in WANTED):
            break
        print(f"scanning {warc.name}...")
        with warc.open("rb") as fh:
            for record in ArchiveIterator(fh):
                if record.rec_type != "response":
                    continue
                url = record.rec_headers.get_header("WARC-Target-URI") or ""
                m = re.match(r"^https?://ffffound\.com(/[^?#]*)", url)
                if not m:
                    continue
                path = m.group(1)
                if path not in WANTED or path in found:
                    continue
                if record.http_headers and record.http_headers.get_statuscode() != "200":
                    continue
                body = record.content_stream().read()
                if len(body) < 1000:
                    continue
                found[path] = body
                print(f"  found {path} ({len(body)} bytes)")
                if all(p in found for p in WANTED):
                    break

    for path, body in found.items():
        out = OUT_DIR / WANTED[path]
        out.write_bytes(body)
        print(f"  wrote {out}")
    missing = set(WANTED) - set(found)
    if missing:
        print("  MISSING:", missing)


if __name__ == "__main__":
    main()
