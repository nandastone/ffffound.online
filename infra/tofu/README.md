# ffffound infrastructure (OpenTofu)

Durable Cloudflare infrastructure for ffffound, managed declaratively. Replaces
the manual dashboard clicks and `wrangler login` that used to live in
`../DEPLOY.md`.

## Division of labour

- **Tofu (here)** owns durable resources: the R2 bucket, the `img.ffffound.online`
  custom domain, the D1 database, and the `ffffound.online` Worker custom domain.
- **wrangler** ships the Worker *code* (`cd ../../web && npx wrangler deploy`). Tofu
  does not manage the script or its bindings; those live in `web/wrangler.toml`.
- **The scripts in `../`** move *data* (rclone to R2, SQL import to D1). Tofu manages
  whether the bucket and database exist, not their contents.

## Credential

One account-owned API token (Account → Manage Account → API Tokens) with:
Workers Scripts:Edit, Workers R2 Storage:Edit, D1:Edit, Account Settings:Read, and
on the ffffound.online zone: Zone:Read, DNS:Edit, Workers Routes:Edit, Cache
Purge:Purge.

```bash
export CLOUDFLARE_API_TOKEN=...   # read by both tofu and wrangler
```

Then fill `zone_id` in `terraform.tfvars`:

```bash
curl -s "https://api.cloudflare.com/client/v4/zones?name=ffffound.online" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r '.result[0].id'
```

## First-time adoption (brownfield import)

These resources already exist in production. We import them into state and never
recreate them. `account_id` and the D1 UUID are already known.

```bash
tofu init

tofu import cloudflare_r2_bucket.images \
  "3b332f5c8f46d7a05e3ff56e999c8be6/ffffound-images/default"

tofu import cloudflare_d1_database.metadata \
  "3b332f5c8f46d7a05e3ff56e999c8be6/7920c686-6b27-4659-9411-b1c088760552"

# The Worker domain import ID uses the opaque domain ID, not the hostname. Fetch it:
DOMAIN_ID=$(curl -s \
  "https://api.cloudflare.com/client/v4/accounts/3b332f5c8f46d7a05e3ff56e999c8be6/workers/domains" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | jq -r '.result[] | select(.hostname=="ffffound.online") | .id')
tofu import cloudflare_workers_custom_domain.root \
  "3b332f5c8f46d7a05e3ff56e999c8be6/$DOMAIN_ID"
```

`cloudflare_r2_custom_domain` cannot be imported (provider limitation). Remove the
hand-created `img.ffffound.online` attachment once (dashboard → R2 →
ffffound-images → Settings → Custom Domains) so the apply below creates and owns
it. Safe to do before the new Worker ships: production does not use that hostname
yet.

### The plan gate

```bash
tofu plan
```

Required outcome: the only create is `cloudflare_r2_custom_domain.images`, with
**no destroys and no replaces**. If the plan proposes replacing the bucket, the
database, or the Worker domain, STOP and reconcile the config to the live resource.
The `prevent_destroy` tripwires will also hard-fail the apply in that case, by
design.

```bash
tofu apply
```

## Ongoing changes

Edit the `.tf` files, then `tofu plan` and `tofu apply`. Keep `web/wrangler.toml`
in sync with `tofu output` (bucket name, D1 id, image domain).

## Deploy code and purge (after infra is in place)

```bash
cd ../../web
npx wrangler deploy                       # ships code, reads CLOUDFLARE_API_TOKEN

# Purge the edge cache so cached HTML stops referencing stale image URLs.
# ZONE_ID is the zone_id from terraform.tfvars.
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}'
```

## State

State is local for now (`terraform.tfstate`, gitignored). For CI and durability,
move it to an R2 backend (S3-compatible) once R2 S3 credentials exist:
`tofu init -migrate-state` with a backend block. Until then keep the state file
backed up; it can always be rebuilt by re-running the imports above.
