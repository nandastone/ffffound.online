"""
Handler for image binary responses on the ffffound CDN hosts.

We store bytes on local disk under <images_dir>/<sha256-prefix>/<sha256>.<ext>
and stash the URL→key mapping for a later "stitch" pass that links bytes to
image_id rows. (We can't always link directly here because image_page records
may not have been seen yet; the WARC interleaves them.)

The R2 upload step is a separate pass once the local extraction is validated.
"""

from __future__ import annotations

import hashlib
import os
import sqlite3
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def _ensure_url_map_table(db: sqlite3.Connection) -> None:
    db.execute(
        """CREATE TABLE IF NOT EXISTS image_url_map (
              cdn_url   TEXT PRIMARY KEY,
              local_key TEXT NOT NULL,
              bytes     INTEGER,
              ext       TEXT
            )"""
    )


def handle(ctx, *, url: str, content_type: str, record: Any) -> None:
    _ensure_url_map_table(ctx.db)

    body = record.content_stream().read()
    if not body:
        return

    digest = hashlib.sha256(body).hexdigest()
    ext = _ext_from(url, content_type)
    rel_dir = digest[:2]
    rel_path = f"{rel_dir}/{digest}{ext}"
    out = ctx.images_dir / rel_path
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        # Atomic write so an interrupted run doesn't leave partial files.
        tmp = out.with_suffix(out.suffix + ".tmp")
        tmp.write_bytes(body)
        os.replace(tmp, out)

    ctx.db.execute(
        """INSERT INTO image_url_map (cdn_url, local_key, bytes, ext) VALUES (?, ?, ?, ?)
           ON CONFLICT(cdn_url) DO UPDATE SET
             local_key = excluded.local_key,
             bytes     = excluded.bytes""",
        (url, rel_path, len(body), ext),
    )


def _ext_from(url: str, content_type: str) -> str:
    path = urlparse(url).path.lower()
    for e in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        if path.endswith(e):
            return e
    if "png" in content_type:  return ".png"
    if "gif" in content_type:  return ".gif"
    if "webp" in content_type: return ".webp"
    return ".jpg"
