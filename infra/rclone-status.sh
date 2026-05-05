#!/usr/bin/env bash
# Print upload progress: bucket size + count + percent of expected total.
# Run any time during the rclone copy to see how far we are.
RCLONE='/c/Users/nitch/AppData/Local/Microsoft/WinGet/Packages/Rclone.Rclone_Microsoft.Winget.Source_8wekyb3d8bbwe/rclone-v1.74.0-windows-amd64/rclone.exe'

EXPECTED_FILES=825640
EXPECTED_BYTES=53687091200    # ~50 GiB

echo "remote bucket (ffffound-images):"
"$RCLONE" size r2:ffffound-images

if tasklist //FI "IMAGENAME eq rclone.exe" //NH 2>/dev/null | grep -q rclone.exe; then
  echo
  echo "rclone process: alive"
else
  echo
  echo "rclone process: NOT running (finished or crashed)"
fi

echo
echo "expected total: $EXPECTED_FILES files / $((EXPECTED_BYTES / 1073741824)) GB"
