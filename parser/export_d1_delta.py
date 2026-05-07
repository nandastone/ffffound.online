"""
Export only the rows that changed between full.db.pre-apr27 and full.db, for
incremental application to remote D1.

Strategy: ATTACH the pre-apr27 backup as `pre` and walk each table looking for
new or changed rows. New rows get a plain INSERT (ON CONFLICT DO NOTHING for
safety), changed rows get an UPSERT with COALESCE-style semantics so we fill
NULL holes in D1 without regressing values D1 already has.

The local full.db is a strict superset of the pre-apr27 backup (parser is
additive), so for any field where local has a value, D1 should take that
value; where local is NULL, D1 keeps whatever it has.

Usage:
    python -m parser.export_d1_delta out/full.db out/full.db.pre-apr27 ./out/d1-delta/
"""

from __future__ import annotations
import argparse, sqlite3, sys, time
from pathlib import Path

BYTES_PER_FILE = 900_000
ROWS_PER_STMT  = 100
ROWS_PER_FETCH = 5000
WRITE_BUF      = 4 * 1024 * 1024


def _quote(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return repr(v)
    s = str(v).replace("'", "''").replace("\x00", "")
    return f"'{s}'"


def _emit(out_prefix: Path, insert_prefix: str, conflict_clause: str, rows_iter) -> tuple[int, int]:
    """Stream rows into 900KB SQL files of 100-row INSERT statements."""
    file_idx = 0
    fpath = lambda i: out_prefix.parent / f"{out_prefix.name}_{i:04d}.sql"
    f = fpath(file_idx).open("w", encoding="utf-8", buffering=WRITE_BUF)
    bytes_in_file = 0

    stmt_parts = [insert_prefix]
    rows_in_stmt = 0
    rows_total = 0

    def flush():
        nonlocal stmt_parts, rows_in_stmt, bytes_in_file, file_idx, f
        if rows_in_stmt == 0:
            return
        stmt_parts[-1] = stmt_parts[-1][:-1]  # drop trailing comma
        stmt_parts.append(conflict_clause)
        stmt_parts.append(";\n")
        s = "".join(stmt_parts)
        f.write(s)
        bytes_in_file += len(s)
        stmt_parts = [insert_prefix]
        rows_in_stmt = 0
        if bytes_in_file >= BYTES_PER_FILE:
            f.close()
            file_idx += 1
            f = fpath(file_idx).open("w", encoding="utf-8", buffering=WRITE_BUF)
            bytes_in_file = 0

    for row in rows_iter:
        chunk = "(" + ",".join(_quote(v) for v in row) + "),"
        stmt_parts.append(chunk)
        rows_in_stmt += 1
        rows_total += 1
        if rows_in_stmt >= ROWS_PER_STMT:
            flush()

    flush()
    f.close()
    return rows_total, file_idx + 1


def export_users(db: sqlite3.Connection, out: Path):
    cols = ["username", "display_name", "joined_at", "bio", "save_count"]
    cols_sql = ", ".join(cols)
    insert_prefix = f"INSERT INTO users ({cols_sql}) VALUES "
    conflict = (" ON CONFLICT(username) DO UPDATE SET "
                "display_name = COALESCE(excluded.display_name, users.display_name),"
                "joined_at    = COALESCE(excluded.joined_at,    users.joined_at),"
                "bio          = COALESCE(excluded.bio,          users.bio),"
                "save_count   = MAX(excluded.save_count, users.save_count)")
    # Diff: row exists in cur and either not in pre or any tracked column differs.
    sql = f"""
      SELECT c.{', c.'.join(cols)}
      FROM main.users c
      LEFT JOIN pre.users p ON p.username = c.username
      WHERE p.username IS NULL
         OR COALESCE(c.display_name,'') != COALESCE(p.display_name,'')
         OR COALESCE(c.joined_at,0)     != COALESCE(p.joined_at,0)
         OR COALESCE(c.bio,'')          != COALESCE(p.bio,'')
         OR c.save_count != p.save_count
    """
    cur = db.execute(sql)
    n, files = _emit(out / "00_users", insert_prefix, conflict, cur)
    print(f"  users:         {n:>10,} delta rows -> {files} files")


def export_images(db: sqlite3.Connection, out: Path):
    cols = ["image_id", "uploader", "title", "source_url", "source_dead",
            "cdn_thumbnail_url", "r2_key", "width", "height", "uploaded_at", "save_count"]
    cols_sql = ", ".join(cols)
    insert_prefix = f"INSERT INTO images ({cols_sql}) VALUES "
    # COALESCE(excluded.X, images.X): new wins where new is non-NULL, otherwise
    # keep D1's value. Since local is a superset of D1, this fills holes only.
    conflict = (" ON CONFLICT(image_id) DO UPDATE SET "
                "title             = COALESCE(excluded.title,             images.title),"
                "source_url        = COALESCE(excluded.source_url,        images.source_url),"
                "source_dead       = MAX(excluded.source_dead, images.source_dead),"
                "cdn_thumbnail_url = COALESCE(excluded.cdn_thumbnail_url, images.cdn_thumbnail_url),"
                "r2_key            = COALESCE(excluded.r2_key,            images.r2_key),"
                "width             = COALESCE(excluded.width,             images.width),"
                "height            = COALESCE(excluded.height,            images.height),"
                "uploaded_at       = COALESCE(excluded.uploaded_at,       images.uploaded_at),"
                "save_count        = MAX(excluded.save_count, images.save_count)")
    sql = f"""
      SELECT c.{', c.'.join(cols)}
      FROM main.images c
      LEFT JOIN pre.images p ON p.image_id = c.image_id
      WHERE p.image_id IS NULL
         OR COALESCE(c.title,'')             != COALESCE(p.title,'')
         OR COALESCE(c.source_url,'')        != COALESCE(p.source_url,'')
         OR c.source_dead != p.source_dead
         OR COALESCE(c.cdn_thumbnail_url,'') != COALESCE(p.cdn_thumbnail_url,'')
         OR COALESCE(c.r2_key,'')            != COALESCE(p.r2_key,'')
         OR COALESCE(c.width,0)              != COALESCE(p.width,0)
         OR COALESCE(c.height,0)             != COALESCE(p.height,0)
         OR COALESCE(c.uploaded_at,0)        != COALESCE(p.uploaded_at,0)
         OR c.save_count != p.save_count
    """
    cur = db.execute(sql)
    n, files = _emit(out / "01_images", insert_prefix, conflict, cur)
    print(f"  images:        {n:>10,} delta rows -> {files} files")


def export_image_related(db: sqlite3.Connection, pre_db_path: Path, out: Path):
    """Append-only edge table; emit rows whose composite key isn't in pre.
    Builds the pre-key set in RAM and streams main, filtering Python-side.
    SQLite's NOT EXISTS planner across ATTACHed DBs is too slow on this size.
    """
    print("    loading pre-image_related keys into RAM...", flush=True)
    pre = sqlite3.connect(f"file:{pre_db_path}?mode=ro", uri=True)
    pre.execute("PRAGMA query_only = 1")
    pre_keys = set()
    n_pre = 0
    for r in pre.execute("SELECT image_id, related_id FROM image_related"):
        pre_keys.add(r[0] + r[1])
        n_pre += 1
        if n_pre % 1_000_000 == 0:
            print(f"      ...{n_pre:,}", flush=True)
    pre.close()
    print(f"    pre keys loaded: {len(pre_keys):,}", flush=True)

    cols = ["image_id", "related_id", "position"]
    cols_sql = ", ".join(cols)
    insert_prefix = f"INSERT OR IGNORE INTO image_related ({cols_sql}) VALUES "

    def stream():
        cur = db.execute("SELECT image_id, related_id, position FROM main.image_related")
        for image_id, related_id, position in cur:
            if (image_id + related_id) not in pre_keys:
                yield (image_id, related_id, position)

    n, files = _emit(out / "02_image_related", insert_prefix, "", stream())
    print(f"  image_related: {n:>10,} delta rows -> {files} files")


def export_saves(db: sqlite3.Connection, pre_db_path: Path, out: Path):
    """Append-only events. Same in-RAM filter strategy as image_related."""
    print("    loading pre-saves keys into RAM...", flush=True)
    pre = sqlite3.connect(f"file:{pre_db_path}?mode=ro", uri=True)
    pre.execute("PRAGMA query_only = 1")
    pre_keys = set()
    n_pre = 0
    for r in pre.execute("SELECT image_id, username FROM saves"):
        pre_keys.add(r[0] + "\x00" + r[1])
        n_pre += 1
        if n_pre % 1_000_000 == 0:
            print(f"      ...{n_pre:,}", flush=True)
    pre.close()
    print(f"    pre keys loaded: {len(pre_keys):,}", flush=True)

    cols = ["image_id", "username", "saved_at"]
    cols_sql = ", ".join(cols)
    insert_prefix = f"INSERT OR IGNORE INTO saves ({cols_sql}) VALUES "

    def stream():
        cur = db.execute("SELECT image_id, username, saved_at FROM main.saves")
        for image_id, username, saved_at in cur:
            if (image_id + "\x00" + username) not in pre_keys:
                yield (image_id, username, saved_at)

    n, files = _emit(out / "03_saves", insert_prefix, "", stream())
    print(f"  saves:         {n:>10,} delta rows -> {files} files")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cur", type=Path, help="current full.db")
    ap.add_argument("pre", type=Path, help="full.db.pre-apr27 backup")
    ap.add_argument("out", type=Path, help="output dir for SQL chunks")
    args = ap.parse_args()
    if not args.cur.exists() or not args.pre.exists():
        print("missing db", file=sys.stderr); return 1

    args.out.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(f"file:{args.cur}?mode=ro", uri=True, timeout=60)
    db.execute("PRAGMA query_only = 1")
    db.execute(f"ATTACH DATABASE 'file:{args.pre.as_posix()}?mode=ro' AS pre")

    print("Computing deltas vs pre-apr27 backup...")
    t0 = time.time()
    export_users(db, args.out)
    export_images(db, args.out)
    export_image_related(db, args.pre, args.out)
    export_saves(db, args.pre, args.out)
    print(f"\nDone in {time.time()-t0:.1f}s. Apply with:")
    print(f"  for f in {args.out.as_posix()}/*.sql; do npx wrangler d1 execute ffffound2 --remote --file \"$f\"; done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
