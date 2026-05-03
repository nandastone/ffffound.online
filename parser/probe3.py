"""Save N samples of substantive HTML pages by URL category, for selector design."""
from __future__ import annotations
import argparse, re
from pathlib import Path
from warcio.archiveiterator import ArchiveIterator

RE_IMAGE = re.compile(r"^https?://(?:www\.)?ffffound\.com/image/", re.I)
RE_USER  = re.compile(r"^https?://(?:www\.)?ffffound\.com/home/", re.I)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("warc", type=Path)
    ap.add_argument("--out", type=Path, default=Path("out/probe3"))
    ap.add_argument("--per-type", type=int, default=4)
    ap.add_argument("--limit", type=int, default=200000)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    saved = {"image": 0, "user": 0, "tag": 0}
    with args.warc.open("rb") as fh:
        for i, rec in enumerate(ArchiveIterator(fh)):
            if i >= args.limit: break
            if rec.rec_type != "response": continue
            ct = (rec.http_headers.get_header("Content-Type") if rec.http_headers else "") or ""
            if "html" not in ct.lower(): continue
            url = rec.rec_headers.get_header("WARC-Target-URI") or ""
            body = rec.content_stream().read()
            if len(body) < 5000: continue       # skip maintenance + 404
            if   RE_IMAGE.match(url): label = "image"
            elif RE_USER.match(url):  label = "user"
            elif "/tagged/" in url:   label = "tag"
            else: continue
            if saved[label] >= args.per_type: continue
            safe = re.sub(r"[^A-Za-z0-9._-]+", "_", url)[-100:] or "root"
            (args.out / f"REAL_{label}_{saved[label]:02d}_{safe}.html").write_bytes(body)
            saved[label] += 1
            if all(saved[k] >= args.per_type for k in ("image", "user")): break
    for k, v in saved.items(): print(f"{k}: {v}")

if __name__ == "__main__":
    main()
