#!/bin/bash
# Sync auth-server release assets from Wings shared storage.
# Wings is the manifest-sync owner; auth pulls the already-extracted release/latest
# files so it never downloads or extracts a full server zip itself.
set -euo pipefail

AUTH_ROOT="${AUTH_ROOT:-/var/www/traefik}"
WINGS_HOST="${WINGS_HOST:-root@149.50.101.214}"
WINGS_RELEASE_DIR="${WINGS_RELEASE_DIR:-/opt/hytale-shared/versions/release/latest}"
ASSETS_PATH="${ASSETS_PATH:-$AUTH_ROOT/hytale-assets/Assets.zip}"
DOWNLOADS_DIR="${DOWNLOADS_DIR:-$AUTH_ROOT/hytale-auth-data/downloads}"
STATE_DIR="${STATE_DIR:-$AUTH_ROOT/hytale-auth-data/release-sync}"
REDIS_CONTAINER="${REDIS_CONTAINER:-hytale-kvrocks}"
REDIS_PORT="${REDIS_PORT:-6666}"
COMPOSE_DIR="${COMPOSE_DIR:-$AUTH_ROOT}"
AUTH_SERVICE="${AUTH_SERVICE:-hytale-auth}"
RESTART_AUTH="${RESTART_AUTH:-1}"
RSYNC_BWLIMIT="${RSYNC_BWLIMIT:-20000}"
LOCK_FILE="${LOCK_FILE:-/tmp/sync-release-assets.lock}"
LOG_PREFIX="[sync-release-assets]"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    echo "$LOG_PREFIX another sync is already running"
    exit 0
fi

mkdir -p "$(dirname "$ASSETS_PATH")" "$DOWNLOADS_DIR" "$STATE_DIR"

echo "$LOG_PREFIX starting at $(date)"

remote_info="$(
    ssh -o BatchMode=yes -o ConnectTimeout=15 "$WINGS_HOST" \
        "set -e; jar=\$(readlink -f '$WINGS_RELEASE_DIR/HytaleServer.jar'); assets=\$(readlink -f '$WINGS_RELEASE_DIR/Assets.zip'); test -f \"\$jar\"; test -f \"\$assets\"; version=\$(basename \$(dirname \"\$jar\")); sha_file=\$(dirname \"\$jar\")/.sha256; sha=''; [ -f \"\$sha_file\" ] && sha=\$(cat \"\$sha_file\"); printf '%s\t%s\t%s\t%s\n' \"\$version\" \"\$sha\" \"\$jar\" \"\$assets\""
)"

IFS=$'\t' read -r version sha256 remote_jar remote_assets <<< "$remote_info"
if [ -z "$version" ] || [ -z "$remote_jar" ] || [ -z "$remote_assets" ]; then
    echo "$LOG_PREFIX ERROR: could not resolve Wings release/latest" >&2
    exit 1
fi

current_version="$(cat "$STATE_DIR/release.version" 2>/dev/null || true)"
current_sha="$(cat "$STATE_DIR/release.sha256" 2>/dev/null || true)"

if [ "$current_version" = "$version" ] && [ "$current_sha" = "$sha256" ] \
    && [ -f "$ASSETS_PATH" ] && [ -f "$DOWNLOADS_DIR/HytaleServer.jar" ]; then
    echo "$LOG_PREFIX release $version already installed"
    exit 0
fi

echo "$LOG_PREFIX syncing release $version from $WINGS_HOST"

rsync_common=(-avzL --partial --inplace --timeout=60 --bwlimit="$RSYNC_BWLIMIT")
rsync "${rsync_common[@]}" "$WINGS_HOST:$remote_assets" "$ASSETS_PATH.tmp"
rsync "${rsync_common[@]}" "$WINGS_HOST:$remote_jar" "$DOWNLOADS_DIR/HytaleServer.jar.tmp"

mv "$ASSETS_PATH.tmp" "$ASSETS_PATH"
mv "$DOWNLOADS_DIR/HytaleServer.jar.tmp" "$DOWNLOADS_DIR/HytaleServer.jar"
chmod 0644 "$ASSETS_PATH" "$DOWNLOADS_DIR/HytaleServer.jar"

printf '%s\n' "$version" > "$STATE_DIR/release.version"
printf '%s\n' "$sha256" > "$STATE_DIR/release.sha256"

# Force /download/{file} to serve local synced files instead of stale external redirects.
settings_json="$(
    docker exec "$REDIS_CONTAINER" redis-cli -p "$REDIS_PORT" GET settings:global 2>/dev/null \
    | python3 -c 'import json,sys; raw=sys.stdin.read().strip(); data=json.loads(raw) if raw else {}; data["downloadLinks"]={}; print(json.dumps(data,separators=(",",":")))'
)" || settings_json='{"downloadLinks":{}}'
printf '%s' "$settings_json" | docker exec -i "$REDIS_CONTAINER" redis-cli -p "$REDIS_PORT" -x SET settings:global >/dev/null
echo "$LOG_PREFIX cleared external download redirects"

if [ "$RESTART_AUTH" = "1" ] && [ -f "$COMPOSE_DIR/compose.yaml" ]; then
    (cd "$COMPOSE_DIR" && docker compose restart "$AUTH_SERVICE")
    echo "$LOG_PREFIX restarted $AUTH_SERVICE"
fi

jar_mb=$(( $(stat -c%s "$DOWNLOADS_DIR/HytaleServer.jar" 2>/dev/null || stat -f%z "$DOWNLOADS_DIR/HytaleServer.jar") / 1024 / 1024 ))
assets_mb=$(( $(stat -c%s "$ASSETS_PATH" 2>/dev/null || stat -f%z "$ASSETS_PATH") / 1024 / 1024 ))
echo "$LOG_PREFIX installed release $version: HytaleServer.jar ${jar_mb}MB, Assets.zip ${assets_mb}MB"
echo "$LOG_PREFIX finished at $(date)"
