"""
Bulk-load image bytes into miniflare's local R2 by writing the blob files
and inserting rows into the SQLite metadata table directly. ~50x faster
than spawning `npx wrangler r2 object put` per file.

Run while wrangler dev is NOT running.
"""

from __future__ import annotations
import glob, hashlib, json, os, secrets, shutil, sqlite3, sys, time
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
R2_ROOT = WEB / ".wrangler" / "state" / "v3" / "r2"
BUCKET = "ffffound-images"
BLOBS_DIR = R2_ROOT / BUCKET / "blobs"
META_GLOB = str(R2_ROOT / "miniflare-R2BucketObject" / "*.sqlite")

D1_GLOB = str(WEB / ".wrangler" / "state" / "v3" / "d1" / "miniflare-D1DatabaseObject" / "*.sqlite")
IMAGES_ROOT = Path("F:/ffffound/out/images")

CONTENT_TYPES = {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".gif":"image/gif",".webp":"image/webp"}


def main() -> int:
    db_path = next(iter(glob.glob(META_GLOB)), None)
    if not db_path:
        print("no R2 sqlite — start wrangler dev once first, then push 1 file via npx so the dir exists", file=sys.stderr)
        return 1

    d1_path = next(iter(glob.glob(D1_GLOB)), None)
    d1 = sqlite3.connect(f"file:{d1_path}?mode=ro", uri=True)
    keys = [r[0] for r in d1.execute(
        "SELECT DISTINCT r2_key FROM images WHERE r2_key IS NOT NULL"
    )]
    d1.close()
    print(f"D1 has {len(keys)} unique r2_keys")

    BLOBS_DIR.mkdir(parents=True, exist_ok=True)

    db = sqlite3.connect(db_path)
    db.execute("PRAGMA journal_mode = WAL")
    db.execute("PRAGMA synchronous = NORMAL")

    existing = {r[0] for r in db.execute("SELECT key FROM _mf_objects")}
    todo = [k for k in keys if k not in existing]
    print(f"  {len(existing)} already in R2, {len(todo)} to push")

    pushed = missing = 0
    t = time.time()
    for i, key in enumerate(todo):
        src = IMAGES_ROOT / key
        if not src.exists():
            missing += 1
            continue
        body = src.read_bytes()
        etag = hashlib.md5(body).hexdigest()
        ext = src.suffix.lower()
        ctype = CONTENT_TYPES.get(ext, "application/octet-stream")

        # blob_id: 64 random hex + 16 random hex, miniflare-style
        blob_id = secrets.token_hex(32) + secrets.token_hex(8)
        version = secrets.token_hex(16)

        blob_path = BLOBS_DIR / blob_id
        # use a temp file + rename for atomicity
        tmp = blob_path.with_suffix(".tmp")
        tmp.write_bytes(body)
        os.replace(tmp, blob_path)

        db.execute(
            "INSERT INTO _mf_objects (key, blob_id, version, size, etag, uploaded, checksums, http_metadata, custom_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                key,
                blob_id,
                version,
                len(body),
                etag,
                int(time.time() * 1000),
                "{}",
                json.dumps({"contentType": ctype}),
                "{}",
            ),
        )
        pushed += 1
        if pushed % 50 == 0:
            db.commit()
            rate = pushed / (time.time() - t + 1e-9)
            print(f"  {pushed}/{len(todo)} pushed ({rate:.0f}/s)")

    db.commit()
    db.close()
    print(f"\ndone: {pushed} pushed, {missing} missing locally, {time.time()-t:.1f}s total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
