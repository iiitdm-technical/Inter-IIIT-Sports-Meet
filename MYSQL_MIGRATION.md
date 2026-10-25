# PostgreSQL → MySQL migration

## Decisions

- Keep Drizzle, use `mysql2` for application queries; retain `pg` only for the one-time transfer.
- Target: assigned MySQL 8.0.45 database `inter_iiit_2026` on `sports.iiitdm.ac.in`, reached from SSH alias `inter-iiit-dreamhost`.
- Preserve all nine application tables, primary IDs, bcrypt hashes, draft revisions, session hashes, rate counters, audit history and payment-proof object keys. Do **not** seed imported accounts or reset passwords.
- Keep Neon Object Storage and every existing storage variable unchanged. SQL transfer does not move objects.
- Use signed `INT AUTO_INCREMENT`, InnoDB, JSON, and UTC `DATETIME(6)` to preserve PostgreSQL microseconds. JavaScript Date values still have millisecond precision, as they did with `pg`.
- All tables use `utf8mb4_0900_bin`: case-sensitive, accent-sensitive, NO PAD. Identifier equality stays case-sensitive, while admin substring searches use explicit `LOWER(...) LIKE LOWER(...)`.
- Remote TLS defaults to certificate and hostname verification. The assigned server has an auto-generated, untrusted certificate; the operator explicitly approved `MYSQL_TLS_MODE=require` for encrypted **but unauthenticated** TLS. This is vulnerable to active interception. Prefer a provider-supported trusted certificate when available. Never use `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Migration histories

`src/db/migrations` is a fresh **MySQL** history. `src/db/postgresql-migrations` is the archived PostgreSQL history for recovery/reference; do not apply it to MySQL or copy PostgreSQL's Drizzle journal into the destination.

Drizzle's schema model does not encode table-level engine/collation. Review future generated `CREATE TABLE` statements and retain `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_bin`, particularly on foreign-key string columns.

## Preparation and rehearsal

1. Use Node 22; run `npm ci`, `npm test`, `npm run lint`, and `npm run build -- --webpack`.
2. Apply `npm run db:migrate` with `DATABASE_URL` set explicitly to the target MySQL database. Percent-encode special characters in credentials; never paste passwords into committed files or command arguments. Use protected environment files or SSH stdin.
3. For isolated behavioral tests, set `TEST_DATABASE_URL` to a disposable MySQL database and run `npm run test:db`. Never use the assigned production destination for test fixtures.
4. Run API smoke tests with an isolated MySQL database and separate test object-storage endpoint. They write registrations and objects. E2E screen tests mock the API and require a running server.
5. Rehearse data transfer between disposable PostgreSQL and MySQL databases using `tests/transfer-integration.mjs`; see its header for opt-in variables. This must exercise JSON, dates, booleans, explicit IDs, all foreign keys, dry-run safety and rollback.

## Transfer tool

The tool does not load `.env` files or infer endpoints from `DATABASE_URL`:

```bash
# Set through a secure environment, not shell history:
# SOURCE_DATABASE_URL = the existing PostgreSQL URL
# TARGET_DATABASE_URL = the new MySQL URL
# MYSQL_TLS_MODE=require only for the explicitly approved DreamHost target
npm run db:transfer:mysql
```

Default mode is read-only: it validates both schemas, reports counts, and compares canonical row checksums when counts match. Differing counts before an initial import are expected, not proof of data equivalence. The destination's application tables must be empty for an apply. The Drizzle migration table is allowed and not transferred.

The tool copies in foreign-key order, in batches, from a read-only PostgreSQL REPEATABLE READ snapshot. Inserts and count/checksum validation occur inside one InnoDB transaction. Any pre-commit failure rolls the inserted rows back. Auto-increment reservations may still advance after a failed transaction; that is normal and does not create partial rows. No foreign keys are disabled, and no tables are truncated or dropped.

```bash
# Only after independently stopping ALL source writers:
npm run db:transfer:mysql -- --apply --writes-frozen
```

`--writes-frozen` is an operator acknowledgment, not an automated lock. A snapshot alone does not capture later source writes. After import, rerun the read-only mode while writes remain frozen and require matching counts and checksums on every table.

If a network error makes COMMIT ambiguous, do not retry apply blindly. Run read-only verification first. A nonempty target is never silently merged or overwritten.

## Production cutover (coordinate first)

1. Stage the MySQL-compatible app separately from the current live release. Build it before downtime using the preserved app configuration, storage credentials and `SESSION_SECRET`. Do not change the active app's files or environment during preparation.
2. Take a recoverable PostgreSQL backup and retain the old app/release and protected configuration. Check that no other service writes to the source database.
3. Announce maintenance; stop the specific sports app/writers, not all PM2 processes. Block writes from every other deployment/instance as well. Confirm the freeze before acknowledging `--writes-frozen`.
4. Apply the empty target's schema if not already present, transfer once, then require a successful independent read-only verification.
5. Change **only** `DATABASE_URL` and the approved `MYSQL_TLS_MODE` in the new release. Keep session, storage, public URL, UPI and proxy settings identical. Preserve host/domain settings so existing secure cookies remain valid.
6. Run `npm run env:check` in the new release. It checks schema/accounts/UTC and performs a temporary storage write/read/delete. Verify the app privately before routing traffic.
7. Switch/restart only this app. Verify HTTPS, existing session lookup, login, existing draft contents, admin counts, CSV and logs. Do not submit a real roster or payment merely to test. Monitor errors and record the cutover time, release and validation counts without secrets.

## Rollback

Before MySQL accepts new writes, stop the new app and restore the previous release/configuration pointing to Neon. Leave the MySQL database intact for investigation. After new MySQL writes are accepted, Neon is stale: freeze writes and reconcile/export those changes before any rollback. Never simply repoint to the old database and lose new registrations.

Do not delete the Neon database, backups or old release until the migration is accepted and retention requirements are satisfied.

## Completed cutover — 25 October 2026

- Public site: `https://allindiaiiitsportsmeet.iiitdm.ac.in/`.
- SSH alias: `inter-iiit-dreamhost`; Node 22.23.4; PM2 application `sports`.
- Active release: `/home/sports_root/.local/share/inter-iiit/releases/mysql-20261025`.
- Previous release (unchanged, still configured for Neon): `/home/sports_root/allindiaiiitsportsmeet.iiitdm.ac.in/Inter-IIIT-Sports-Meet`.
- The managed DreamHost proxy requires the pre-existing `0.0.0.0:8010` binding; loopback-only binding produced a public 503 and was corrected. No Apache/proxy/DNS configuration was changed. Use this release's `ecosystem.config.cjs`; `pm2 save` was run.
- Protected backups: `/home/sports_root/.local/share/inter-iiit/backups/neon-final-20261025.dump`, `pre-mysql-20261025.env`, and `pre-mysql-20261025-pm2.json`. The PostgreSQL 18 custom-format dump's archive index was validated. A preflight dump is also retained. Backup directories are mode 700; credential files/dumps are mode 600.
- Transfer and independent read-only verification logs: `transfer-apply.log` and `transfer-verify.log` in the active release. These contain counts and checksums status, not row values or credentials.
- At cutover: users 26, drafts 1, sessions 3, rate limits 6, audit rows 25; registrations/students/participations/payments 0. Every table passed count and canonical checksum verification, including microseconds. Subsequent live writes legitimately diverge from the frozen Neon source.
- `env:check` passed MySQL schema/accounts/UTC and private Neon storage write/read/delete. Official UPI settings remain unset, so optional QR generation remains disabled; neither bank settings nor passwords were invented/reset.
- The final database-backed HTTP session probe exposed Next.js `.env` expansion of a raw `$` in the assigned password. The protected release configuration was corrected by fully percent-encoding URL credentials, then the app was restarted. The same probe returned 200 after exercising the real MySQL session query. Always encode credentials with `encodeURIComponent` before assigning URL username/password fields; a URL object's password setter alone does not escape every dotenv-sensitive character.
- Public home/login/JS assets returned 200; unauthenticated admin API returned 401; `.env`, package and source paths returned 404. Browser login page loaded without reported JavaScript errors. Existing credentials/session hashes were preserved; no production credentials were reset or used for a synthetic login test.

Validation: 64 unit tests, MySQL database integration/concurrency tests, all-table PostgreSQL→MySQL transfer rehearsal, full isolated API smoke (including concurrent draft saves, payment verification and reopening), lint and production builds passed. Screen E2E checks passed 26/26; the older registration E2E passed 24/25, with its existing assertion that Combined contains only Chess failing because the current catalogue has three Combined sections. No sport catalogue/UI changes were made for this migration.

For subsequent updates, use [`update.sh`](DEPLOYMENT.md). The original Git checkout is the deployment control repository; it pulls `main` and stages a new release using the protected shared **MySQL** environment. It is not the active PM2 working directory. The initial `mysql-20261025` release is retained as the first MySQL rollback release. Do not restart the historical Neon application/configuration without the post-write reconciliation described above. `pg` remains installed for recovery/transfer tooling, not runtime application queries.
