#!/usr/bin/env bash
# Sync the gitignored web tiles with their GCS mirror.
#   scripts/web_tiles.sh pull   restore tiles before `npm run build` / deploy
#   scripts/web_tiles.sh push   publish tiles after `export_web --tiles`
# Each tile set lives under its own content hash (model.json tiles.tileset), so publishing a
# new set before its pull request merges never changes what a deploy of main restores.
set -euo pipefail
cd "$(dirname "$0")/.."
LOCAL=frontend/public/data/v2/tiles
TILESET=$(python -c "import json; print(json.load(open('frontend/public/data/v2/model.json'))['tiles'].get('tileset', ''))")
if ! printf '%s' "$TILESET" | grep -qE '^[0-9a-f]{12}$'; then
  echo "model.json has no valid tiles.tileset; run: uv run python -m solmate.pipeline.export_web --tiles" >&2
  exit 1
fi
REMOTE="gs://solmate-13571-data/web/tilesets/$TILESET"
case "${1:-}" in
  pull) mkdir -p "$LOCAL"; gcloud storage rsync --recursive --delete-unmatched-destination-objects "$REMOTE" "$LOCAL" ;;
  push) gcloud storage rsync --recursive "$LOCAL" "$REMOTE" ;;
  *) echo "usage: $0 pull|push" >&2; exit 2 ;;
esac
echo "tileset $TILESET: $(ls "$LOCAL" | wc -l) files in $LOCAL"
