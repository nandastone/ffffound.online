"""
Export the parser's SQLite DB into chunked SQL files suitable for
`wrangler d1 execute --file ... --remote`.

D1 caps single-import size, so each chunk file targets ~900 KB of SQL using
multi-row VALUES batches.

Usage:
    python -m parser.export_d1 out/full.db ./out/d1-chunks/

Output layout:
    00_users_NNNN.sql       (~12K rows)
    01_images_NNNN.sql      (~1.28M rows)
    02_image_related_NNNN.sql
    03_saves_NNNN.sql       (~6.5M rows — biggest)
"""

from __future__ import annotations
import argparse, sqlite3, sys, time
from pathlib import Path

BYTES_PER_FILE   = 900_000   # ~1 MB per .sql file (D1 file limit)
ROWS_PER_STMT    = 100       # rows per multi-VALUES INSERT (D1 per-statement memory limit)
ROWS_PER_FETCH   = 5000
WRITE_BUF        = 4 * 1024 * 1024


def export_table(db: sqlite3.Connection, table: str, columns: list[str],
                 out_prefix: Path, order_by: str | None = None) -> tuple[int, int]:
    cols_sql      = ", ".join(columns)
    select_sql    = f"SELECT {cols_sql} FROM {table}"
    if order_by:
        select_sql += f" ORDER BY {order_by}"
    # OR IGNORE makes retries safe — re-applying a partial chunk won't blow up on
    # PRIMARY KEY conflicts. Initial bulk load doesn't need overwrite semantics.
    insert_prefix = f"INSERT OR IGNORE INTO {table} ({cols_sql}) VALUES "

    cur = db.execute(select_sql)
    rows_total = 0
    file_idx   = 0
    fpath      = lambda i: out_prefix.parent / f"{out_prefix.name}_{i:04d}.sql"
    f          = fpath(file_idx).open("w", encoding="utf-8", buffering=WRITE_BUF)
    bytes_in_file = 0

    # Accumulator for the current INSERT statement (multi-VALUES). Flushed
    # whenever it crosses BYTES_PER_STMT or the row stream ends.
    stmt_parts: list[str] = [insert_prefix]
    stmt_bytes  = len(insert_prefix)
    rows_in_stmt = 0

    def flush_stmt() -> None:
        nonlocal stmt_bytes, rows_in_stmt, bytes_in_file, file_idx, f
        if rows_in_stmt == 0:
            return
        # Drop the trailing "," that the last appended row left.
        stmt_parts[-1] = stmt_parts[-1][:-1]
        stmt_parts.append(";\n")
        stmt = "".join(stmt_parts)
        f.write(stmt)
        bytes_in_file += len(stmt)
        # Reset accumulator for next INSERT.
        stmt_parts.clear()
        stmt_parts.append(insert_prefix)
        stmt_bytes = len(insert_prefix)
        rows_in_stmt = 0
        # Roll over to a new file if we crossed BYTES_PER_FILE.
        if bytes_in_file >= BYTES_PER_FILE:
            f.close()
            file_idx += 1
            f = fpath(file_idx).open("w", encoding="utf-8", buffering=WRITE_BUF)
            bytes_in_file = 0

    t0 = time.time()
    while True:
        rows = cur.fetchmany(ROWS_PER_FETCH)
        if not rows:
            break
        for row in rows:
            row_parts = []
            for v in row:
                if v is None:
                    row_parts.append("NULL")
                elif isinstance(v, int):
                    row_parts.append(str(v))
                elif isinstance(v, float):
                    row_parts.append(repr(v))
                else:
                    s = str(v)
                    if "'" in s:
                        s = s.replace("'", "''")
                    if "\x00" in s:
                        s = s.replace("\x00", "")
                    row_parts.append(f"'{s}'")
            chunk = "(" + ",".join(row_parts) + "),"
            stmt_parts.append(chunk)
            stmt_bytes += len(chunk)
            rows_in_stmt += 1
            rows_total += 1
            if rows_in_stmt >= ROWS_PER_STMT:
                flush_stmt()

    flush_stmt()
    f.close()
    elapsed = time.time() - t0
    rate = rows_total / max(elapsed, 0.01)
    print(f"  {table}: {rows_total:>10,d} rows -> {file_idx + 1} files in {elapsed:.1f}s ({rate:.0f}/s)")
    return rows_total, file_idx + 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("db", type=Path)
    ap.add_argument("out", type=Path)
    args = ap.parse_args()

    if not args.db.exists():
        print(f"no such db: {args.db}", file=sys.stderr); return 1

    args.out.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True, timeout=30)
    # Speed: skip integrity checks etc. on ATTACH; we're read-only.
    db.execute("PRAGMA query_only = 1")

    print("Exporting D1 chunks...")
    export_table(db, "users",
        ["username","display_name","joined_at","bio","save_count"],
        args.out / "00_users")
    export_table(db, "images",
        ["image_id","uploader","title","source_url","source_dead",
         "cdn_thumbnail_url","r2_key","width","height","uploaded_at","save_count"],
        args.out / "01_images")
    export_table(db, "image_related",
        ["image_id","related_id","position"],
        args.out / "02_image_related")
    export_table(db, "saves",
        ["image_id","username","saved_at"],
        args.out / "03_saves")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
