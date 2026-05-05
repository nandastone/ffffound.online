"""
Coalesce small d1-chunks into ~30 MB chunks per table to reduce wrangler
call count for the import.
"""
from __future__ import annotations
import argparse, sys
from pathlib import Path

TARGET_BYTES = 30 * 1024 * 1024  # ~30 MB per output file


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", default=Path("out/d1-chunks"), type=Path)
    ap.add_argument("--out", default=Path("out/d1-bulk"),   type=Path)
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    for old in args.out.glob("*.sql"): old.unlink()

    for prefix in ("00_users", "01_images", "02_image_related", "03_saves"):
        chunks = sorted(args.src.glob(f"{prefix}_*.sql"))
        if not chunks:
            print(f"  {prefix}: no chunks", file=sys.stderr); continue
        out_idx = 0
        out = args.out / f"{prefix}_{out_idx:03d}.sql"
        f = out.open("wb")
        bytes_written = 0
        for chunk in chunks:
            data = chunk.read_bytes()
            if bytes_written and bytes_written + len(data) > TARGET_BYTES:
                f.close()
                out_idx += 1
                out = args.out / f"{prefix}_{out_idx:03d}.sql"
                f = out.open("wb")
                bytes_written = 0
            f.write(data)
            bytes_written += len(data)
        f.close()
        print(f"  {prefix}: {len(chunks)} chunks -> {out_idx + 1} bulk file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
