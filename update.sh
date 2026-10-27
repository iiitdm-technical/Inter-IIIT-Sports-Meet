#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

usage() {
  cat <<'HELP'
Usage: ./update.sh [--migrate]

Fast-forward origin/main, build and verify an isolated release, then replace
the PM2 `sports` process. Runtime secrets come only from shared/.env under
UPDATE_DEPLOY_ROOT (default: $HOME/.local/share/inter-iiit).

Migrations are never run by default. --migrate explicitly runs
`npm run db:migrate`; database DDL changes are not rolled back with code.
Set UPDATE_PUBLIC_URL= to skip the public health check, or override the
default candidate port 18010 with UPDATE_CANDIDATE_PORT.

Storage (institute limit: 3 GB for the whole website): each release drops
its build-only dependencies and caches, and after a successful deployment
only the active and the previous release are kept. The npm cache is cleared
and `npm run storage:check` reports the total.
HELP
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

run_step() {
  if [[ -n "${release:-}" ]]; then
    printf '\n==> %s\n' "$*" | tee -a "$release/deploy.log"
    "$@" 2>&1 | tee -a "$release/deploy.log"
  else
    printf '\n==> %s\n' "$*"
    "$@"
  fi
}

do_migrate=0
for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --migrate) do_migrate=1 ;;
    *) die "unknown option: $arg (use --help)" ;;
  esac
done

for command_name in git node npm pm2 curl flock tar date mktemp readlink ln mv cp chmod rm sleep tee cat dirname mkdir; do
  command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
done

node_version=$(node --version)
case "$node_version" in
  v22.*) ;;
  *) die "Node.js 22.x is required (found $node_version)" ;;
esac

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
cd -- "$repo_dir"
repo_root=$(git rev-parse --show-toplevel) || die "run this from a Git checkout"
[[ "$repo_root" == "$repo_dir" ]] || die "update.sh must be at the Git repository root"

deploy_root_setting=${UPDATE_DEPLOY_ROOT:-"$HOME/.local/share/inter-iiit"}
mkdir -p -- "$deploy_root_setting"
deploy_root=$(cd -- "$deploy_root_setting" && pwd -P)
mkdir -p -- "$deploy_root/releases" "$deploy_root/shared"

exec 9>"$deploy_root/update.lock"
flock -n 9 || die "another update is already running for $deploy_root"

shared_env="$deploy_root/shared/.env"
[[ -f "$shared_env" && -r "$shared_env" && ! -L "$shared_env" ]] || die "required regular file is missing or unreadable: $shared_env"
[[ -L "$deploy_root/current" ]] || die "expected current to be a symlink to the active release: $deploy_root/current"
old_release=$(readlink -f -- "$deploy_root/current") || die "current is a broken symlink"
[[ -d "$old_release" && -f "$old_release/ecosystem.config.cjs" ]] || die "current does not point to a release with ecosystem.config.cjs"

branch=$(git branch --show-current)
[[ "$branch" == main ]] || die "deployments must run from the main branch (found ${branch:-detached HEAD})"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Git checkout must be clean, including untracked files"

run_step git pull --ff-only origin main
[[ "$(git branch --show-current)" == main ]] || die "checkout left the main branch after pull"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse refs/remotes/origin/main)" ]] || die "main contains commits not present on origin/main"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "checkout is not clean after pull"

short_sha=$(git rev-parse --short=12 HEAD)
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
release=$(mktemp -d "$deploy_root/releases/${timestamp}-${short_sha}.XXXXXX") || die "could not create a unique release directory"
printf 'Preparing release %s\n' "$release"

# Export only tracked source: never carry ignored local .env files or node_modules.
git archive --format=tar HEAD -- . \
  ':(exclude,glob).env*' ':(exclude,glob)**/.env*' \
  ':(exclude,glob)node_modules/**' ':(exclude,glob)**/node_modules/**' |
  tar -xf - -C "$release"
cp -- "$shared_env" "$release/.env"
chmod 600 "$release/.env"
[[ -f "$release/ecosystem.config.cjs" && -f "$release/package.json" ]] || die "release is missing its package or PM2 configuration"

run_step npm --prefix "$release" ci --include=dev
run_step npm --prefix "$release" run lint
run_step npm --prefix "$release" test
run_step npm --prefix "$release" run build -- --webpack
if (( do_migrate )); then
  printf '\nWARNING: --migrate may apply database DDL that this code rollback cannot undo.\n' | tee -a "$release/deploy.log" >&2
  run_step npm --prefix "$release" run db:migrate
fi
run_step npm --prefix "$release" run env:check

# Keep the release small: build tools, caches and non-runtime folders are
# not needed to serve the site (or to roll back to it later).
run_step npm --prefix "$release" prune --omit=dev
rm -rf -- "$release/.next/cache" "$release/reference" "$release/tests"

candidate_port=${UPDATE_CANDIDATE_PORT:-18010}
[[ "$candidate_port" =~ ^[0-9]{1,5}$ ]] || die "UPDATE_CANDIDATE_PORT must be an integer from 1024 to 65535 other than 8010"
candidate_port=$((10#$candidate_port))
(( candidate_port >= 1024 && candidate_port <= 65535 && candidate_port != 8010 )) || die "UPDATE_CANDIDATE_PORT must be an unused port from 1024 to 65535 other than 8010"
public_url=${UPDATE_PUBLIC_URL-https://allindiaiiitsportsmeet.iiitdm.ac.in}
if [[ -n "$public_url" ]]; then
  case "$public_url" in http://*|https://*) ;; *) die "UPDATE_PUBLIC_URL must be an HTTP(S) base URL" ;; esac
fi
node -e 'const net=require("node:net"); const port=Number(process.argv[1]); const server=net.createServer(); server.once("error", error=>{console.error(`Candidate port ${port} is unavailable (${error.code || "error"})`); process.exit(1)}); server.listen({host:"127.0.0.1",port,exclusive:true},()=>server.close(()=>process.exit(0)));' "$candidate_port" || die "candidate port check failed"
[[ -f "$release/node_modules/next/dist/bin/next" ]] || die "Next.js executable is missing after npm ci"

candidate_pid=
probe_body=
replacement_started=0
current_switched=0
deployment_committed=0

switch_current() {
  local target=$1 tmp="$deploy_root/.current.$$.$RANDOM"
  ln -s -- "$target" "$tmp"
  if ! mv -fT -- "$tmp" "$deploy_root/current"; then
    rm -f -- "$tmp"
    return 1
  fi
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM HUP
  set +e
  if [[ -n "$candidate_pid" ]]; then
    kill "$candidate_pid" 2>/dev/null
    wait "$candidate_pid" 2>/dev/null
  fi
  [[ -z "$probe_body" ]] || rm -f -- "$probe_body"
  if (( replacement_started && ! deployment_committed )); then
    printf '\nDeployment verification failed; restoring the previous PM2 release.\n' >&2
    if (( current_switched )); then
      switch_current "$old_release" || printf 'WARNING: could not restore current symlink to %s\n' "$old_release" >&2
    fi
    pm2 delete sports >/dev/null 2>&1 || true
    if pm2 start "$old_release/ecosystem.config.cjs" --only sports; then
      pm2 save || printf 'WARNING: PM2 rollback succeeded but pm2 save failed.\n' >&2
    else
      printf 'WARNING: PM2 could not restart the previous release at %s.\n' "$old_release" >&2
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT; trap 'exit 143' TERM; trap 'exit 129' HUP

probe_http() {
  local base=${1%/} status
  status=$(curl --silent --show-error --fail --max-time 8 \
    -H 'Cookie: __Host-inter_iiit_session=deploy-probe-invalid; inter_iiit_session=deploy-probe-invalid' \
    --output "$probe_body" --write-out '%{http_code}' "$base/api/auth/me") || return 1
  [[ "$status" == 200 ]] || return 1
  node -e 'let body=""; process.stdin.setEncoding("utf8"); process.stdin.on("data", chunk=>body+=chunk); process.stdin.on("end", ()=>{try { if (JSON.parse(body).authenticated !== false) process.exitCode=1; } catch { process.exitCode=1; }});' < "$probe_body" || return 1
  status=$(curl --silent --show-error --fail --max-time 8 --output /dev/null --write-out '%{http_code}' "$base/") && [[ "$status" == 200 ]]
}

wait_for_probe() {
  local label=$1 base=$2 pid=${3:-} attempt=1
  local attempts=${UPDATE_PROBE_ATTEMPTS:-30} interval=${UPDATE_PROBE_INTERVAL:-2}
  [[ "$attempts" =~ ^[0-9]{1,3}$ ]] || die "UPDATE_PROBE_ATTEMPTS must be an integer from 1 to 999"
  attempts=$((10#$attempts))
  (( attempts > 0 )) || die "UPDATE_PROBE_ATTEMPTS must be a positive integer"
  [[ "$interval" =~ ^[0-9]{1,2}$ ]] || die "UPDATE_PROBE_INTERVAL must be an integer from 0 to 99"
  interval=$((10#$interval))
  while (( attempt <= attempts )); do
    if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
      printf '%s candidate process exited before becoming healthy.\n' "$label" >&2
      return 1
    fi
    if probe_http "$base"; then
      printf 'PASS %s: homepage and DB-backed unauthenticated-session endpoint\n' "$label"
      return 0
    fi
    (( attempt == attempts )) || sleep "$interval"
    attempt=$((attempt + 1))
  done
  printf 'Health check failed for %s\n' "$label" >&2
  return 1
}

probe_body=$(mktemp "$release/.probe.XXXXXX")
(
  cd -- "$release"
  exec node "$release/node_modules/next/dist/bin/next" start --hostname 127.0.0.1 --port "$candidate_port"
) >"$release/candidate.log" 2>&1 &
candidate_pid=$!
wait_for_probe candidate "http://127.0.0.1:$candidate_port" "$candidate_pid" || die "candidate release failed its health check; see $release/candidate.log"
kill "$candidate_pid" 2>/dev/null || true
wait "$candidate_pid" 2>/dev/null || true
candidate_pid=
rm -f -- "$probe_body"
probe_body=

replacement_started=1
run_step pm2 delete sports
run_step pm2 start "$release/ecosystem.config.cjs" --only sports

verify_pm2_paths() {
  pm2 jlist | node -e '
const path=require("node:path"); let input="";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk=>input+=chunk);
process.stdin.on("end", ()=>{
  try {
    const expectedCwd=path.resolve(process.argv[1]);
    const expectedScript=path.resolve(process.argv[2]);
    const apps=JSON.parse(input).filter(app=>app.name === "sports");
    if (apps.length !== 1) throw new Error("expected exactly one sports process");
    const app=apps[0], env=app.pm2_env || {};
    const actualScript=app.pm_exec_path || env.pm_exec_path || "";
    if (env.status !== "online" || path.resolve(env.pm_cwd || "") !== expectedCwd || path.resolve(actualScript) !== expectedScript) {
      throw new Error("sports process is not online from the new release paths");
    }
  } catch (error) { console.error(`PM2 verification failed: ${error.message}`); process.exitCode=1; }
});
' "$release" "$release/node_modules/next/dist/bin/next"
}

pm2_attempt=1
while ! verify_pm2_paths >/dev/null 2>&1; do
  (( pm2_attempt < 30 )) || die "PM2 is not running the expected release"
  sleep 1
  pm2_attempt=$((pm2_attempt + 1))
done

probe_body=$(mktemp "$release/.probe.XXXXXX")
wait_for_probe "local port 8010" "http://127.0.0.1:8010" || die "new PM2 release failed its local health check"
if [[ -n "$public_url" ]]; then
  wait_for_probe "public URL" "$public_url" || die "new PM2 release failed its public health check"
fi
rm -f -- "$probe_body"
probe_body=

switch_current "$release" || die "could not atomically switch current to the verified release"
current_switched=1
run_step pm2 save
deployment_committed=1
printf '\nDeployment successful: %s\n' "$release"

# Storage: keep only the active release and the previous one (for rollback).
removed=0
for entry in "$deploy_root"/releases/*; do
  [[ -d "$entry" && ! -L "$entry" ]] || continue
  resolved=$(readlink -f -- "$entry") || continue
  [[ "$resolved" == "$release" || "$resolved" == "$old_release" ]] && continue
  rm -rf -- "$resolved" && removed=$((removed + 1))
done
printf 'Removed %d older release(s); kept the active and previous releases.\n' "$removed"
npm cache clean --force >/dev/null 2>&1 || printf 'WARNING: could not clear the npm cache.\n' >&2
run_step npm --prefix "$release" run storage:check || printf 'WARNING: storage check failed; run npm run storage:check manually.\n' >&2
