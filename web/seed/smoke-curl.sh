#!/usr/bin/env bash
# Hit key Worker pages and print a one-line summary per URL.
# Run after `wrangler dev` is up at the default port (8787).

set -u
BASE="${1:-http://localhost:8787}"

check() {
  local label="$1" path="$2" expect="$3"
  local out status snippet
  out=$(curl -sS -o /tmp/smoke-body -w "%{http_code} %{size_download}" "$BASE$path" 2>&1) || { echo "[ERR] $label  $path  $out"; return; }
  read status size <<<"$out"
  if [ "$status" != "200" ]; then
    echo "[$status] $label  $path  ($size B)"
    return
  fi
  if grep -q "$expect" /tmp/smoke-body; then
    echo "[OK ] $label  $path  ($size B, found '$expect')"
  else
    echo "[??] $label  $path  ($size B, MISSING '$expect')"
    head -c 200 /tmp/smoke-body
    echo
  fi
}

# Pull a top image_id + its uploader from the local D1 to test against.
ID=$(cd "$(dirname "$0")/.." && npx wrangler d1 execute ffffound --local --command="SELECT image_id FROM images WHERE r2_key IS NOT NULL ORDER BY save_count DESC LIMIT 1" --json 2>/dev/null | grep -oE '[0-9a-f]{40}' | head -1)
USER=$(cd "$(dirname "$0")/.." && npx wrangler d1 execute ffffound --local --command="SELECT username FROM users ORDER BY save_count DESC LIMIT 1" --json 2>/dev/null | grep -oE '"results":\[\{"username":"[^"]+' | sed 's/.*"username":"//')

echo "BASE=$BASE  top image=$ID  top user=$USER"
echo

check "home"   "/"                 "ffffound"
check "image"  "/image/$ID"        "Quoted from"
check "user"   "/home/$USER"       "$USER"
check "404"    "/image/abc"        ""
