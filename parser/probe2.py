"""
Phase 0 probe v2: scan a WARC for ANY non-maintenance HTML response, plus
verify image_bytes records are real images (decode size, content-length).

Usage:
    python -m parser.probe2 <warc.gz> [--limit 200000]
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

from warcio.archiveiterator import ArchiveIterator


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("warc", type=Path)
    ap.add_argument("--limit", type=int, default=200000)
    args = ap.parse_args()

    sizes = Counter()                 # html_size_bucket -> count
    titles = Counter()                # first 60 chars of <title> -> count
    real_html_examples: list[tuple[int, str]] = []
    image_bytes_total = 0
    image_bytes_size = 0
    sample_image_urls: list[tuple[str, int]] = []

    seen = 0
    with args.warc.open("rb") as fh:
        for i, rec in enumerate(ArchiveIterator(fh)):
            if i >= args.limit:
                break
            if rec.rec_type != "response":
                continue
            seen += 1

            ct = (rec.http_headers.get_header("Content-Type") if rec.http_headers else "") or ""
            url = rec.rec_headers.get_header("WARC-Target-URI") or ""

            if "image" in ct.lower() and "html" not in ct.lower():
                # Image bytes — check size from Content-Length header without reading body.
                cl = (rec.http_headers.get_header("Content-Length") if rec.http_headers else "") or "0"
                try:
                    n = int(cl)
                except ValueError:
                    n = 0
                image_bytes_total += 1
                image_bytes_size += n
                if len(sample_image_urls) < 5:
                    sample_image_urls.append((url, n))
                continue

            if "html" in ct.lower():
                body = rec.content_stream().read()
                size = len(body)
                # Bucket: <500, 500-1000, 1000-2000, 2000-5000, 5000+
                if   size < 500:    bucket = "<500"
                elif size < 1000:   bucket = "500-1000"
                elif size < 2000:   bucket = "1000-2000"
                elif size < 5000:   bucket = "2000-5000"
                else:               bucket = "5000+"
                sizes[bucket] += 1

                # Crude title extract.
                head = body[:1500].decode("utf-8", errors="replace")
                tstart = head.lower().find("<title>")
                if tstart >= 0:
                    tend = head.lower().find("</title>", tstart)
                    title = head[tstart + 7 : tend].strip() if tend > 0 else "?"
                else:
                    title = "(no title)"
                titles[title[:80]] += 1

                # Anything substantial (>2KB) is potentially real content.
                if size >= 2000 and len(real_html_examples) < 10:
                    real_html_examples.append((size, url))

    print(f"Scanned {seen} response records (limit {args.limit})\n")

    print("HTML size distribution:")
    for bucket, n in sizes.most_common():
        print(f"  {bucket:12s} {n:8d}")

    print("\nTop HTML titles (first 80 chars):")
    for title, n in titles.most_common(15):
        print(f"  {n:7d}  {title!r}")

    print(f"\nImage bytes:")
    print(f"  count: {image_bytes_total}")
    print(f"  total bytes (Content-Length sum): {image_bytes_size:,}")
    if image_bytes_total:
        print(f"  avg: {image_bytes_size // image_bytes_total:,} bytes")

    print("\nSample image URLs:")
    for u, n in sample_image_urls:
        print(f"  {n:9d}  {u}")

    print(f"\nReal HTML examples (>=2000 bytes): {len(real_html_examples)}")
    for size, url in real_html_examples:
        print(f"  {size:7d}  {url}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
