# Deploy

Production runs on Cloudflare:

- **R2** (`ffffound-images`) — image bytes
- **D1** (`ffffound2`) — metadata
- **Worker** (`ffffound`) — render, served at `ffffound.online`
- **Image host** (`img.ffffound.online`) — R2 bytes direct, bypasses the Worker

Three layers, three tools, one credential:

- **Infrastructure** (bucket, database, domains) is OpenTofu in [`tofu/`](./tofu/),
  the source of truth for what exists.
- **Code** is wrangler (`web/`), via `npx wrangler deploy`.
- **Data** (image bytes, metadata rows) is the scripts in this directory.

All three authenticate with one account-owned `CLOUDFLARE_API_TOKEN`. There is no
`wrangler login` step anymore; export the token and every tool uses it.

```bash
export CLOUDFLARE_API_TOKEN=...   # account-owned, scoped; see tofu/README.md
```

## Provision or change infrastructure

See [`tofu/README.md`](./tofu/README.md). The first run imports the existing
production resources into state (brownfield), so nothing is recreated; after that
it is ordinary `tofu plan` / `tofu apply`. The R2 bucket, D1 database, and apex
domain carry `prevent_destroy`, so Tofu refuses to wipe data on a stray plan.

## R2 bulk upload (~50 GB)

Use rclone with R2's S3-compatible API:

```bash
# Configure once (rclone config; see https://rclone.org/s3/#cloudflare-r2)
rclone copy F:/ffffound/out/images r2:ffffound-images \
    --transfers 32 --checkers 16 --progress
```

Egress is free out of R2 via Cloudflare's CDN, so this is the only bandwidth cost
for the project.

## D1 import (~3 GB SQLite)

The bucket and database themselves are provisioned by Tofu; this loads rows into
the existing database. D1 caps single SQL imports around the MB range, so the
parser DB needs to be chunked:

```bash
# 1. Run stitch to populate r2_key + backfill users.save_count
python -m parser.stitch out/full.db

# 2. Export D1-friendly SQL chunks (one file per table, ~500K rows each)
python -m parser.export_d1 out/full.db ./out/d1-chunks/

# 3. Apply each chunk to remote D1
for f in out/d1-chunks/*.sql; do
  npx wrangler d1 execute ffffound2 --remote --file "$f"
done
```

History note: the database was originally region-pinned at create time (`--location
wnam`) after an early attempt landed in OC/Sydney during datacenter maintenance and
took the site down. The database now exists and is imported by Tofu, so the region
is fixed; this is recorded only so the lesson is not lost.

## Deploy the Worker

```bash
cd web
npx wrangler deploy
```

## Cache purge

The Worker sets long `Cache-Control` headers, so deployed template changes are not
automatically reflected in browsers or the edge cache. Purge is manual, to avoid
no-op purges that count against the API budget:

```bash
# ZONE_ID is the zone_id in infra/tofu/terraform.tfvars.
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

Run it after a `wrangler deploy` that changed code or templates, or after a D1
backfill that should be visible immediately. For a surgical purge, swap
`purge_everything` for `{"files":["https://ffffound.online/", ...]}`.

## Deploy checklist

```
[ ] export CLOUDFLARE_API_TOKEN
[ ] (infra changed) cd infra/tofu && tofu plan  # no destroys/replaces && tofu apply
[ ] local smoke test passes (npm run dev + curl checks)
[ ] cd web && npx wrangler deploy
[ ] (templates or data changed) curl ... purge_cache
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

If traffic spikes, Cloudflare's edge cache absorbs almost everything and only the
cold cache misses hit D1.
