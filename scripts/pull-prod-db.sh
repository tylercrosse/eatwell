#!/usr/bin/env bash
# Copy the production SQLite DB (and optionally photos) from Fly into local dev.
#
#   scripts/pull-prod-db.sh            # DB only
#   scripts/pull-prod-db.sh --photos   # DB + uploaded photos
#
# The current local DB is backed up first (data/app.db.bak-<timestamp>), so the
# overwrite is always reversible. The app uses SQLite's default rollback journal
# (not WAL), so a single-file copy is consistent when no write is mid-flight.
set -euo pipefail

APP="calorie-tracker-dawn-thunder-2086"
REMOTE_DB="/data/app.db"
LOCAL_DB="data/app.db"

cd "$(dirname "$0")/.."
mkdir -p data

# The machine auto-stops when idle (min_machines_running = 0), so wake it first.
echo "Ensuring machine is started ..."
ids=$(fly machines list --app "$APP" --json | python3 -c 'import sys,json; print(" ".join(m["id"] for m in json.load(sys.stdin)))')
[ -n "$ids" ] && fly machine start --app "$APP" $ids >/dev/null

ts=$(date +%Y%m%d-%H%M%S)

# fly ssh sftp refuses to overwrite, so back up then remove the destination first.
if [ -f "$LOCAL_DB" ]; then
  cp "$LOCAL_DB" "$LOCAL_DB.bak-$ts"
  echo "Backed up local DB -> $LOCAL_DB.bak-$ts"
  rm -f "$LOCAL_DB"
fi

echo "Pulling $REMOTE_DB from $APP ..."
fly ssh sftp get "$REMOTE_DB" "$LOCAL_DB" --app "$APP"
echo "Local DB is now a copy of prod."

if [ "${1:-}" = "--photos" ]; then
  if [ -d "data/photos" ]; then
    mv "data/photos" "data/photos.bak-$ts"
    echo "Moved existing photos -> data/photos.bak-$ts"
  fi
  echo "Pulling photos (recursive) ..."
  fly ssh sftp get -R "/data/photos" "data" --app "$APP"
  echo "Photos synced."
fi
