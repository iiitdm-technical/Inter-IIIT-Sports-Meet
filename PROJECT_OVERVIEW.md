# 9th INTER IIIT SPORTS MEET 2026
## Digital Registration & Management System

*Status as of 21 October 2026: security hardening, single organizer admin, typography and card redesign.*

> Database update: the application now targets MySQL 8.0+ through Drizzle/mysql2. Payment proofs remain in Neon Object Storage. See `MYSQL_MIGRATION.md` for PostgreSQL data transfer and cutover; older database descriptions below are historical.

==================================================
## 1. EXECUTIVE OVERVIEW
==================================================

This repository contains the public website and the closed registration system for the **9th All India Inter-IIIT Sports Meet**, hosted by IIITDM Kancheepuram from 19 to 23 December 2026.

The registration system replaces spreadsheet rosters. Each participating IIIT signs in with a pre-provisioned account, builds its contingent roster against the rulebook with live validation, locks the roster, and then submits payment details with a private payment proof. Organizers review all entries, verify payments against the bank statement, and export CSV files.

A submitted payment proof is **not** confirmation of payment. A payment is complete only after an organizer marks it verified.

==================================================
## 2. SYSTEM USERS
==================================================

### IIIT Coordinator / IIIT Account
One pre-provisioned account per participating IIIT (25 accounts). Each has a unique random password generated at seed time.
- **Can:** enter students and assign them to sports and events, see live rule feedback, resume a saved draft on any device, review and lock the roster, pay by UPI QR or another approved method, upload a payment proof, track verification status, and download their own CSV and proof.
- **Cannot:** see other IIITs' data, or change the roster or payment after locking. Corrections go through the IIITDM Kancheepuram Sports Cell.

### Administrator
Exactly one organizer admin: `sports@iiitdm.ac.in` (username `sports-sac`). All other accounts are IIIT accounts.
- **Can:** view statistics, search and filter all locked entries, export all or filtered entries to CSV, view each IIIT's registration and payment status, open private payment proofs, verify a payment by re-entering the UTR and amount and confirming the bank credit, and list admin accounts.
- **Can also:** reopen a locked roster that is not yet bank-verified, turning it back into the IIIT's draft for corrections.
- **Cannot:** create or edit rosters on behalf of an IIIT, or add admins from the UI. The admin is managed with `npm run db:set-admin`.

==================================================
## 3. SYSTEM WORKFLOW
==================================================

**IIIT Coordinator**
Login
↓
Registration form (draft autosaved to Neon, with a browser copy as fallback)
↓
Live validation against the rulebook
↓
Review
↓
Lock roster (status `payment_pending`, roster becomes read-only)
↓
Pay (UPI QR when configured) and upload proof with UTR, date, mode and bank
↓
Submit payment (status `submitted`, payment verification `pending`)
↓
Organizer verifies the bank credit (verification `verified`; the coordinator's page updates within about 15 seconds)

**Administrator**
Login
↓
Dashboard (statistics)
↓
Registration Entries (filter, search, paginate, export CSV)
↓
IIITs & Payments (status per IIIT, view proof, verify payment)
↓
Admin Accounts (read-only list)

==================================================
## 4. FEATURE LIST (IMPLEMENTED)
==================================================

- **Authentication:** username or admin-email login, bcrypt hashes, HMAC-signed HTTP-only session cookie (7 days).
- **Role-based access:** separate IIIT and admin interfaces; every API route checks the role on the server.
- **Data isolation:** IIIT identity always comes from the session, never from the request body.
- **Registration form:** per-gender tabs (Men, Women, Combined), collapsible sport sections, main and reserve slots, automatic name fill for a roll number already entered.
- **Live validation:** shared client and server rule engine.
- **Cloud drafts:** saved to Neon about one second after each change. A revision number detects edits from two sessions and asks which version to keep.
- **Review and lock:** summary of students, entries and contact details before an atomic submission.
- **Payment:** amount computed on the server from the locked student count; optional UPI QR (`PAYMENT_UPI_ID`, `PAYMENT_PAYEE_NAME`); proof upload (PDF, JPG or PNG up to 2 MB, file signature checked) to a private Neon Object Storage bucket.
- **Payment verification:** admin re-enters UTR and amount and confirms the bank credit; the coordinator sees "Bank Verified".
- **CSV export:** IIIT export of its own roster; admin export of all or filtered entries; spreadsheet formula injection is neutralized.
- **Admin dashboard:** statistics, entries search, IIITs and payments table, admin accounts table.
- **Public website:** home, about, events, gallery, team, contact, location, sitemap and robots.
- **Operations scripts:** `db:migrate`, `db:seed`, `db:set-admin`, `env:check` (preflight of secrets, tables, accounts and a storage write-read-delete roundtrip).

==================================================
## 5. REGISTRATION BUSINESS RULES
==================================================

Defined in `src/lib/sports/config.js` and enforced by `src/lib/validation/rules.js`:

- **Unique students:** at most 150 per IIIT, with at most 100 men and 50 women.
- **Identity:** a student is identified by roll number; roll numbers and names are trimmed and upper-cased. Conflicting details for one roll number are rejected.
- **Valid events only:** sport, category and event must exist in the catalogue; team sports use the single `team` event; reserves are allowed only where configured.
- **Squad and event limits:** per-sport team limits and per-event participant and reserve limits.
- **Athletics:** at most 3 individual events per student; relays excluded.
- **Aquatics:** at most 3 individual events per student; relays excluded.
- **Other sports:** at most 2 per student; athletics and aquatics are exempt.
- **Gender:** men's events accept male students only and women's events female students only. Chess is a combined (mixed) team of up to 4.
- **Relays:** every relay needs all 4 runners once entered; the 2 reserves are optional.
- **Mixed relays:** athletics 4x100 M and 4x400 M, aquatics 4x50 M Free Style and 4x50 M Medley. Exactly 2 men and 2 women per team (runner slots are gender-fixed), plus an optional male reserve and an optional female reserve, each able to replace only a runner of the same gender; they do not count toward the 3 individual event limit.
- **One gender per student:** a roll number entered as male cannot fill a female slot anywhere, and vice versa.
- **No minimum:** an IIIT may enter any number of sports.

==================================================
## 6. DATA & SUBMISSION BEHAVIOR
==================================================

- **Drafts:** stored in `registration_drafts` (one per IIIT) and in browser storage as a fallback. Drafts are invisible to admins.
- **Lock:** roster submission inserts the registration, students and entries in one transaction and deletes the draft. Status becomes `payment_pending`.
- **Payment submission:** inserts the payment record and sets the registration to `submitted`. Both are then permanently locked.
- **Verification:** a separate admin action sets `verification_status` to `verified` with time and admin username.
- **Corrections:** the admin can reopen a roster until its payment is bank-verified; the roster becomes the IIIT's draft again and any submitted payment record and proof are removed.
- **Deadline:** optional `REGISTRATION_CLOSES_AT`; after it, drafts cannot be saved or locked.

==================================================
## 7. PAGES / SCREENS
==================================================

- `/`, `/about`, `/events`, `/gallery`, `/team`, `/contact`, `/location`: public pages.
- `/login`: sign-in for coordinators and admins.
- `/register`: draft form, review dialog, payment pending screen, and locked or verified screen.
- `/admin`: dashboard with Registration Entries, IIITs & Payments and Admin Accounts tabs, and the payment verification dialog.

==================================================
## 8. ARCHITECTURE & STACK
==================================================

- **Next.js 16 / React 19 / Tailwind CSS 4**, JavaScript only. API routes in `src/app/api/*`; services in `src/lib/*`.
- **Neon PostgreSQL** with **Drizzle ORM** over `pg` (`src/db`, migrations `0000`–`0007`).
- **Neon Object Storage** (S3-compatible, `@aws-sdk/client-s3`) for private payment proofs.
- **Zod** validation, **bcryptjs** hashing, **qrcode** for UPI QR images.
- Tables: `users`, `registration_drafts`, `registrations`, `students`, `student_event_participations`, `payment_transactions`, `sessions`, `rate_limits`, `audit_log`.
- **Typography:** Barlow Condensed (display) and Manrope (body), self-hosted via `next/font`; shared tokens and components in `src/app/globals.css`.

==================================================
## 9. SECURITY & DATA PROTECTION
==================================================

- **Sessions:** server-side (`sessions` table); the cookie holds a random token, the database only its HMAC. Admin sessions last 60 days, IIIT sessions 30 days, both extended while in use. Several devices may be signed in at once; signing out ends only that device; deleting a user ends all of theirs.
- **Rate limits** in PostgreSQL: sign-in 30 per IP and 8 failed per account per 15 minutes; caps on uploads, submissions, autosave, downloads and admin actions.
- **Headers:** CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP; API responses `no-store`; `X-Powered-By` removed.
- **Cross-site requests:** state-changing API calls must be same-origin (`src/proxy.js`), plus SameSite cookies.
- **Errors:** generic messages for server failures; duplicate submissions return 409.
- **Audit log:** sign-ins and failures, lockouts, roster locks, payments, verifications, roster reopenings.
- Server-side validation of every submission; the client cannot set the amount or the IIIT.
- Proofs are private, streamed only to the owning IIIT or the admin; upload checks type, size and file signature; replaced proofs are deleted.
- IIIT passwords are random and written only to the git-ignored `.private/` folder; the admin password is never stored in the repository.

==================================================
## 10. TESTING
==================================================

- `npm run lint`: 0 errors, 0 warnings.
- `npm test`: 36 unit tests for the rules engine, validation-to-slot mapping, schemas and CSV escaping.
- `npm run test:e2e`: 50 browser checks of the registration, payment, login and admin screens with every API call mocked (needs a running server; `E2E_BASE_URL`).
- `npm run test:smoke` (`tests/smoke-api.mjs`): every API route plus session revocation, CSRF blocking, headers and login lockout, against an isolated database branch only.
- `npm run test:db` (`tests/db-integration.mjs`): runs only with a separate `TEST_DATABASE_URL`.
- `npm run env:check`: deployment preflight.

==================================================
## 11. DEPLOYMENT
==================================================

See `HOSTING_REQUIREMENTS.md` for sizes and server requirements. Deploy on any Node.js 22 host. Set the server variables listed in `README.md`, set `NEXT_PUBLIC_SITE_URL`, run `npm run db:migrate`, then `npm run env:check` in the deployment environment before distributing credentials. Keep `SESSION_SECRET` identical across instances.

==================================================
## 12. CURRENT STATUS
==================================================

| Area | Status |
|---|---|
| Public website | Done |
| Authentication, server-side sessions, single admin | Done |
| Security hardening (rate limits, headers, CSRF, audit) | Done |
| Roster builder, validation, review, lock | Done |
| Cloud drafts with conflict handling | Done |
| Payment proof, UPI QR, admin verification | Done (QR needs official UPI details) |
| Admin dashboard and CSV export | Done |
| Automated tests | Unit, browser and API smoke suites |
| Production deployment | Not yet done |

==================================================
## 13. SCOPE / NON-REQUIREMENTS
==================================================

- No self-service sign-up; accounts are pre-provisioned.
- No email or OTP verification.
- No online payment gateway; payments are made outside the system and verified manually.
- No participant badges or ID cards.
- No social login.

==================================================
## 14. OPEN ITEMS
==================================================

1. **Contingent limit:** set to 150 per IIIT (100 men, 50 women) as decided by the organisers; the rulebook (Table 1) states 130 (90 men, 40 women).
2. **Fee:** the rulebook states Rs 2,000 + 18% GST (Rs 2,360) per participant; the code charges Rs 2,500 (`GLOBAL_RULES.REGISTRATION_FEE_PER_STUDENT`). Confirm.
3. **Not modelled:** Rs 25,000 caution deposit; signed entry form with photo and Dean's endorsement.
4. **Hosting:** awaiting the institute's reply on PostgreSQL and storage; currently on Neon.
5. **Content:** 9th-edition logo, Squash vs Handball in the events carousel, sponsor list, Employees' Sports Meet section, higher-resolution gallery photos.
6. **Faculty/officials registration** (if required) is not a feature yet; one coordinator account per IIIT.
