"""
Summary stats for an extracted SQLite DB. Run after extract.py to confirm
data shape and spot obvious problems before importing to D1.

Usage:
    python -m parser.stats out/test.db
"""

from __future__ import annotations
import argparse, sqlite3, sys
from pathlib import Path


def q(db, sql, *params):
    return db.execute(sql, params).fetchone()


def section(title: str) -> None:
    print(f"\n=== {title} " + "=" * (60 - len(title)))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("db", type=Path)
    args = ap.parse_args()
    if not args.db.exists():
        print(f"no such db: {args.db}", file=sys.stderr)
        return 1

    db = sqlite3.connect(args.db)

    section("Row counts")
    for tbl in ("users", "images", "saves", "tags", "image_tags", "image_url_map"):
        try:
            n = q(db, f"SELECT COUNT(*) FROM {tbl}")[0]
            print(f"  {tbl:18s} {n:10,d}")
        except sqlite3.OperationalError:
            print(f"  {tbl:18s} (missing)")

    section("Image field coverage")
    n_images = q(db, "SELECT COUNT(*) FROM images")[0]
    if n_images:
        for col in ("source_url", "cdn_thumbnail_url", "uploaded_at", "width", "height"):
            n = q(db, f"SELECT COUNT(*) FROM images WHERE {col} IS NOT NULL")[0]
            pct = 100 * n / n_images
            print(f"  {col:20s} {n:8,d} / {n_images:,} ({pct:5.1f}%)")

    section("Date range (uploaded_at)")
    row = q(db, "SELECT MIN(uploaded_at), MAX(uploaded_at) FROM images WHERE uploaded_at IS NOT NULL")
    if row and row[0]:
        from datetime import datetime, timezone
        lo = datetime.fromtimestamp(row[0], tz=timezone.utc).strftime("%Y-%m-%d")
        hi = datetime.fromtimestamp(row[1], tz=timezone.utc).strftime("%Y-%m-%d")
        print(f"  {lo} -> {hi}")

    section("Top users by save count (from saves table)")
    rows = db.execute(
        """SELECT username, COUNT(*) AS n FROM saves
           GROUP BY username ORDER BY n DESC LIMIT 15"""
    ).fetchall()
    for u, n in rows:
        print(f"  {u:30s} {n:8,d}")

    section("Top images by save count")
    rows = db.execute(
        """SELECT image_id, save_count FROM images
           WHERE save_count > 0 ORDER BY save_count DESC LIMIT 10"""
    ).fetchall()
    for iid, n in rows:
        print(f"  {iid}  {n:5,d}")

    section("Source-URL hosts (for dead-link analysis)")
    rows = db.execute(
        """SELECT
             SUBSTR(source_url, 1, INSTR(SUBSTR(source_url,9), '/') + 8) AS host_prefix,
             COUNT(*) AS n
           FROM images
           WHERE source_url LIKE 'http%'
           GROUP BY host_prefix
           ORDER BY n DESC LIMIT 15"""
    ).fetchall()
    for h, n in rows:
        print(f"  {h[:60]:60s} {n:6,d}")

    section("Image URL map (CDN → local file)")
    try:
        n = q(db, "SELECT COUNT(*) FROM image_url_map")[0]
        bytes_sum = q(db, "SELECT IFNULL(SUM(bytes),0) FROM image_url_map")[0]
        ext_rows = db.execute(
            "SELECT ext, COUNT(*), SUM(bytes) FROM image_url_map GROUP BY ext ORDER BY 2 DESC"
        ).fetchall()
        print(f"  {n:,} unique URLs / {bytes_sum / 1e9:.2f} GB on disk")
        for e, c, b in ext_rows:
            print(f"  {e:8s} {c:8,d} files  {(b or 0) / 1e6:8.1f} MB")
    except sqlite3.OperationalError:
        print("  (no image_url_map table yet)")

    section("WARC progress")
    rows = db.execute(
        "SELECT warc_path, records_seen, finished_at FROM warc_progress"
    ).fetchall()
    for p, n, fin in rows:
        status = "done" if fin else "in-flight"
        print(f"  [{status}] {n:8,d}  {p}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
