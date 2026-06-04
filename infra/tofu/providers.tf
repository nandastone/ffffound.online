terraform {
  required_version = ">= 1.6"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.19"
    }
  }
}

# Authenticates from the CLOUDFLARE_API_TOKEN environment variable. The token is
# never written to a file. In provider v5 the account scope is set per-resource
# via account_id, not on the provider block.
provider "cloudflare" {}
