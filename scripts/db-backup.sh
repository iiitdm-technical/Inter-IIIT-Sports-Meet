#!/usr/bin/env bash
# Snapshots the MySQL database to a compressed file and keeps the last
# 3 days of snapshots. Runs every 6 hours under PM2 (ecosystem.backup.config.cjs)
# on the DreamHost VPS, the only host the database accepts connections from.
#
#   Snapshots: $ROOT/backups/auto/inter-iiit-<UTC time>.sql.gz
#   Log:       $ROOT/backups/auto/backup.log
set -euo pipefail

ROOT="${INTER_IIIT_ROOT:-$HOME/.local/share/inter-iiit}"
ENV_FILE="$ROOT/shared/.env"
DIR="$ROOT/backups/auto"
LOG="$DIR/backup.log"
KEEP_MINUTES=$((3 * 24 * 60))

mkdir -p "$DIR"
chmod 700 "$DIR"
umask 077

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"; }

exec 7>"$DIR/.lock"
if ! flock -n 7; then log "SKIP another backup is still running"; exit 0; fi

CNF="$(mktemp)"
TMP=""
cleanup() { rm -f "$CNF"; if [ -n "$TMP" ]; then rm -f "$TMP"; fi; }
trap cleanup EXIT
trap 'log "FAIL backup stopped at line $LINENO"' ERR

# Read DATABASE_URL (percent-encoded) and write a private client config so the
# password never appears on a command line.
DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | tail -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
TLS_MODE="$(sed -n 's/^MYSQL_TLS_MODE=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'")"
[ -n "$DATABASE_URL" ] || { log "FAIL DATABASE_URL not found in $ENV_FILE"; exit 1; }

DB_NAME="$(DATABASE_URL="$DATABASE_URL" CNF="$CNF" node -e '
  const u = new URL(process.env.DATABASE_URL);
  const q = (v) => JSON.stringify(decodeURIComponent(v));
  require("fs").writeFileSync(process.env.CNF, [
    "[client]",
    `user=${q(u.username)}`,
    `password=${q(u.password)}`,
    `host=${q(u.hostname)}`,
    `port=${u.port || 3306}`,
    "",
  ].join("\n"), { mode: 0o600 });
  process.stdout.write(decodeURIComponent(u.pathname.slice(1)));
')"

SSL=()
case "$TLS_MODE" in
  require|required|REQUIRED) SSL=(--ssl-mode=REQUIRED) ;;
esac

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT="$DIR/inter-iiit-$STAMP.sql.gz"
TMP="$OUT.partial"
START=$(date +%s)

# --single-transaction gives a consistent InnoDB snapshot without locking
# the live site. --no-tablespaces avoids needing the PROCESS privilege.
mysqldump --defaults-extra-file="$CNF" "${SSL[@]}" \
  --single-transaction --quick --routines --triggers \
  --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 \
  "$DB_NAME" 2>>"$LOG" | gzip -9 > "$TMP"

gzip -t "$TMP"
zcat "$TMP" | tail -1 | grep -q "Dump completed" || { log "FAIL dump is incomplete"; exit 1; }
mv "$TMP" "$OUT"
TMP=""

SIZE=$(du -h "$OUT" | cut -f1)
log "OK $(basename "$OUT") $SIZE in $(( $(date +%s) - START ))s"

# Keep 3 days of snapshots (12 at 6-hour intervals).
find "$DIR" -maxdepth 1 -name 'inter-iiit-*.sql.gz' -mmin +"$KEEP_MINUTES" -print -delete \
  | while read -r old; do log "PRUNE $(basename "$old")"; done

# Keep the log to its last 2000 lines.
if [ "$(wc -l < "$LOG")" -gt 2000 ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
