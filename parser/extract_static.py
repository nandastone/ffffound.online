"""
Pull static.ffffound.com assets (CSS, JS, image-asset GIFs) out of the WARCs
into a local dir so we can render actual captured ffffound pages with their
original look. One-shot tool; no DB.

Usage:
    python -m parser.extract_static <warc>... --out ./out/static
"""

from __future__ import annotations
import argparse, hashlib, re, sys
from pathlib import Path
from urllib.parse import urlparse
from warcio.archiveiterator import ArchiveIterator

RE_STATIC = re.compile(r"^https?://static\.ffffound\.com/(.+)$", re.I)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("warcs", nargs="+", type=Path)
    ap.add_argument("--out", type=Path, default=Path("out/static"))
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    saved: int = 0

    for warc in args.warcs:
        print(f"  scanning {warc.name}...", file=sys.stderr)
        with warc.open("rb") as fh:
            for rec in ArchiveIterator(fh):
                if rec.rec_type != "response":
                    continue
                url = rec.rec_headers.get_header("WARC-Target-URI") or ""
                m = RE_STATIC.match(url)
                if not m:
                    continue
                rel = m.group(1).split("?")[0]
                if rel in seen:
                    continue
                seen.add(rel)
                body = rec.content_stream().read()
                if not body:
                    continue
                out = args.out / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(body)
                saved += 1
                if saved % 25 == 0:
                    print(f"    saved {saved}", file=sys.stderr)

    print(f"\nSaved {saved} unique static assets to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
