"""
Post-extraction stitch pass.

For each image_id we know about, find the best matching CDN URL in
image_url_map and set images.r2_key to its local path. The "best" match is
the medium (`_m`) size if available, else thumbnail (`_s`/`_xs`).

This runs in a single SQL pass — no Python loop.

Usage:
    python -m parser.stitch out/test.db
"""

from __future__ import annotations
import argparse, sqlite3
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("db", type=Path)
    args = ap.parse_args()

    db = sqlite3.connect(args.db)
    db.execute("PRAGMA journal_mode = WAL")

    # Strategy: pull the SHA1 from each cdn_url, group by it, pick the best
    # variant per image. Update images.r2_key with the local_key.
    # CDN paths look like: /static-data/assets/<bucket>/<sha1>_<size>.<ext>
    # so we extract the sha1 segment with a regex-equivalent SQL slice.

    print("Building variant priority view...")
    db.executescript("""
        DROP VIEW IF EXISTS v_image_variants;
        CREATE TEMP VIEW v_image_variants AS
        SELECT
            cdn_url,
            local_key,
            bytes,
            -- pull "<sha1>_<size>" out of the path; sha1 = chars [-44..-7] in `_m.jpg`-style
            LOWER(SUBSTR(cdn_url, INSTR(cdn_url, '/static-data/assets/') + 22, 40)) AS sha1,
            CASE
                WHEN cdn_url LIKE '%_m.%'  THEN 1
                WHEN cdn_url LIKE '%_s.%'  THEN 2
                WHEN cdn_url LIKE '%_xs.%' THEN 3
                ELSE 4
            END AS prio
        FROM image_url_map
        WHERE INSTR(cdn_url, '/static-data/assets/') > 0;
    """)

    # The +22 above is the length of '/static-data/assets/X/' where X is one
    # bucket char. Verify a sample.
    sample = db.execute("SELECT cdn_url, sha1 FROM v_image_variants LIMIT 5").fetchall()
    print("Sample sha1 extraction:")
    for u, s in sample:
        print(f"  {s}  {u}")

    print("\nBest variant per sha1 (lowest prio wins)...")
    db.executescript("""
        DROP TABLE IF EXISTS image_best_variant;
        CREATE TEMP TABLE image_best_variant AS
        SELECT sha1, local_key, bytes
        FROM (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY sha1 ORDER BY prio, bytes DESC) AS rn
            FROM v_image_variants
        )
        WHERE rn = 1;
    """)

    n_variants = db.execute("SELECT COUNT(*) FROM image_best_variant").fetchone()[0]
    print(f"  {n_variants:,} unique image hashes with at least one byte payload")

    # Index on the join key — without this, the UPDATE below is O(N*M).
    db.execute("CREATE INDEX IF NOT EXISTS idx_image_best_variant_sha1 ON image_best_variant(sha1)")

    print("\nApplying r2_key to images...")
    cur = db.execute(
        """UPDATE images
           SET r2_key = (SELECT local_key FROM image_best_variant WHERE sha1 = images.image_id)
           WHERE EXISTS (SELECT 1 FROM image_best_variant WHERE sha1 = images.image_id)"""
    )
    db.commit()
    print(f"  updated {cur.rowcount:,} image rows")

    n_with_bytes = db.execute("SELECT COUNT(*) FROM images WHERE r2_key IS NOT NULL").fetchone()[0]
    n_total      = db.execute("SELECT COUNT(*) FROM images").fetchone()[0]
    print(f"\n  {n_with_bytes:,} of {n_total:,} images have local bytes ({100*n_with_bytes/max(1,n_total):.1f}%)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
