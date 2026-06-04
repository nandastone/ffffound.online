# ffffound

Read-only preservation site over the 2007–2017 ffffound corpus, reconstructed
from the ArchiveTeam WARC capture. Live at https://ffffound.online.

## Architecture

```
WARC files (~85 GB)
   │  parser/extract.py  (Python, local, idempotent)
   ▼
SQLite DB  +  ./out/images/  (sha256-keyed local files)
   │  d1 import          │  rclone → R2
   ▼                     ▼
Cloudflare D1         Cloudflare R2 (ffffound-images)
   │                     │
   │  HTML (reads D1)    │  image bytes, served DIRECT from R2
   ▼                     ▼  via the img.ffffound.online domain
Worker (web/, Hono+TS)   img.ffffound.online   (no Worker hop)
   │                     │
   └─────────┬───────────┘
             ▼
   Cloudflare CDN  (immutable Cache-Control → ~100% edge hit)
```

Worker routes: `/`, `/image/:id`, `/home/:user`, `/cdn/:file`, sitemaps, `robots.txt`.

D1 holds metadata (~1.28M image rows + saves; the original "tags" idea was
dropped). R2 holds image bytes. The Worker renders HTML from D1 and lets
Cloudflare cache it at the edge.

**Image bytes do not pass through the Worker.** They serve straight from R2 over
the `img.ffffound.online` custom domain. This is deliberate and load-bearing:
routing every thumbnail through the Worker (a page references up to ~150) blew the
free plan's 100K-requests/day cap and took the site down with Error 1027. The
`/img/` Worker route was removed; only `/cdn/` still proxies R2 (it needs a D1
sha1 lookup) and it is edge-cached. Target cost: under $10/mo.

## Staying under the free-tier cap

The Workers free plan allows 100K requests/day; exceeding it serves Error 1027
and the site goes down. The design keeps Worker requests low, and these guardrails
are load-bearing:

- **Image bytes bypass the Worker** (R2 via `img.ffffound.online`). Do not re-add a
  Worker image route; ~150 images per page would blow the cap again.
- **Pagination is capped** at `offset=500` in `home.ts` / `user.ts`; beyond that,
  404. An uncapped `?offset=` is an infinite crawl space (~51K pages) that crawlers
  walk, which is what first blew the cap.
- **HTML is edge-cached** (the archive is immutable), so repeat hits skip the
  Worker. Purge is manual; avoid `purge_everything` while traffic is high.
- **robots.txt** (self-managed in `seo.ts`) blocks AI scrapers and disallows
  `?offset=`. Cloudflare's managed robots.txt is off (`cloudflare_bot_management`
  in tofu); AI bots are also blocked at the WAF (`ai_bots_protection=block`).

If real traffic outgrows the free tier, Workers Paid is $5/mo.

## Layout

- `parser/` — Python WARC walker. URL-classification dispatch table + one handler per page type.
- `web/` — Hono Worker, D1 migrations, synthetic seed data.
- `infra/` — OpenTofu IaC (`infra/tofu/`) for the R2 bucket, D1, image domain, and Worker domain, plus data-loading scripts. Runbook in `infra/DEPLOY.md`.

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

The `/` grid renders, but image `src` URLs resolve to the production
`img.ffffound.online` host (via `IMAGES_BASE_URL` in `wrangler.toml`), so the
seeded `/img/fake/*` thumbnails do not load under `wrangler dev` unless you
override `IMAGES_BASE_URL` in a `.dev.vars`. Pages, queries, and the missing-bytes
branch still work; only local image previews are affected.

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

## Deploy

Production is live at https://ffffound.online. Infrastructure is OpenTofu in
`infra/tofu/`, which imports the existing R2 bucket, D1 database, the
`img.ffffound.online` image domain, and the Worker custom domain. Code ships with
wrangler:

```bash
cd web && npx wrangler deploy
```

Both tofu and wrangler authenticate from one account-owned `CLOUDFLARE_API_TOKEN`.
Full runbook (infra import, data loading, cache purge) is in `infra/DEPLOY.md` and
`infra/tofu/README.md`.
