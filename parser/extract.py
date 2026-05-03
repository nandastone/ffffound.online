"""
Walk one or more WARC files, classify each response by URL pattern, and dispatch
to the appropriate handler. Handlers write rows into a SQLite DB and image bytes
into a local directory (uploaded to R2 in a later step).

Idempotent: each WARC's progress is tracked in the warc_progress table, so re-runs
pick up where they left off.

Usage:
    python -m parser.extract --db ./out/ffffound.db --images ./out/images <warc>...

The schema in web/migrations/0001_init.sql is the source of truth. We apply it
to a local SQLite DB here and ship it later (sqlite-net or a CSV→D1 import).
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
import time
from pathlib import Path
from typing import Iterable

from tqdm import tqdm
from warcio.archiveiterator import ArchiveIterator

from .dispatch import classify_url, ParserContext
from .handlers import image_page, user_page, image_bytes


# Mapping is in dispatch.classify_url; this dict just routes the classified
# label to a handler module. Adding a new page type = one entry here + one file.
HANDLERS = {
    "image_page":  image_page.handle,
    "user_page":   user_page.handle,
    "image_bytes": image_bytes.handle,
}


def open_db(path: Path) -> sqlite3.Connection:
    db = sqlite3.connect(path)
    db.execute("PRAGMA journal_mode = WAL")
    db.execute("PRAGMA synchronous = NORMAL")
    schema = (Path(__file__).resolve().parent.parent / "web" / "migrations" / "0001_init.sql").read_text()
    db.executescript(schema)
    db.commit()
    return db


def already_done(db: sqlite3.Connection, warc_path: str) -> bool:
    row = db.execute(
        "SELECT finished_at FROM warc_progress WHERE warc_path = ?", (warc_path,)
    ).fetchone()
    return bool(row and row[0])


def mark_done(db: sqlite3.Connection, warc_path: str, records_seen: int) -> None:
    db.execute(
        """INSERT INTO warc_progress (warc_path, last_offset, records_seen, finished_at)
           VALUES (?, 0, ?, ?)
           ON CONFLICT(warc_path) DO UPDATE SET
             records_seen = excluded.records_seen,
             finished_at  = excluded.finished_at""",
        (warc_path, records_seen, int(time.time())),
    )
    db.commit()


def process_warc(warc_path: Path, db: sqlite3.Connection, images_dir: Path) -> None:
    if already_done(db, str(warc_path)):
        print(f"skip (done): {warc_path}", file=sys.stderr)
        return

    ctx = ParserContext(db=db, images_dir=images_dir)
    seen = 0

    with warc_path.open("rb") as fh:
        for record in tqdm(ArchiveIterator(fh), desc=warc_path.name, unit="rec"):
            if record.rec_type != "response":
                continue
            url = record.rec_headers.get_header("WARC-Target-URI") or ""
            content_type = (
                record.http_headers.get_header("Content-Type") if record.http_headers else ""
            ) or ""

            label = classify_url(url, content_type)
            if not label:
                continue

            handler = HANDLERS.get(label)
            if not handler:
                continue

            try:
                handler(ctx, url=url, content_type=content_type, record=record)
                seen += 1
            except Exception as exc:
                # One bad record shouldn't kill a 5GB pass. Log and continue.
                print(f"\n[{label}] {url} → {exc!r}", file=sys.stderr)

            if seen % 5000 == 0:
                db.commit()

    db.commit()
    mark_done(db, str(warc_path), seen)


def main(argv: Iterable[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--db", required=True, type=Path, help="SQLite DB path")
    p.add_argument("--images", required=True, type=Path, help="local image output dir")
    p.add_argument("warcs", nargs="+", type=Path, help="one or more .warc.gz files")
    args = p.parse_args(argv)

    args.images.mkdir(parents=True, exist_ok=True)
    args.db.parent.mkdir(parents=True, exist_ok=True)
    db = open_db(args.db)

    for warc in args.warcs:
        process_warc(warc, db, args.images)

    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
