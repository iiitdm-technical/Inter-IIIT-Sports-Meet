# 9th Inter-IIIT Sports Meet 2026

Student registration for participating IIITs. Coordinators enter students and events, review the roster, then lock it and submit bank transfer details with a private payment proof. Admins can inspect entries, payment details, and export CSV files. A submitted proof is **not** confirmation that the bank transfer has been verified.

## Stack

- Next.js 16, React 19, Tailwind CSS
- Neon PostgreSQL with Drizzle ORM
- Private Neon Object Storage bucket for payment proofs
- Zod validation and bcrypt password hashes

## Setup

Use Node.js 22 and npm. The Neon database and bucket must be provisioned before running the application.

```bash
npm ci
cp .env.example .env.local
```

Set these server-side variables in `.env.local` and in the deployment environment:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string |
| `SESSION_SECRET` | Recommended: random secret of at least 32 characters used as an HMAC key for stored session hashes. Optional; changing it signs everyone out |
| `AWS_ENDPOINT_URL_S3` | Neon Object Storage S3 endpoint |
| `AWS_ACCESS_KEY_ID` | Neon storage credential ID |
| `AWS_SECRET_ACCESS_KEY` | Neon storage credential secret |
| `AWS_REGION` | Region of the Neon storage endpoint |
| `NEON_STORAGE_BUCKET` | Private proof bucket, currently `payment-proofs` |
| `PAYMENT_UPI_ID` | Official organizer UPI ID; enables the payment QR with `PAYMENT_PAYEE_NAME` |
| `PAYMENT_PAYEE_NAME` | Payee name displayed beside and encoded in the QR |

The storage credential needs access to the private bucket. Do not expose any of these values with a `NEXT_PUBLIC_` prefix or commit `.env.local`.

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

The seed creates the 25 IIIT accounts with **different random passwords** and writes them to `.private/seed-credentials.json` with restricted permissions. This file is ignored by Git. Keep a secure copy and distribute each account password only to its coordinator. Re-running the seed does not overwrite existing accounts or their passwords.

There is exactly one organizer admin. Create or update it (and remove any other admin accounts) with:

```bash
ADMIN_EMAIL=sports@iiitdm.ac.in ADMIN_PASSWORD='…' npm run db:set-admin -- --remove-other-admins
```

The password is read from the environment and never stored in the repository. Changing it signs that admin out everywhere. Admins sign in with their email or username; the faculty contact email entered by a coordinator never grants admin access. The admin dashboard's **Admin Accounts** tab lists admins without exposing password hashes.

Open `http://localhost:3000/login`. Draft registrations are saved to Neon for the IIIT account and kept in that browser as a fallback. A coordinator can resume the draft on another device after signing in. If two sessions edit the same draft, the page asks which version to keep. Locking the roster removes the draft and stores the final students and entries in PostgreSQL. Payment proofs are stored privately in Neon Object Storage and served through an authenticated endpoint.

When the sports cell supplies its verified UPI ID and payee name, set the two payment variables in the server environment and redeploy. The payment page then generates a UPI QR for the authoritative student count and ₹2,500 per student. Coordinators upload a proof and enter the UTR; an organizer must check the bank statement and mark the payment verified in the admin view.

After approval, the coordinator's locked registration page updates its payment status while open (within about 15 seconds, or immediately with **Check status now**). The approval endpoint requires an admin session, the submitted UTR and amount, and a confirmation that the bank credit was checked.

## Security

- **Sessions** are stored server-side (`sessions` table). The cookie holds a random token and the database only its HMAC. Admin sessions last 60 days and IIIT sessions 30 days, extended while in use; signing in on another device does not sign out the first. Signing out ends only that device's session; deleting a user ends all of theirs.
- **Rate limits** (stored in PostgreSQL, shared by all instances): sign-in 30 attempts per IP and 8 failed attempts per account per 15 minutes; uploads, roster/payment submissions, autosave, downloads and admin actions are capped per user.
- **Headers:** Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy and Cross-Origin-Opener-Policy on every response; API responses are `no-store`.
- **Cross-site requests:** state-changing API calls must come from this site (`src/proxy.js`), on top of SameSite cookies.
- **Errors:** server failures return a generic message; details stay in the server log.
- **Audit log:** sign-ins (including failures and lockouts), roster locks, payment submissions, verifications and roster reopenings are recorded in `audit_log`.
- **Roster correction:** an admin can reopen a roster that is not yet bank-verified from **IIITs & Payments**; it becomes the coordinator's draft again.
- Behind a reverse proxy, forward `Host`, `X-Forwarded-For` and `X-Forwarded-Proto`, and set `TRUSTED_PROXY_HOPS` to the number of proxies. See `HOSTING_REQUIREMENTS.md`.

## Verification

```bash
npm run env:check
npm run lint
npm run build -- --webpack
```

`env:check` validates the session secret and official UPI settings, connects to PostgreSQL, checks the registration, student, draft, payment, session, rate-limit and audit tables plus all 25 IIIT accounts and the organizer admin. It then writes, reads, and deletes a small temporary object in the private Neon storage bucket. It prints no credentials. Run it again in the deployment environment after setting the same variables there.

The webpack flag is a supported Next.js build option. It is useful where the default Turbopack build cannot start its local worker process.

To exercise every API route, create a **temporary Neon branch with data and schema** and set `API_TEST_DATABASE_URL` and `API_TEST_AWS_ENDPOINT_URL_S3` to that branch's values. The smoke test refuses to run against the database or storage endpoint in `.env.local`, and uses the credentials in `.private/seed-credentials.json`. Run it after building:

```bash
node tests/smoke-api.mjs
```

The test submits one roster and proof on the temporary branch. Use a fresh branch for another run, or set `API_TEST_IIIT_INDEX` to an unused IIIT account index on the same branch.

## Deployment

Deploy the Next.js app on a Node.js compatible host and set the same server-side variables there. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS website URL for canonical links, then run migrations and `npm run env:check` before accepting registrations. The live Neon database and private bucket are separate from the hosting account; this project does not use Vercel Blob. Keep `SESSION_SECRET` consistent across instances. Payment confirmation still requires an organizer to reconcile the transfer with bank records.
