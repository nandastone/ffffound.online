"""
Build a side-by-side comparison page: my recreation vs. an actual ffffound HTML
captured in the WARC, re-rendered with its original CSS/JS.

Outputs to ./out/comparison/, intended to be served by a static HTTP server
(e.g. `python -m http.server 8788 --directory out/comparison`).

Usage:
    python -m parser.build_comparison <warc> --image-id <sha1> [--out ./out/comparison]
"""

from __future__ import annotations
import argparse, re, shutil
from pathlib import Path
from warcio.archiveiterator import ArchiveIterator


STATIC_REWRITE = re.compile(r"https?://static\.ffffound\.com/", re.I)
IMG_REWRITE_MED = re.compile(r"https?://img\.ffffound\.com/static-data/assets/[0-9a-f]/([0-9a-f]{40})_m\.(jpe?g|png|gif|webp)", re.I)
IMG_REWRITE_SM  = re.compile(r"https?://img-thumb\.ffffound\.com/static-data/assets/[0-9a-f]/([0-9a-f]{40})_(s|xs)\.(jpe?g|png|gif|webp)", re.I)


def rewrite(html: bytes) -> bytes:
    s = html.decode("utf-8", errors="replace")
    s = STATIC_REWRITE.sub("/static/", s)
    # Image URLs — point them at the wrangler dev server (cross-origin OK locally).
    # Fall back path: /missing.svg if the image isn't in our local R2.
    s = IMG_REWRITE_MED.sub(r"http://localhost:8787/cdn/\1_m.\2", s)
    s = IMG_REWRITE_SM.sub(r"http://localhost:8787/cdn/\1_\2.\3", s)
    return s.encode("utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("warc", type=Path)
    ap.add_argument("--image-id", required=True)
    ap.add_argument("--out", type=Path, default=Path("out/comparison"))
    ap.add_argument("--static-src", type=Path, default=Path("out/static"))
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    # Copy the original static assets in place.
    if (args.out / "static").exists():
        shutil.rmtree(args.out / "static")
    shutil.copytree(args.static_src, args.out / "static")
    print(f"copied static assets -> {args.out / 'static'}")

    # Find the captured HTML for the requested image_id.
    target_url_part = f"/image/{args.image_id}"
    found = None
    print(f"scanning {args.warc.name} for {target_url_part}...")
    with args.warc.open("rb") as fh:
        for rec in ArchiveIterator(fh):
            if rec.rec_type != "response":
                continue
            url = rec.rec_headers.get_header("WARC-Target-URI") or ""
            if target_url_part not in url:
                continue
            body = rec.content_stream().read()
            if len(body) < 5000:  # skip stub/404
                continue
            found = (url, body)
            break

    if not found:
        print(f"NOT FOUND: no real /image/{args.image_id} page in {args.warc}", flush=True)
        return 1

    url, body = found
    rewritten = rewrite(body)
    out_html = args.out / f"original-{args.image_id[:8]}.html"
    out_html.write_bytes(rewritten)
    print(f"wrote {out_html}  ({len(rewritten)} bytes)  source URL: {url}")

    # Tiny index.
    (args.out / "index.html").write_text(f"""<!doctype html>
<html><head><title>ffffound recreation comparison</title>
<style>body{{font:14px sans-serif;margin:20px;max-width:900px}}
.col{{display:inline-block;vertical-align:top;width:48%;margin-right:1%}}
iframe{{width:100%;height:80vh;border:1px solid #ccc}}</style></head>
<body>
<h1>ffffound — original vs. recreation</h1>
<p>image: <code>{args.image_id}</code></p>
<div class="col">
  <h3>captured original (with original CSS/JS)</h3>
  <iframe src="original-{args.image_id[:8]}.html"></iframe>
</div>
<div class="col">
  <h3>our recreation</h3>
  <iframe src="http://localhost:8787/image/{args.image_id}"></iframe>
</div>
</body></html>""", encoding="utf-8")
    print(f"wrote {args.out / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
