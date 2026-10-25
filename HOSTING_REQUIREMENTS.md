# Hosting Requirements — 9th All India Inter-IIIT Sports Meet 2026

Prepared for the IIITDM Kancheepuram Web Admin to assess hosting the website on the Institute's servers.
Figures were measured on 21 October 2026 from the repository and the current production database, then projected to full registration load.

## Summary

| Item | Measured now | Expected at full load | Recommended allocation |
|---|---|---|---|
| Source code (tracked in Git) | 42.7 MB total; 0.7 MB application code, 7.1 MB site images and PDFs, 34.5 MB reference material (brochure, rulebook, design references) | unchanged | 100 MB |
| Production build (`.next`, excluding dev and build caches) | 5.7 MB | grows a little with the image cache | 100 MB (includes runtime image cache) |
| Runtime dependencies (`node_modules`, production only) | ~350 MB | unchanged | 500 MB |
| Build-time dependencies (only if built on the server) | ~1.4 GB `node_modules` plus ~280 MB build cache | unchanged | 2 GB, or build elsewhere and copy the output |
| PostgreSQL database | 8 MB (accounts only; almost all of it is PostgreSQL's own system catalogue) | 30–100 MB | 1 GB |
| Uploaded files (payment proofs) | 0 | up to 50 MB | 1 GB |
| **Total disk for the application** | | | **5 GB, plus space for backups** |

The site's photographs, logos and rulebook PDF are static files shipped with the build (`public/`, 7.1 MB). They are not user uploads. The only uploaded files are payment proofs.

## What the application is

- One Next.js 16 application (JavaScript, Node.js) serves both the public website and its API from a **single Node.js process**. There is no separate backend server and no background job.
- Data is stored in **MySQL 8.0+ (InnoDB)** using mysql2. The schema is managed by Drizzle ORM migrations (`npm run db:migrate`). Dates use UTC. Payment-proof objects remain in Neon S3 storage.
- Payment proofs (PDF/JPG/PNG, at most 2 MB each) are stored privately in an **S3-compatible object storage bucket**. Files are streamed only to the owning IIIT or to an organizer, after a permission check.
- **Today:** it runs on Neon PostgreSQL (version 18) and Neon Object Storage. Moving to the Institute's servers needs only new environment variables: database URL, storage endpoint and credentials, and bucket. No code is tied to Neon.
- **Database SSL:** the app currently requires a verified SSL certificate for any non-localhost database. A database on the same machine works as-is. A remote database with a self-signed certificate would need a small configuration option, which we will add once the setup is confirmed.

## Expected load

- 25 participating IIITs. Each has **one coordinator account** that registers **up to 150 students**, with up to about 1,200 event entries per IIIT (about 3,750 students and 30,000 entries in total).
- A small number of organizer (admin) accounts.
- The user count also allows for up to 25 faculty/officials per IIIT. The current system records one faculty contact per IIIT registration; separate faculty registration is not a feature yet.
- Peak concurrency: roughly 25 coordinators plus organizers, plus public visitors. Traffic is low overall and spikes around the registration deadline.

## Database requirements

- **PostgreSQL 15 or newer (16 recommended).** It is currently tested on PostgreSQL 18.
- **One database and one application user.** The user must own the database or be allowed to create tables and indexes, because migrations create and alter tables.
- **About 10 connections** are needed by the application. The current Neon server allows 112.
- **SSL** is optional when PostgreSQL runs on the same host. For a remote database, SSL with a trusted certificate is preferred.
- **Size estimate at full load**, including indexes:

  | Data | Rows | Approx. size |
  |---|---|---|
  | Students | ~3,750 (plus ~625 faculty as headroom) | ~1–2 MB |
  | Event entries | up to ~30,000 | ~8–10 MB |
  | Registration drafts (JSON, one per IIIT, up to ~1 MB each) | 25 | up to ~25 MB |
  | Accounts, registrations, payment records | ~50 + 25 + 25 | < 1 MB |
  | Login sessions, rate limits, audit log (being added) | a few thousand | ~2–5 MB |
  | PostgreSQL system catalogue (fixed) | — | ~8 MB |

  Expected total: **30–50 MB**, or under **100 MB** after allowing for update churn from draft autosaves.
- **Backups:** a daily `pg_dump` with at least 14 days of retention; each dump will be well under 100 MB.

## File storage requirements (payment proofs)

- **Preferred:** an S3-compatible bucket (for example MinIO) with an access key that can read, write and delete objects in that bucket. The bucket must be **private**, with no public read access.
- **Alternative:** if no S3 service is available, the app can keep using Neon Object Storage, or we can add an option to store proofs in a private directory on the server's disk.
- **Volume:** one active proof per IIIT, at most 2 MB each, so **up to about 50 MB**. Replaced proofs are deleted.
- **Backups:** daily, together with the database.

## Server requirements

- **Machine:** a Linux VM or container.
  - **CPU:** 2 vCPU.
  - **Memory:** 2 GB RAM (4 GB if the app is built on the server).
  - **Disk:** 5 GB for the application, plus space for backups.
- **Node.js 22 LTS** (declared in `package.json`).
- **A process manager** such as systemd or pm2, to keep `npm start` running and restart it on reboot.
- **HTTPS through a reverse proxy** such as nginx, with a TLS certificate for the college subdomain. The proxy must:
  - allow request bodies of **at least 3 MB**, for 2 MB proof uploads;
  - forward the `Host`, `X-Forwarded-For` and `X-Forwarded-Proto` headers.
- **Outbound internet** is not needed at runtime. Fonts and images are self-hosted. The only external resource is the Google Maps embed on the Location page, which visitors' browsers load directly.
- **Optional, deployment size:** building with Next.js `output: 'standalone'` would produce a much smaller self-contained deployable than the full 350 MB `node_modules`. It is not enabled yet and could be turned on for the Institute deployment.

## Environment variables required (names only)

- **Database and session:**
  - `DATABASE_URL`: MySQL connection string (percent-encode credentials). Remote connections default to verified TLS. The DreamHost target requires the explicitly approved `MYSQL_TLS_MODE=require` (encrypted but certificate authentication disabled); obtain a trusted provider certificate when possible.
  - `SESSION_SECRET`: random secret of at least 32 characters.
- **Object storage:**
  - `AWS_ENDPOINT_URL_S3`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `NEON_STORAGE_BUCKET`: the bucket name, despite the Neon prefix.
- **Payments:**
  - `PAYMENT_UPI_ID`
  - `PAYMENT_PAYEE_NAME`
- **Site:**
  - `NEXT_PUBLIC_SITE_URL`: the final HTTPS address of the site.
  - `PORT`: optional.

## Deployment steps (once access is provided)

1. Install Node.js 22, then run `npm ci` and `npm run build`. Alternatively, build elsewhere and copy the output.
2. Set the environment variables above.
3. Run `npm run db:migrate`, and seed the IIIT accounts.
4. Run `npm run env:check`. It verifies the database tables, the accounts and a storage write-read-delete roundtrip.
5. Start the app with `npm start` under systemd or pm2, behind nginx with HTTPS.
6. Schedule daily backups of the database and the proof bucket.

## Reply to the Web Admin (ready to send)

```
Dear Sir/Madam,

Thank you for the reminder. Please find the hosting requirements for the Inter-IIIT Sports Meet 2026 website below.

Application: a single Next.js (Node.js 22) application serving both the website and its API, run behind an HTTPS reverse proxy (e.g. nginx).
Source code: ~43 MB (application code under 1 MB; site images/PDFs ~7 MB; reference documents ~35 MB).
Build and runtime dependencies: ~6 MB build output plus ~350 MB Node.js packages (about 2 GB free space if the build is done on the server).
Database: PostgreSQL 15 or newer (16 recommended), one database and one user that can create tables, about 10 connections. Expected size 30–100 MB for 25 IIITs (about 3,750 students and 30,000 event entries); 1 GB allocation recommended.
Uploaded files: payment proofs only (PDF/JPG/PNG, max 2 MB each, one per IIIT), up to about 50 MB; a private S3-compatible bucket (e.g. MinIO), 1 GB recommended (we can add storage in a private server directory if a bucket is not available).
Server: Linux VM with 2 vCPU, 2–4 GB RAM and about 5 GB disk plus backups; TLS certificate for the subdomain; upload size limit of at least 3 MB; daily database and file backups.
Traffic is low: about 25 coordinators and the organizers at peak, plus public visitors.

A detailed requirements note can be shared if needed. Please let us know if any further information is required.

Regards,
Sports-SAC, IIITDM Kancheepuram
```
