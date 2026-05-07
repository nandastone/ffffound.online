"""
URL-only diff: which ffffound URLs are present in the Apr 27 ArchiveBot capture
that the May 7 master capture (the one we ingested) does not have?

Output: TSV files of URLs unique to Apr 27, bucketed by URL pattern.
        Plus a summary stats table printed to stdout.

Usage:
    python -m parser.diff_apr27
"""

from __future__ import annotations

import gzip
import re
from collections import Counter
from pathlib import Path

APR27_CDX = Path("F:/Bittorrent/Other/falconk_archivebot_ffffound_com_20170427/falconk_archivebot_ffffound_com_20170427.cdx.gz")
MAY07_CDX = Path("F:/Bittorrent/Other/ffffound.com-warc-archive-2017-05-07/ffffound.com-warc-archive-2017-05-07.cdx.gz")
OUT_DIR   = Path("F:/ffffound/out/diff_apr27")

# SURT-form prefixes (CDX urlkey column 0).
PREFIX_FFFFOUND   = "com,ffffound)/"
PREFIX_IMG_M      = "com,ffffound,img)/static-data/"
PREFIX_IMG_THUMB  = "com,ffffound,img-thumb)/static-data/"

RE_IMAGE_PAGE = re.compile(r"^com,ffffound\)/image/([0-9a-f]{40})(?:[?/].*)?$", re.I)
RE_USER_PAGE  = re.compile(r"^com,ffffound\)/home/([^/?]+)", re.I)


def bucket(urlkey: str) -> str | None:
    """Return bucket name or None to skip."""
    if urlkey.startswith(PREFIX_IMG_M):
        return "image_bytes_m"
    if urlkey.startswith(PREFIX_IMG_THUMB):
        return "image_bytes_thumb"
    if urlkey.startswith(PREFIX_FFFFOUND):
        if RE_IMAGE_PAGE.match(urlkey):
            return "image_page"
        if RE_USER_PAGE.match(urlkey):
            return "user_page"
        return "ffffound_other"
    return None


def iter_cdx(path: Path):
    """Yield (urlkey, original_url, mimetype, status, digest, warc_filename) per 200-status record."""
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith(" CDX"):
                continue
            parts = line.rstrip("\n").split(" ")
            if len(parts) < 11:
                continue
            urlkey, ts, original, mime, status, digest, redir, meta, size, offset, fname = parts[:11]
            if status != "200":
                continue
            yield urlkey, original, mime, digest, fname


def build_may07_index() -> dict[str, set[str]]:
    """Bucket -> set of urlkeys present in May 7 capture (status 200)."""
    print("[1/2] Reading May 7 CDX...", flush=True)
    idx: dict[str, set[str]] = {
        "image_bytes_m": set(),
        "image_bytes_thumb": set(),
        "image_page": set(),
        "user_page": set(),
        "ffffound_other": set(),
    }
    n = 0
    for urlkey, *_ in iter_cdx(MAY07_CDX):
        b = bucket(urlkey)
        if b is None:
            continue
        idx[b].add(urlkey)
        n += 1
        if n % 500_000 == 0:
            print(f"    ...{n:,} ffffound records", flush=True)
    print(f"    May 7 ffffound URL counts: " +
          ", ".join(f"{k}={len(v):,}" for k, v in idx.items()), flush=True)
    return idx


def diff_against_apr27(may07: dict[str, set[str]]):
    print("[2/2] Streaming Apr 27 CDX, finding uniques...", flush=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    files = {b: open(OUT_DIR / f"unique_{b}.tsv", "w", encoding="utf-8", newline="\n")
             for b in may07.keys()}
    for b, fh in files.items():
        fh.write("urlkey\toriginal_url\tmimetype\tdigest\twarc_filename\n")

    apr_total = Counter()
    apr_unique = Counter()
    seen_apr_urlkey: dict[str, set[str]] = {b: set() for b in may07.keys()}

    n = 0
    for urlkey, original, mime, digest, fname in iter_cdx(APR27_CDX):
        b = bucket(urlkey)
        if b is None:
            continue
        apr_total[b] += 1
        # Dedupe within Apr 27 itself (multiple snapshots of same URL).
        if urlkey in seen_apr_urlkey[b]:
            continue
        seen_apr_urlkey[b].add(urlkey)
        if urlkey in may07[b]:
            continue
        apr_unique[b] += 1
        files[b].write(f"{urlkey}\t{original}\t{mime}\t{digest}\t{fname}\n")
        n += 1
        if n % 100_000 == 0:
            print(f"    ...{n:,} unique-to-Apr27 emitted", flush=True)

    for fh in files.values():
        fh.close()

    print()
    print("Summary (status 200, ffffound only):")
    print(f"  {'bucket':<22} {'May 7':>10} {'Apr 27 uniq URLs':>18} {'Apr 27 unique':>15}")
    for b in ["image_bytes_m", "image_bytes_thumb", "image_page", "user_page", "ffffound_other"]:
        may_n = len(may07[b])
        apr_uniq_url = len(seen_apr_urlkey[b])
        apr_uniq_v_may = apr_unique[b]
        print(f"  {b:<22} {may_n:>10,} {apr_uniq_url:>18,} {apr_uniq_v_may:>15,}")
    print()
    print(f"Output: {OUT_DIR}")


def main():
    may07 = build_may07_index()
    diff_against_apr27(may07)


if __name__ == "__main__":
    main()
