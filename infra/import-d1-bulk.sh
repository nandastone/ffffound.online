#!/usr/bin/env bash
# Apply ./out/d1-bulk/*.sql to remote D1, sequentially, with retries.
# OR IGNORE in the chunks makes retries idempotent.

set -uo pipefail
DB="${DB:-ffffound}"
MAX_RETRIES=3
BULK="${BULK:-out/d1-bulk}"

cd "$(dirname "$0")/.."

apply_one() {
    local f="$1"
    local size_mb=$(($(wc -c < "$f") / 1024 / 1024))
    local attempt=0
    while [ $attempt -lt $MAX_RETRIES ]; do
        attempt=$((attempt + 1))
        printf "[$(date +%H:%M:%S)] %s (%dMB) attempt %d ... " "$(basename "$f")" "$size_mb" "$attempt"
        if (cd web && npx wrangler d1 execute "$DB" --remote --file "../$f" 2>&1 | grep -q "rows_written"); then
            echo "ok"
            return 0
        fi
        echo "FAIL"
        if [ $attempt -lt $MAX_RETRIES ]; then sleep $((attempt * 5)); fi
    done
    echo "[$(date +%H:%M:%S)] PERMANENT FAILURE: $f" >&2
    return 1
}

failed=()
for f in "$BULK"/*.sql; do
    apply_one "$f" || failed+=("$f")
done

if [ ${#failed[@]} -gt 0 ]; then
    echo
    echo "FAILED files (${#failed[@]}):" >&2
    printf '  %s\n' "${failed[@]}" >&2
    exit 1
fi

echo
echo "All bulk files applied. Final counts:"
cd web
npx wrangler d1 execute "$DB" --remote --command "SELECT 'users' AS t, COUNT(*) AS n FROM users UNION ALL SELECT 'images', COUNT(*) FROM images UNION ALL SELECT 'image_related', COUNT(*) FROM image_related UNION ALL SELECT 'saves', COUNT(*) FROM saves" 2>&1 | grep -E '"t"|"n"'
