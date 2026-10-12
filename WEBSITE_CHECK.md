# Website check — 12 October 2026

## Fixed

- Admin filter changes no longer repeat authentication and overview loading. Searches are debounced, older responses cannot overwrite newer results, and Clear sends empty filters.
- Filtered admin CSV exports now honor student name and roll number.
- IIIT roster downloads now include locked registrations awaiting payment, matching the download button on that screen.
- Registration status/session service errors show a retry screen instead of opening a new form or redirecting to login.
- Browser storage failures no longer crash draft loading/saving or interrupt the transition after successful submission.
- Upload token authorization enforces the authenticated IIIT's proof folder. Unsupported pathname overrides were removed; random suffixes and overwrite protection use supported Blob options.
- The existing backend suite supports `--unit-only`, allowing checks without database writes.

## Verification

- `npm.cmd run build`: passed, all 28 generated routes.
- `node scratch/test_backend.js --unit-only`: 18 passed, zero failed.
- HTTP checks: all ten page routes returned 200, as did robots.txt, sitemap.xml and the rulebook PDF.
- Seven protected registration/admin/payment GET endpoints returned 401 without a session. `/api/auth/me` returned its expected anonymous response.
- All 82 literal static asset references resolve to existing local files.
- `git diff --check`: passed.

## Limits and follow-up

No `.env.local`, database credentials, or Blob token were present. Authenticated login, database persistence, actual CSV content from saved records, payment submission, and real proof upload/download require a configured test environment. The database integration suite was deliberately not run against an unknown database.

No browser surface was available to the automation tool, so visual layout, mobile behavior, and browser interactions were not verified. HTTP success verifies that routes render on the server, not that every client interaction works.

Five existing lint warnings concern image optimization and external font loading; these are performance recommendations, not failing routes.
