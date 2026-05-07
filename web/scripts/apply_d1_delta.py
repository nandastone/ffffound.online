"""
Apply the D1 delta chunks produced by parser/export_d1_delta.py to remote D1.

Idempotent: every chunk uses INSERT ... ON CONFLICT or INSERT OR IGNORE, so
re-running is safe. Retries on transient failure.

Usage:
    python web/scripts/apply_d1_delta.py out/d1-delta
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

DB_NAME      = "ffffound2"
RETRY_DELAY  = 5
MAX_RETRIES  = 3


def find_wrangler() -> list[str]:
    """Return the command to invoke wrangler. Prefer npx so it works from any cwd."""
    npx = shutil.which("npx") or shutil.which("npx.cmd")
    if not npx:
        sys.exit("npx not found on PATH — install Node.js or add it to PATH.")
    return [npx, "wrangler"]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("delta_dir", type=Path)
    ap.add_argument("--db", default=DB_NAME)
    ap.add_argument("--cwd", type=Path, default=None,
                    help="cwd for wrangler (default: directory of this script's parent)")
    args = ap.parse_args()

    if not args.delta_dir.is_dir():
        sys.exit(f"no such dir: {args.delta_dir}")

    files = sorted(args.delta_dir.glob("*.sql"))
    if not files:
        sys.exit(f"no .sql files in {args.delta_dir}")

    cwd = args.cwd or Path(__file__).resolve().parent.parent  # web/
    if not (cwd / "wrangler.toml").exists():
        sys.exit(f"no wrangler.toml in {cwd}")

    base_cmd = find_wrangler() + ["d1", "execute", args.db, "--remote", "--file"]

    print(f"Applying {len(files)} chunks to D1 (db={args.db}) from {cwd}...")
    ok = fail = 0
    t_start = time.time()

    for i, f in enumerate(files, 1):
        cmd = base_cmd + [str(f.resolve())]
        for attempt in range(1, MAX_RETRIES + 1):
            r = subprocess.run(cmd, cwd=cwd, capture_output=True,
                               encoding="utf-8", errors="replace")
            if r.returncode == 0:
                ok += 1
                print(f"[{i:3d}/{len(files)}] {f.name}  ✓")
                break
            if attempt < MAX_RETRIES:
                print(f"[{i:3d}/{len(files)}] {f.name}  retry {attempt}/{MAX_RETRIES} after {RETRY_DELAY}s")
                time.sleep(RETRY_DELAY)
            else:
                fail += 1
                print(f"[{i:3d}/{len(files)}] {f.name}  FAILED after {MAX_RETRIES} attempts")
                tail = (r.stderr or r.stdout or "").splitlines()[-10:]
                for line in tail:
                    print(f"    {line}")

    elapsed = time.time() - t_start
    print(f"\nDone in {elapsed:.0f}s: {ok} ok, {fail} failed (of {len(files)})")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
