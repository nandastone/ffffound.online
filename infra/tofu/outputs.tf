# These exist to keep web/wrangler.toml in sync with what Tofu owns. After an
# apply, the bindings in wrangler.toml must match these values.

output "r2_bucket_name" {
  value       = cloudflare_r2_bucket.images.name
  description = "Feeds the IMAGES binding bucket_name in web/wrangler.toml."
}

output "d1_database_id" {
  value       = cloudflare_d1_database.metadata.uuid
  description = "Feeds database_id in web/wrangler.toml."
}

output "images_domain" {
  value       = cloudflare_r2_custom_domain.images.domain
  description = "Feeds IMAGES_BASE_URL in web/wrangler.toml, as https://<domain>."
}
