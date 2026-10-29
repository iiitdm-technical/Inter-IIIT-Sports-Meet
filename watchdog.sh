#!/usr/bin/env bash
# Keeps the Inter-IIIT Sports Meet site running. Run from cron (every 2
# minutes and @reboot) so PM2 lives outside any SSH session, which this
# shared server can clean up. Skips while ./update.sh is deploying.
set -u
ROOT="$HOME/.local/share/inter-iiit"
LOG="$ROOT/watchdog.log"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
exec 8>"$ROOT/watchdog.lock"; flock -n 8 || exit 0
exec 9>>"$ROOT/update.lock"; flock -n 9 || exit 0   # a deploy is running

healthy() {
  curl -s -o /dev/null -m 10 -w '%{http_code}' -H 'Cookie: inter_iiit_session=watchdog' \
    http://127.0.0.1:8010/api/auth/me | grep -q '^200$'
}
healthy && exit 0
sleep 20; healthy && exit 0   # give a restarting process a moment

echo "$(date -Is) site not responding on 8010; restoring" >> "$LOG"
pm2 resurrect >> "$LOG" 2>&1
sleep 15
if ! healthy; then
  pm2 delete sports >/dev/null 2>&1
  pm2 start "$ROOT/current/ecosystem.config.cjs" --only sports >> "$LOG" 2>&1 && pm2 save >> "$LOG" 2>&1
  sleep 15
fi
if healthy; then echo "$(date -Is) restored" >> "$LOG"; else echo "$(date -Is) STILL DOWN" >> "$LOG"; fi
