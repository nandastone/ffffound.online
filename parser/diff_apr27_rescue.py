"""
Digest-level diff: find ffffound URLs captured in BOTH archives, where the May
7 capture got a stub/404 and the Apr 27 capture got the real page.

Refinements over the naive version:
  1. Stub digests are identified across BOTH archives combined. ffffound's
     maintenance HTML had multiple variants; counting only May 7 misses the
     Apr 27 stub digests and misclassifies stub-vs-stub as "neither stub".
  2. image_page urlkeys are canonicalized: '/image/<sha1>?c=<saveid>' is
     normalized to '/image/<sha1>'. The query variant carries the same page
     content (just highlights a different save) and only May 7's crawler
     captured those variants.
  3. user_page urlkeys are NOT canonicalized — pagination offsets are real
     content boundaries.
  4. Best capture per (canonical_key, archive) is picked: prefer status 200,
     prefer larger size, prefer non-stub digest.

Usage:
    python -m parser.diff_apr27_rescue
"""

from __future__ import annotations

import gzip
import re
from collections import Counter
from pathlib import Path

APR27_CDX = Path("F:/Bittorrent/Other/falconk_archivebot_ffffound_com_20170427/falconk_archivebot_ffffound_com_20170427.cdx.gz")
MAY07_CDX = Path("F:/Bittorrent/Other/ffffound.com-warc-archive-2017-05-07/ffffound.com-warc-archive-2017-05-07.cdx.gz")
OUT_DIR   = Path("F:/ffffound/out/diff_apr27")

PREFIX_FFFFOUND = "com,ffffound)/"
RE_IMAGE_PAGE = re.compile(r"^com,ffffound\)/image/([0-9a-f]{40})(?:[?].*)?$", re.I)
RE_USER_PAGE  = re.compile(r"^com,ffffound\)/home/([^/?]+)", re.I)

# A digest hit by this many distinct canonical keys is treated as a stub
# fingerprint. Real ffffound page digests are essentially unique; flapping
# responses repeat thousands of times.
STUB_THRESHOLD = 50


def classify(urlkey: str) -> tuple[str, str] | None:
    """Return (bucket, canonical_key) or None to skip.
    For image_page, canonical_key strips '?c=...' to dedupe save-context variants.
    """
    if not urlkey.startswith(PREFIX_FFFFOUND):
        return None
    m = RE_IMAGE_PAGE.match(urlkey)
    if m:
        sha1 = m.group(1).lower()
        return ("image_page", f"com,ffffound)/image/{sha1}")
    if RE_USER_PAGE.match(urlkey):
        return ("user_page", urlkey)
    return None


def iter_cdx(path: Path):
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith(" CDX"):
                continue
            parts = line.rstrip("\n").split(" ")
            if len(parts) < 11:
                continue
            urlkey, ts, original, mime, status, digest, redir, meta, size, offset, fname = parts[:11]
            yield urlkey, original, mime, status, digest, size, fname


def best(prev, candidate, stubs: set[str] | None):
    """Return the better of (digest, status, size, original, fname).
    Preference: status 200 > non-200; non-stub > stub; larger > smaller.
    `stubs` may be None during the first pass (when we don't know stubs yet),
    in which case we just go by status + size.
    """
    if prev is None:
        return candidate
    pd, ps, pz, _, _ = prev
    cd, cs, cz, _, _ = candidate
    p200, c200 = ps == "200", cs == "200"
    if p200 != c200:
        return candidate if c200 and not p200 else prev
    if stubs is not None:
        p_stub, c_stub = pd in stubs, cd in stubs
        if p_stub != c_stub:
            return candidate if p_stub and not c_stub else prev
    return candidate if cz > pz else prev


def collect(path: Path, stubs: set[str] | None):
    """Pass 1 (stubs=None): build canonical_key -> best capture.
    Pass 2 (stubs=set): same, but with stub-aware preference.
    Returns: {bucket: {canonical_key: (digest, status, size_int, original, fname)}}.
    """
    out = {"image_page": {}, "user_page": {}}
    n = 0
    for urlkey, original, _mime, status, digest, size, fname in iter_cdx(path):
        c = classify(urlkey)
        if c is None:
            continue
        bucket, canon = c
        size_i = int(size) if size.isdigit() else 0
        cand = (digest, status, size_i, original, fname)
        out[bucket][canon] = best(out[bucket].get(canon), cand, stubs)
        n += 1
        if n % 500_000 == 0:
            print(f"    ...{n:,} ffffound HTML records ({path.name})", flush=True)
    return out


def find_stub_digests(may07, apr27, label: str) -> set[str]:
    """Digests appearing on >= STUB_THRESHOLD distinct canonical keys, across both archives."""
    keys = Counter()
    for d, *_ in may07.values():
        keys[d] += 1
    for d, *_ in apr27.values():
        keys[d] += 1
    stubs = {d for d, c in keys.items() if c >= STUB_THRESHOLD}
    print(f"  [{label}] stub digests (combined count >= {STUB_THRESHOLD}): {len(stubs)}")
    for d, c in keys.most_common(10):
        marker = " <-- stub" if d in stubs else ""
        print(f"    {d}  {c:>10,}{marker}")
    return stubs


def diff_buckets(may07_all, apr27_all, stubs_by_bucket):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    counts = {b: Counter() for b in may07_all}

    for bucket in may07_all:
        may = may07_all[bucket]
        apr = apr27_all[bucket]
        stubs = stubs_by_bucket[bucket]

        rescue_path = OUT_DIR / f"rescue_{bucket}.tsv"
        recoverable_path = OUT_DIR / f"recoverable_{bucket}.tsv"
        with open(rescue_path, "w", encoding="utf-8", newline="\n") as rfh, \
             open(recoverable_path, "w", encoding="utf-8", newline="\n") as cfh:
            rfh.write("canonical_key\toriginal_url\tmay7_status\tmay7_digest\tmay7_size\t"
                      "apr27_status\tapr27_digest\tapr27_size\twarc_filename\n")
            cfh.write("reason\tcanonical_key\toriginal_url\tapr27_status\tapr27_digest\t"
                      "apr27_size\twarc_filename\n")

            def emit_recoverable(reason, canon, apr_d, apr_s, apr_z, apr_orig, apr_fname):
                if apr_d in stubs:
                    return False  # Apr 27 also got a stub — useless even if May 7 didn't
                cfh.write(f"{reason}\t{canon}\t{apr_orig}\t{apr_s}\t{apr_d}\t{apr_z}\t{apr_fname}\n")
                return True

            for canon, (apr_d, apr_s, apr_z, apr_orig, apr_fname) in apr.items():
                if canon not in may:
                    counts[bucket]["only_in_apr27"] += 1
                    if emit_recoverable("missing_in_may7", canon, apr_d, apr_s, apr_z, apr_orig, apr_fname):
                        counts[bucket]["recoverable"] += 1
                    continue
                may_d, may_s, may_z, _may_orig, _may_fname = may[canon]
                counts[bucket]["both_seen"] += 1
                if apr_d == may_d:
                    counts[bucket]["same_digest"] += 1
                    continue
                may_stub = may_d in stubs
                apr_stub = apr_d in stubs
                if may_stub and not apr_stub:
                    counts[bucket]["rescue_may7_stub"] += 1
                    rfh.write(f"{canon}\t{apr_orig}\t{may_s}\t{may_d}\t{may_z}\t"
                              f"{apr_s}\t{apr_d}\t{apr_z}\t{apr_fname}\n")
                    if emit_recoverable("may7_stub", canon, apr_d, apr_s, apr_z, apr_orig, apr_fname):
                        counts[bucket]["recoverable"] += 1
                elif may_stub and apr_stub:
                    counts[bucket]["both_stub"] += 1
                elif apr_stub and not may_stub:
                    counts[bucket]["apr27_stub_may7_real"] += 1
                else:
                    counts[bucket]["differ_neither_stub"] += 1

        # Also note: URLs in May 7 not in Apr 27 (informational)
        for canon in may:
            if canon not in apr:
                counts[bucket]["only_in_may7"] += 1

    return counts


def main():
    print("[1/3] Pass 1: collect best-per-canonical-key from both CDXes (stub-blind)...")
    print("  May 7:")
    may07_blind = collect(MAY07_CDX, stubs=None)
    print("  Apr 27:")
    apr27_blind = collect(APR27_CDX, stubs=None)

    print()
    print("[2/3] Identify stub digests from combined frequencies...")
    stubs_by_bucket = {
        b: find_stub_digests(may07_blind[b], apr27_blind[b], b) for b in may07_blind
    }

    print()
    print("[3/3] Pass 2: re-collect with stub-aware preference, then diff...")
    print("  May 7:")
    may07 = collect(MAY07_CDX, stubs=stubs_by_bucket["image_page"] | stubs_by_bucket["user_page"])
    print("  Apr 27:")
    apr27 = collect(APR27_CDX, stubs=stubs_by_bucket["image_page"] | stubs_by_bucket["user_page"])

    counts = diff_buckets(may07, apr27, stubs_by_bucket)

    print()
    print("Digest-level diff (canonical, stub-aware):")
    for b, c in counts.items():
        total_canon_may07 = len(may07[b])
        total_canon_apr27 = len(apr27[b])
        print(f"  [{b}]  may07={total_canon_may07:,}  apr27={total_canon_apr27:,}")
        for k in ["both_seen", "same_digest", "rescue_may7_stub",
                  "both_stub", "apr27_stub_may7_real", "differ_neither_stub",
                  "only_in_apr27", "only_in_may7", "recoverable"]:
            print(f"    {k:<25} {c[k]:>10,}")
    print()
    print(f"Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
