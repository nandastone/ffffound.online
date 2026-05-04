"""
Export a small but realistic subset of the extracted DB as a SQL file the
Worker's local D1 can load. Picks top-N images by save_count and pulls in
everything needed to render them faithfully:

  - the top-N images themselves
  - their savers (users + saves rows)
  - their "you may like these" related edges
  - the *related* images too (so the related grid has thumbnails to display)
  - all those users referenced

Usage:
    python -m parser.export_seed out/full.db web/seed/seed-real.sql --top 50
"""

from __future__ import annotations
import argparse, sqlite3, sys
from pathlib import Path


def sql_escape(value):
    if value is None:                    return "NULL"
    if isinstance(value, (int, float)):  return str(value)
    s = str(value).replace("'", "''")
    return f"'{s}'"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("db", type=Path)
    ap.add_argument("out", type=Path)
    ap.add_argument("--top", type=int, default=50, help="number of headline images to export")
    args = ap.parse_args()

    if not args.db.exists():
        print(f"no such db: {args.db}", file=sys.stderr); return 1

    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True, timeout=30)
    db.row_factory = sqlite3.Row

    # Headline set: top-N images that have local bytes (so the page actually renders).
    headline = db.execute(
        """SELECT * FROM images
           WHERE r2_key IS NOT NULL
           ORDER BY save_count DESC, uploaded_at DESC
           LIMIT ?""",
        (args.top,),
    ).fetchall()

    if not headline:
        print("WARNING: no images with r2_key. Did you run stitch?", file=sys.stderr)
        return 1

    headline_ids = [r["image_id"] for r in headline]
    ph = ",".join("?" * len(headline_ids))

    # First-hop related: edges out of the headline set, plus their target images.
    headline_edges = db.execute(
        f"SELECT image_id, related_id, position FROM image_related WHERE image_id IN ({ph})",
        headline_ids,
    ).fetchall()
    related_ids = {r["related_id"] for r in headline_edges}
    related_only = related_ids - set(headline_ids)

    related_images = []
    if related_only:
        ph2 = ",".join("?" * len(related_only))
        related_images = db.execute(
            f"SELECT * FROM images WHERE image_id IN ({ph2})",
            list(related_only),
        ).fetchall()

    # For the per-saver mini-grids: pull each headline image's first 10 savers,
    # then each of those savers' 5 most recent saves — all in one SQL batch
    # using window functions. The image_ids returned get added to our subset
    # so the mini-grid renders without dangling thumbs.
    print("Pulling top savers' recent saves for mini-grids...")
    saver_recents = db.execute(
        f"""WITH first_savers AS (
              SELECT username, image_id AS hid,
                     ROW_NUMBER() OVER (PARTITION BY image_id ORDER BY saved_at ASC) AS rn
              FROM saves
              WHERE image_id IN ({ph}) AND saved_at IS NOT NULL
            ),
            top_savers AS (
              SELECT DISTINCT username FROM first_savers WHERE rn <= 10
            ),
            ranked AS (
              SELECT s.image_id,
                     ROW_NUMBER() OVER (PARTITION BY s.username ORDER BY s.saved_at DESC) AS rn
              FROM saves s
              JOIN top_savers ts ON ts.username = s.username
              WHERE s.saved_at IS NOT NULL
            )
            SELECT DISTINCT image_id FROM ranked WHERE rn <= 5""",
        headline_ids,
    ).fetchall()
    saver_recent_image_ids: set[str] = {r[0] for r in saver_recents}

    all_image_id_set = set(headline_ids) | related_only | saver_recent_image_ids
    extra_ids = all_image_id_set - set(headline_ids) - related_only
    if extra_ids:
        ph_extra = ",".join("?" * len(extra_ids))
        extra_images = db.execute(
            f"SELECT * FROM images WHERE image_id IN ({ph_extra})",
            list(extra_ids),
        ).fetchall()
    else:
        extra_images = []

    all_images = headline + related_images + extra_images
    all_image_ids = [r["image_id"] for r in all_images]
    ph3 = ",".join("?" * len(all_image_ids))

    # Pull outgoing edges for every image we're including, so that clicking
    # into a "related-only" image still shows its own related grid (filtered to
    # targets that are also in our subset, so nothing dangles).
    related_edges = db.execute(
        f"""SELECT image_id, related_id, position
            FROM image_related
            WHERE image_id   IN ({ph3})
              AND related_id IN ({ph3})""",
        all_image_ids + all_image_ids,
    ).fetchall()

    # Saves for the full image set (headline + related) so user pages link in.
    saves = db.execute(
        f"SELECT image_id, username, saved_at FROM saves WHERE image_id IN ({ph3})",
        all_image_ids,
    ).fetchall()

    user_set = {r["uploader"] for r in all_images} | {r["username"] for r in saves}
    user_set.discard(None); user_set.discard("_unknown")
    users = []
    if user_set:
        ph4 = ",".join("?" * len(user_set))
        users = db.execute(
            f"SELECT username, display_name, joined_at, bio, save_count FROM users WHERE username IN ({ph4})",
            list(user_set),
        ).fetchall()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", encoding="utf-8") as f:
        f.write("-- Auto-generated by parser.export_seed. Re-run safely: clears and reseeds.\n")
        f.write("DELETE FROM image_related; DELETE FROM saves; DELETE FROM images; DELETE FROM users;\n\n")

        # Always insert _unknown placeholder — some images may use it as uploader.
        f.write("INSERT OR IGNORE INTO users (username) VALUES ('_unknown');\n")

        for u in users:
            f.write(
                "INSERT OR IGNORE INTO users (username, display_name, joined_at, bio, save_count) VALUES "
                f"({sql_escape(u['username'])}, {sql_escape(u['display_name'])}, "
                f"{sql_escape(u['joined_at'])}, {sql_escape(u['bio'])}, {sql_escape(u['save_count'])});\n"
            )

        f.write("\n")
        for r in all_images:
            f.write(
                "INSERT INTO images (image_id, uploader, title, source_url, source_dead, cdn_thumbnail_url, r2_key, width, height, uploaded_at, save_count) VALUES "
                f"({sql_escape(r['image_id'])}, {sql_escape(r['uploader'])}, {sql_escape(r['title'])}, "
                f"{sql_escape(r['source_url'])}, {sql_escape(r['source_dead'])}, "
                f"{sql_escape(r['cdn_thumbnail_url'])}, {sql_escape(r['r2_key'])}, "
                f"{sql_escape(r['width'])}, {sql_escape(r['height'])}, {sql_escape(r['uploaded_at'])}, "
                f"{sql_escape(r['save_count'])});\n"
            )

        f.write("\n")
        for r in saves:
            f.write(
                "INSERT OR IGNORE INTO saves (image_id, username, saved_at) VALUES "
                f"({sql_escape(r['image_id'])}, {sql_escape(r['username'])}, {sql_escape(r['saved_at'])});\n"
            )

        f.write("\n")
        for r in related_edges:
            f.write(
                "INSERT OR IGNORE INTO image_related (image_id, related_id, position) VALUES "
                f"({sql_escape(r['image_id'])}, {sql_escape(r['related_id'])}, {sql_escape(r['position'])});\n"
            )

    print(f"wrote {args.out}:")
    print(f"  {len(users):>6,} users")
    print(f"  {len(all_images):>6,} images ({len(headline)} headline + {len(related_only)} related-only + {len(extra_images)} saver-recents)")
    print(f"  {len(saves):>6,} saves")
    print(f"  {len(related_edges):>6,} related edges")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
