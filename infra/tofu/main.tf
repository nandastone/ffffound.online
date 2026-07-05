# ---------------------------------------------------------------------------
# Storage. The R2 bucket (image bytes) and D1 database (metadata) already exist
# in production with real data, so they are imported, never created. The
# prevent_destroy tripwire makes Tofu refuse rather than wipe data if a plan
# ever proposes a destroy or replace.
# ---------------------------------------------------------------------------

resource "cloudflare_r2_bucket" "images" {
  account_id = var.account_id
  name       = var.r2_bucket_name
  # location and jurisdiction are create-time only and intentionally omitted, so
  # the imported live values are adopted as-is. Confirm `tofu plan` shows no
  # replace after import.

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_d1_database" "metadata" {
  account_id = var.account_id
  name       = var.d1_database_name

  # Matches the live database (read replication off) so plan stays clean.
  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Image host. Serves R2 bytes directly at img.ffffound.online, bypassing the
# Worker so the CDN caches them and crawlers do not cost a Worker invocation
# per image.
#
# NOTE: cloudflare_r2_custom_domain does not support `import`. The hand-created
# attachment must be removed once in the dashboard so Tofu can create and own
# it. Safe to do before the new Worker ships: nothing references this hostname
# in production yet. The underlying CNAME is managed by this resource; do not
# declare a separate dns_record for it.
# ---------------------------------------------------------------------------

resource "cloudflare_r2_custom_domain" "images" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.images.name
  zone_id     = var.zone_id
  domain      = var.images_domain
  enabled     = true
}

# ---------------------------------------------------------------------------
# Worker custom domain. Maps the apex ffffound.online to the deployed Worker
# script. The script is shipped by wrangler; this resource only attaches the
# domain and manages the apex DNS record and certificate. prevent_destroy
# guards the live apex against an accidental detach and reattach.
# ---------------------------------------------------------------------------

resource "cloudflare_workers_custom_domain" "root" {
  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = var.zone_name
  service    = var.worker_name

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Bot management. robots.txt is self-managed in the Worker (seo.ts), so we turn
# off Cloudflare's managed robots.txt injection for a single source of truth.
# Every other bot setting is optional + computed and deliberately omitted so it
# keeps its live value. Notably ai_bots_protection stays "block", the WAF-level
# AI-scraper block enforced independently of robots.txt.
# ---------------------------------------------------------------------------

resource "cloudflare_bot_management" "this" {
  zone_id = var.zone_id

  # The actual change: stop Cloudflare prepending its managed robots.txt.
  is_robots_txt_managed = false

  # Pinned to current live values so the PUT that flips the line above cannot
  # reset them. ai_bots_protection = "block" is the WAF-level AI-scraper block,
  # enforced independently of robots.txt, and must be preserved.
  ai_bots_protection      = "block"
  content_bots_protection = "disabled"
  crawler_protection      = "disabled"
  enable_js               = false
  fight_mode              = false
}

# ---------------------------------------------------------------------------
# Edge crawler block. Bulk crawlers walk the ~1.1M /image/ pages and exhaust
# the Workers free-tier request cap, since every uncached page render is one
# Worker invocation. This rule blocks them at the edge, before the Worker runs,
# so they cost zero invocations. Search engines (Googlebot, Bingbot) are
# deliberately absent, so SEO is unaffected. This resource owns the whole
# http_request_firewall_custom entrypoint, so add future custom rules here, not
# in the dashboard.
#
# The list grows as new indexers find the trap: meta-webindexer/Ahrefs/Semrush
# (June 2026), then Claude-SearchBot/Amzn-SearchBot/BacklinksExtendedBot (July
# 2026, ~98% of Worker load at the time). Match precise tokens: block
# "claude-searchbot", NOT "claude-", so Claude-User (human-initiated fetches)
# still gets through.
# ---------------------------------------------------------------------------
locals {
  # Bulk crawlers to block. Matched case-insensitively against the User-Agent.
  blocked_crawler_uas = [
    "meta-webindexer", "ahrefsbot", "semrushbot",
    "claude-searchbot", "amzn-searchbot", "backlinksextendedbot",
  ]
}

resource "cloudflare_ruleset" "zone_custom_waf" {
  zone_id = var.zone_id
  name    = "ffffound custom rules"
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules = [{
    action      = "block"
    description = "Block bulk crawlers exhausting the Workers free-tier cap. Search engines unaffected."
    enabled     = true
    expression = join(" or ", [
      for ua in local.blocked_crawler_uas : "(lower(http.user_agent) contains \"${ua}\")"
    ])
  }]
}
