# DreamHost updates

This project is hosted through SSH alias `inter-iiit-dreamhost`, not the Oracle/zapdos.me VPS used by other projects. DreamHost's managed web proxy forwards to the `sports` PM2 application on `0.0.0.0:8010`; the updater does not change the web proxy, DNS, or other PM2 apps.

## Deploy latest main

```bash
ssh inter-iiit-dreamhost
cd ~/allindiaiiitsportsmeet.iiitdm.ac.in/Inter-IIIT-Sports-Meet
./update.sh
```

Use Node 22 with `git`, `npm`, `pm2`, `curl`, `flock`, and `tar` on PATH. The Git checkout must be clean and on `main`; the updater refuses to stash, reset, or discard changes. It pulls with `git pull --ff-only origin main` and requires HEAD to match `origin/main`, so unpublished local commits cannot accidentally be deployed. There is no GitHub auto-deployment: run this command after pushing changes.

The checkout is the **deployment control repository**, not PM2's runtime directory. The script:

1. Locks this project's updater to prevent concurrent deployments.
2. Fast-forwards the checkout to `main` and archives that exact commit into a new private release directory.
3. Copies the protected shared `.env` to the new release, then runs `npm ci`, lint, unit tests, and the production webpack build.
4. Checks the configured database/accounts and object storage with `env:check` (including a temporary storage upload/read/delete).
5. Starts a private preview and checks both the home page and a database-backed session lookup using an invalid token, without signing in or changing application data.
6. Replaces **only** PM2's `sports` process with the new release. Explicit replacement avoids PM2 retaining the old absolute script path.
7. Verifies the PM2 working directory, script path, local and public HTTP checks; updates `current` and saves the PM2 process list.

## Keeping the site running (watchdog)

PM2 started from an SSH login lives inside that login's session, which this shared server can clean up (the site went down this way on 27 and 28 Oct, with no crash or out-of-memory record). `watchdog.sh` runs from cron instead, like the long-running services on this server: every 2 minutes it checks `http://127.0.0.1:8010/api/auth/me`, and if the site does not answer it runs `pm2 resurrect` (or starts `current/ecosystem.config.cjs`). It skips while `./update.sh` holds the deploy lock and logs restarts to `~/.local/share/inter-iiit/watchdog.log`. Install once:

```bash
(crontab -l 2>/dev/null | grep -v 'Inter-IIIT-Sports-Meet/watchdog.sh'
 echo '*/2 * * * * $HOME/allindiaiiitsportsmeet.iiitdm.ac.in/Inter-IIIT-Sports-Meet/watchdog.sh'
 echo '@reboot sleep 30 && $HOME/allindiaiiitsportsmeet.iiitdm.ac.in/Inter-IIIT-Sports-Meet/watchdog.sh') | crontab -
```

To move an SSH-started PM2 under cron right away, run `pm2 kill`; the watchdog restores the site within about 2 minutes.

## Storage limit (3 GB)

The institute allows **3 GB in total** for the website: application files, uploaded documents and the database. Uploads are limited to **1 MB per file** and payment receipts to **200 MB in total** (`PROOF_STORAGE_MAX_MB`); an upload that would pass the cap is refused with HTTP 507. To stay well inside the limit the updater:

- removes build-only dependencies (`npm prune --omit=dev`), the Next build cache and non-runtime folders from each release before it starts (about 450 MB per release instead of 960 MB);
- after a successful deployment, deletes every release except the active one and the previous one, and clears the npm cache;
- runs `npm run storage:check`, which measures the deployment folder, the Git checkout and the MySQL database against `STORAGE_LIMIT_MB` (default 3072), warns at 80%, and writes `storage-usage.json` next to `uploads/`. The admin dashboard shows that total plus live receipt and database sizes. Run `npm run storage:check -- --strict` to exit non-zero when over the limit.

Never keep `node_modules` or `.next` in the Git checkout; it is only the deployment control repository.

Build/test failures leave the live process untouched. Startup/health failures restore the previous MySQL app release. There is a brief interruption during the single-process PM2 switch; this is not a zero-downtime clustered deployment. Failed releases are kept until the next successful deployment, which removes all but the active and previous releases.

## Files and configuration

```text
~/allindiaiiitsportsmeet.iiitdm.ac.in/Inter-IIIT-Sports-Meet/  # Git main, update.sh
~/.local/share/inter-iiit/
  shared/.env                   # canonical protected production configuration
  releases/<timestamp>-<sha>/    # code, dependencies, build, copied .env, logs
  current -> releases/...       # last verified active release
  uploads/                      # payment proofs (PROOF_STORAGE=local), mode 700; back this up
  backups/                      # original migration backup/configuration
  update.lock                   # updater concurrency lock
```

The deployment root defaults to `$HOME/.local/share/inter-iiit`. The shared `.env` must already exist and point to **MySQL**; the updater never copies the historical Neon `.env` from the old checkout. Keep session secrets unchanged. Payment proofs live in `uploads/` (`PROOF_STORAGE=local`, `PROOF_STORAGE_DIR` pointing there), outside every release, so deployments and rollbacks keep them. The Neon storage settings remain only as an optional fallback (`PROOF_STORAGE=neon`). Database passwords in URLs must be percent-encoded so Next's `.env` expansion cannot alter `$` characters. Never commit `.env` files or backups.

PM2 uses the release's `ecosystem.config.cjs`: one `sports` process, production mode, automatic restart, and a 700 MB restart threshold. `pm2 save` persists the list; the updater does not install or alter operating-system startup services.

## Schema changes

Normal updates do **not** run SQL migrations, seed accounts, or copy data. If the new commit includes a reviewed, backward-compatible migration, explicitly run:

```bash
./update.sh --migrate
```

Take a database backup first. MySQL DDL is not generally transactional; an application rollback does **not** undo a database migration. Destructive/incompatible schema changes need a separate maintenance plan. Never rerun the PostgreSQL data transfer on the now-live MySQL database.

## Recovery

The updater attempts automatic **application-only** rollback to the previous release if replacement/health checks fail. It does not restore database data, rewrite the Git checkout to an older commit, or revert to PostgreSQL. If automatic recovery fails, inspect the updater output and PM2 logs, then start the known-good **MySQL** release's ecosystem file and run `pm2 save` after verification.

For an intentional manual rollback, identify a compatible previous release before stopping the current app:

```bash
pm2 describe sports
readlink -f ~/.local/share/inter-iiit/current
# Select a known-good MySQL release; do not select the old Neon checkout.
pm2 delete sports
pm2 start /absolute/path/to/previous/mysql-release/ecosystem.config.cjs --only sports
# Verify public HTTP and database-backed session lookup, then update current.
pm2 save
```

See `MYSQL_MIGRATION.md` for the original data cutover and protected PostgreSQL backups. After new MySQL writes, reverting to Neon without reconciling data would lose those writes.
