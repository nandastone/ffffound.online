variable "account_id" {
  type        = string
  description = "Cloudflare account that owns the ffffound resources."
}

variable "zone_id" {
  type        = string
  description = "Zone ID for ffffound.online. Used by the R2 and Worker custom domains."
}

variable "zone_name" {
  type        = string
  description = "Apex hostname served by the Worker."
  default     = "ffffound.online"
}

variable "images_domain" {
  type        = string
  description = "Hostname serving R2 image bytes directly. Must match IMAGES_BASE_URL in web/wrangler.toml."
  default     = "img.ffffound.online"
}

variable "worker_name" {
  type        = string
  description = "Worker script name. The script itself is shipped by wrangler, not Tofu."
  default     = "ffffound"
}

variable "r2_bucket_name" {
  type        = string
  description = "R2 bucket holding image bytes. Must match the IMAGES binding in web/wrangler.toml."
  default     = "ffffound-images"
}

variable "d1_database_name" {
  type        = string
  description = "D1 database name. Must match the DB binding in web/wrangler.toml."
  default     = "ffffound2"
}
