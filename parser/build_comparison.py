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

    # Full-width 50/50 split for side-by-side review.
    (args.out / "index.html").write_text(f"""<!doctype html>
<html><head><title>ffffound recreation comparison</title>
<style>
  *{{box-sizing:border-box}}
  html,body{{height:100%;margin:0}}
  body{{font:13px -apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column}}
  header{{padding:8px 16px;border-bottom:1px solid #ddd;flex:0 0 auto}}
  header h1{{margin:0;font-size:14px;font-weight:600}}
  header code{{font-size:12px;opacity:0.7}}
  .panes{{flex:1 1 auto;display:flex}}
  .pane{{flex:1 1 50%;display:flex;flex-direction:column;min-width:0}}
  .pane:first-child{{border-right:1px solid #ddd}}
  .pane h3{{margin:0;padding:6px 12px;font-size:12px;text-transform:uppercase;opacity:0.6;letter-spacing:0.05em;border-bottom:1px solid #eee}}
  .pane iframe{{flex:1 1 auto;width:100%;border:0;display:block}}
</style></head>
<body>
<header>
  <h1>ffffound — captured original (May 2017) vs. our recreation &nbsp;<code>{args.image_id}</code></h1>
</header>
<div class="panes">
  <div class="pane">
    <h3>captured original (WARC + original CSS/JS)</h3>
    <iframe src="original-{args.image_id[:8]}.html"></iframe>
  </div>
  <div class="pane">
    <h3>our recreation</h3>
    <iframe src="http://localhost:8787/image/{args.image_id}"></iframe>
  </div>
</div>
</body></html>""", encoding="utf-8")
    print(f"wrote {args.out / 'index.html'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
