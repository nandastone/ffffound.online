# ffffound

Read-only preservation site over the 2007–2017 ffffound corpus, reconstructed
from the ArchiveTeam WARC capture.

## Architecture

```
WARC files (~85 GB)
   │
   │  parser/extract.py  (Python, local, idempotent)
   ▼
SQLite DB  +  ./out/images/  (sha256-keyed local files)
   │              │
   │  d1 import   │  rclone → R2
   ▼              ▼
Cloudflare D1   Cloudflare R2 (ffffound-images)
   └──────┬──────┘
          │
       Worker (web/, Hono + TS)
       routes: /, /image/:id, /user/:name, /tag/:tag, /search, /img/:key
          │
   Cloudflare CDN  (immutable Cache-Control → ~100% edge hit)
```

D1 holds metadata (~500K image rows + tags + saves). R2 holds image bytes.
The Worker reads both, renders HTML inline, and lets Cloudflare cache the
output at the edge. Total cost target: under $10/mo.

## Layout

- `parser/` — Python WARC walker. URL-classification dispatch table + one handler per page type.
- `web/` — Hono Worker, D1 migrations, synthetic seed data.
- `infra/` — deploy notes (R2 bucket creation, D1 setup, custom domain).

## Local dev (no real data needed)

The Worker can run end-to-end against synthetic D1 + R2 fixtures:

```bash
cd web
npm install

# Create local D1 (writes to .wrangler/state)
npx wrangler d1 create ffffound        # paste returned id into wrangler.toml
npm run db:migrate:local
npm run db:seed:local
npm run r2:seed:local                  # pushes 12 placeholder JPEGs to local R2

npm run dev                            # http://localhost:8787
```

You should see a grid of 24 images on `/`, half of which load from R2 (the
`/img/fake/*` keys) and half of which fall back to dead `static.ffffound.com`
URLs (deliberate — exercises the missing-bytes branch).

## Parser dev

```bash
cd parser
python -m venv .venv && .venv\Scripts\activate    # Windows
pip install -r requirements.txt

python -m parser.extract \
    --db ../out/ffffound.db \
    --images ../out/images \
    /path/to/ffffound.com-1.warc.gz
```

The CSS selectors in `parser/handlers/*.py` are **stubs** — they need to be
replaced with real ones during Phase 0 spike against an actual WARC. Each
handler is marked with `# TODO Phase 0`.

## Phases (from the brief)

- [x] Repo scaffold + Worker prototype rendering on synthetic data
- [ ] **Phase 0:** spike one WARC chunk, validate URL patterns, fill in handler selectors
- [ ] Phase 1: full extraction
- [ ] Phase 2: schema cleanup + dead-source HEAD-check pass
- [ ] Phase 3: deploy Worker + import to D1 + upload to R2
- [ ] Phase 4: search (already wired via FTS5; needs real index population)
- [ ] Phase 5: CLIP embeddings + visual discovery

## Deploy (later)

```bash
npx wrangler r2 bucket create ffffound-images
npx wrangler d1 create ffffound        # paste id into wrangler.toml
npm run db:migrate:remote
# import your local SQLite to D1 (or apply seed.sql there too for a smoke test)
npm run deploy
```

Bind a custom domain in the Cloudflare dashboard (`Workers & Pages → ffffound
→ Settings → Domains`).
