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
| `SESSION_SECRET` | Random secret of at least 32 characters for signed login cookies |
| `AWS_ENDPOINT_URL_S3` | Neon Object Storage S3 endpoint |
| `AWS_ACCESS_KEY_ID` | Neon storage credential ID |
| `AWS_SECRET_ACCESS_KEY` | Neon storage credential secret |
| `AWS_REGION` | Region of the Neon storage endpoint |
| `NEON_STORAGE_BUCKET` | Private proof bucket, currently `payment-proofs` |

The storage credential needs access to the private bucket. Do not expose any of these values with a `NEXT_PUBLIC_` prefix or commit `.env.local`.

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

The seed creates one admin and 25 IIIT accounts with **different random passwords**. It writes them to `.private/seed-credentials.json` with restricted permissions. This file is ignored by Git. Keep a secure copy and distribute each account password only to its coordinator. Re-running the seed does not overwrite existing accounts or their passwords.

Open `http://localhost:3000/login`. Draft registrations are saved in that browser until the coordinator locks the roster; locked students and entries are stored in PostgreSQL. Payment proofs are stored privately in Neon Object Storage and served through an authenticated endpoint.

## Verification

```bash
npm run lint
npm run build -- --webpack
```

The webpack flag is a supported Next.js build option. It is useful where the default Turbopack build cannot start its local worker process.

## Deployment

Deploy the Next.js app on a Node.js compatible host and set the same server-side variables there. Run migrations before accepting registrations. The live Neon database and private bucket are separate from the hosting account; this project does not use Vercel Blob. Keep `SESSION_SECRET` consistent across instances. Payment confirmation still requires an organizer to reconcile the transfer with bank records.
