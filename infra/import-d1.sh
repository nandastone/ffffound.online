#!/usr/bin/env bash
# Apply chunked SQL files in out/d1-chunks/ to remote D1.
# Retries transient failures up to 3 times with exponential backoff.
# OR IGNORE in the chunks makes retries idempotent.
#
# Usage:
#   bash infra/import-d1.sh
#   PARALLEL=4 bash infra/import-d1.sh

set -uo pipefail

CHUNKS_DIR="${CHUNKS_DIR:-out/d1-chunks}"
PARALLEL="${PARALLEL:-2}"
DB="${DB:-ffffound}"
MAX_RETRIES=3

cd "$(dirname "$0")/.."

apply_one() {
    local f="$1"
    local attempt=0
    while [ $attempt -lt $MAX_RETRIES ]; do
        attempt=$((attempt + 1))
        if (cd web && npx wrangler d1 execute "$DB" --remote --file "../$f" >/dev/null 2>&1); then
            echo "  ok    $(basename "$f")"
            return 0
        fi
        if [ $attempt -lt $MAX_RETRIES ]; then
            sleep $((attempt * 2))   # 2s, 4s
        fi
    done
    echo "  FAIL  $(basename "$f")  (after $MAX_RETRIES attempts)" >&2
    return 1
}
export -f apply_one
export DB MAX_RETRIES

failed_files=()

for prefix in 00_users 01_images 02_image_related 03_saves; do
    files=( "$CHUNKS_DIR"/${prefix}_*.sql )
    if [ ! -f "${files[0]}" ]; then
        echo "no chunks for $prefix"
        continue
    fi
    n=${#files[@]}
    echo "[$(date +%H:%M:%S)] $prefix — applying $n chunks (PARALLEL=$PARALLEL)..."

    # Run; collect any FAIL lines from stderr.
    if [ "$PARALLEL" -le 1 ]; then
        for f in "${files[@]}"; do apply_one "$f" || failed_files+=("$f"); done
    else
        # xargs -P; failures land in stderr-captured tmp.
        tmperr=$(mktemp)
        printf '%s\n' "${files[@]}" | xargs -P "$PARALLEL" -I{} bash -c 'apply_one "$@"' _ {} 2> >(tee "$tmperr" >&2)
        # Parse FAIL lines back into the failed list.
        while IFS= read -r line; do
            if [[ "$line" == *"FAIL  "* ]]; then
                failed_files+=("$CHUNKS_DIR/$(echo "$line" | awk '{print $2}')")
            fi
        done < "$tmperr"
        rm -f "$tmperr"
    fi
    echo "[$(date +%H:%M:%S)] $prefix done."
done

if [ ${#failed_files[@]} -gt 0 ]; then
    echo
    echo "[$(date +%H:%M:%S)] Retrying ${#failed_files[@]} failed files sequentially..."
    still_failed=()
    for f in "${failed_files[@]}"; do
        apply_one "$f" || still_failed+=("$f")
    done
    if [ ${#still_failed[@]} -gt 0 ]; then
        echo
        echo "STILL FAILED after retry (${#still_failed[@]} files):"
        printf '  %s\n' "${still_failed[@]}"
        exit 1
    fi
fi

echo
echo "All chunks applied. Verifying counts:"
cd web
for tbl in users images image_related saves; do
    n=$(npx wrangler d1 execute "$DB" --remote --command "SELECT COUNT(*) AS n FROM $tbl" --json 2>/dev/null \
        | grep -oE '"n":[0-9]+' | head -1 | sed 's/.*://')
    printf "  %-15s %s\n" "$tbl:" "$n"
done
