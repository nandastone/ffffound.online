# Non-secret Cloudflare IDs. The API token is NOT here; it is read from the
# CLOUDFLARE_API_TOKEN environment variable.

account_id = "3b332f5c8f46d7a05e3ff56e999c8be6"

# Zone ID for ffffound.online. Fetch once with:
#   curl -s "https://api.cloudflare.com/client/v4/zones?name=ffffound.online" \
#     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq -r '.result[0].id'
zone_id = "040f8095194476439d9cdb9cb19bbeb5"
