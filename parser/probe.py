"""
Phase 0 probe: classify URLs in a WARC and dump small samples of each page type
to disk so we can write real CSS selectors.

Usage:
    python -m parser.probe <warc.gz> [--limit 50000] [--out ./out/probe]
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

from warcio.archiveiterator import ArchiveIterator


SAMPLE_TARGETS = {
    "image_page": 5,
    "user_page": 5,
    "tag_page": 5,
    "image_bytes": 3,   # tiny: just confirm content-type/host
    "other": 5,
}

# Loose patterns — we'll see what actually shows up.
RE_IMAGE = re.compile(r"^https?://(?:www\.)?ffffound\.com/image/([0-9]+)", re.I)
RE_USER  = re.compile(r"^https?://(?:www\.)?ffffound\.com/home/([^/?#]+)", re.I)
RE_TAG   = re.compile(r"^https?://(?:www\.)?ffffound\.com/tagged/([^/?#]+)", re.I)


def classify(url: str, content_type: str) -> str:
    if RE_IMAGE.match(url):  return "image_page"
    if RE_USER.match(url):   return "user_page"
    if RE_TAG.match(url):    return "tag_page"
    if "image" in (content_type or "").lower(): return "image_bytes"
    return "other"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("warc", type=Path)
    ap.add_argument("--limit", type=int, default=50000)
    ap.add_argument("--out", type=Path, default=Path("out/probe"))
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    label_counts: Counter[str] = Counter()
    host_counts: Counter[str] = Counter()
    image_host_counts: Counter[str] = Counter()
    samples: dict[str, list[str]] = {k: [] for k in SAMPLE_TARGETS}
    saved: dict[str, int] = {k: 0 for k in SAMPLE_TARGETS}

    with args.warc.open("rb") as fh:
        for i, rec in enumerate(ArchiveIterator(fh)):
            if i >= args.limit:
                break
            if rec.rec_type != "response":
                continue
            url = rec.rec_headers.get_header("WARC-Target-URI") or ""
            ct = rec.http_headers.get_header("Content-Type") if rec.http_headers else ""
            label = classify(url, ct)
            label_counts[label] += 1

            host = urlparse(url).hostname or ""
            host_counts[host] += 1
            if label == "image_bytes":
                image_host_counts[host] += 1

            if saved[label] < SAMPLE_TARGETS[label]:
                if label == "image_bytes":
                    # Just record the URL+CT — we don't need the bytes for the spike.
                    samples[label].append(f"{ct}\t{url}")
                else:
                    body = rec.content_stream().read()
                    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", url)[-120:] or "root"
                    out_file = args.out / f"{label}_{saved[label]:02d}_{safe}.html"
                    out_file.write_bytes(body)
                    samples[label].append(str(out_file))
                saved[label] += 1

    print(f"\nScanned {sum(label_counts.values())} response records (limit {args.limit})\n", file=sys.stderr)
    print("Counts by label:")
    for label, n in label_counts.most_common():
        print(f"  {label:14s} {n:7d}")

    print("\nTop hosts:")
    for host, n in host_counts.most_common(10):
        print(f"  {host:40s} {n:7d}")

    print("\nImage-bytes hosts:")
    for host, n in image_host_counts.most_common(10):
        print(f"  {host:40s} {n:7d}")

    print("\nSamples written:")
    for label, paths in samples.items():
        print(f"\n  [{label}]")
        for p in paths:
            print(f"    {p}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
