#!/usr/bin/env bash
# Sync the gitignored web tiles with their GCS mirror.
#   scripts/web_tiles.sh pull   restore tiles before `npm run build` / deploy
#   scripts/web_tiles.sh push   publish tiles after `export_web --tiles`
set -euo pipefail
cd "$(dirname "$0")/.."
LOCAL=frontend/public/data/v2/tiles
REMOTE=gs://solmate-13571-data/web/tiles
case "${1:-}" in
  pull) mkdir -p "$LOCAL"; gcloud storage rsync --recursive "$REMOTE" "$LOCAL" ;;
  push) gcloud storage rsync --recursive --delete-unmatched-destination-objects "$LOCAL" "$REMOTE" ;;
  *) echo "usage: $0 pull|push" >&2; exit 2 ;;
esac
echo "tiles: $(ls "$LOCAL" | wc -l) files in $LOCAL"
