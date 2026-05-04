# Deploy

Production runs on Cloudflare:

- **R2** (`ffffound-images` bucket) — image bytes
- **D1** (`ffffound` database) — metadata
- **Worker** (`ffffound`) — render
- **Custom domain** — `ffffound.online`

The Worker, R2 binding, and D1 binding are all declared in `web/wrangler.toml`.
The same Worker code runs locally (against miniflare) and in production.

## One-time bootstrap

```bash
cd web

# 1. Log in (opens a browser)
npx wrangler login

# 2. Create the R2 bucket
npx wrangler r2 bucket create ffffound-images

# 3. Create the D1 database; copy the returned `database_id` into wrangler.toml
npx wrangler d1 create ffffound

# 4. Apply migrations to the production D1
npx wrangler d1 migrations apply ffffound --remote

# 5. Bulk-load image bytes into R2 (use rclone, fastest path)
#    See "R2 bulk upload" below.

# 6. Bulk-load metadata into D1
#    See "D1 import" below.

# 7. Deploy the Worker
npx wrangler deploy

# 8. Register ffffound.online in Cloudflare Dashboard, then:
#    Workers & Pages → ffffound → Settings → Domains → Add custom domain
```

## R2 bulk upload (~50 GB)

Use rclone with R2's S3-compatible API:

```bash
# Configure once (rclone config; see https://rclone.org/s3/#cloudflare-r2)
rclone copy F:/ffffound/out/images r2:ffffound-images \
    --transfers 32 --checkers 16 --progress
```

Egress is free out of R2 via Cloudflare's CDN, so this is the only bandwidth
cost for the project.

## D1 import (~3 GB SQLite)

D1 caps single SQL imports around the MB range, so the parser DB needs to be
chunked. Pipeline:

```bash
# 1. Run stitch to populate r2_key + backfill users.save_count
python -m parser.stitch out/full.db

# 2. Export D1-friendly SQL chunks (one file per table, ~500K rows each)
python -m parser.export_d1 out/full.db ./out/d1-chunks/

# 3. Apply each chunk to remote D1
for f in out/d1-chunks/*.sql; do
  npx wrangler d1 execute ffffound --remote --file "$f"
done
```

(`parser/export_d1.py` doesn't exist yet — written when needed.)

## Manual cache purge after a template change

The Worker sets long `Cache-Control` headers, so deployed template changes are
**not** automatically reflected in browsers / the edge cache.

Purge is **always manual** to avoid accidental no-op purges that count against
the API budget:

```bash
# Get $ZONE_ID from Cloudflare dashboard → ffffound.online → Overview
# Get $TOKEN from My Profile → API Tokens → "Cache Purge" template
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

When to run it:
- After `wrangler deploy` if Worker code OR templates changed
- After a D1 backfill / data correction that should be visible immediately
- **Never** on a no-op deploy (Cloudflare rate-limits purge calls)

If you only want to invalidate specific URLs (cheaper, more surgical):

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"files":["https://ffffound.online/","https://ffffound.online/image/abc..."]}'
```

## Deploy checklist

Use this for ongoing iteration once production is live:

```
[ ] git status clean
[ ] local smoke test passes (npm run dev + curl checks)
[ ] cd web && npx wrangler deploy
[ ] (if templates changed) curl ... purge_cache
[ ] (if data changed)      curl ... purge_cache or surgical /files purge
[ ] verify production: open https://ffffound.online/
```

## Costs (rough monthly)

- **R2 storage** ~50 GB × $0.015/GB = **$0.75**
- **R2 reads** free egress via Cloudflare = **$0**
- **D1 storage** ~3 GB × $0.75/GB-mo = **$2.25**
- **D1 reads** free first 5M rows/day, then $0.001/1K rows
- **Workers** free tier 100K req/day; paid $5/mo for 10M req/day
- **Domain** `.online` ~$1–4 first year, ~$20/yr renewal
- **Total** ~$5–10/mo at any reasonable read traffic

If traffic spikes, Cloudflare's edge cache absorbs almost everything and only
the cold cache misses hit D1.
