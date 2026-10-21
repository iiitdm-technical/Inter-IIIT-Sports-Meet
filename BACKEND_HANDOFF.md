> **Status note (21 October 2026):** this handoff predates cloud drafts, payments, server-side sessions, the single organizer admin and the redesign. See `README.md`, `PROJECT_OVERVIEW.md` and `HOSTING_REQUIREMENTS.md` for the current system.

# BACKEND HANDOFF & ARCHITECTURE GUIDE
## 9th Inter-IIIT Sports Meet 2026 Registration System

==================================================
## 1. BACKEND ARCHITECTURE
==================================================

The system operates on a modern, serverless-ready monolithic architecture using **Next.js**. There is **no separate Express or Node.js background server**. The backend is implemented entirely within Next.js API Routes (`src/app/api/*`), executing server-side logic in response to client HTTP requests.

**Data Flow Architecture:**
Frontend (React Components)
↓ (HTTP Fetch)
Next.js API Routes (`src/app/api`)
↓ (Auth Checks & Schema Validation)
Business Logic Services (`src/lib/registration`, `src/lib/admin`)
↓ (SQL Generation)
Drizzle ORM (`src/db`)
↓ (TCP/SSL Connection)
PostgreSQL Database

This architecture minimizes infrastructure complexity, integrates tightly with the frontend (allowing shared validation logic), and is fully compatible with serverless deployments like Vercel.

==================================================
## 2. TECHNOLOGY STACK
==================================================

- **Next.js:** Server framework (API routes).
- **JavaScript:** Backend language (no TypeScript).
- **PostgreSQL:** Relational database.
- **Drizzle ORM:** Type-safe SQL wrapper and migration manager.
- **Zod:** Schema declaration and data formatting validation.
- **bcryptjs:** Cryptographic hashing for passwords.
- **HMAC-SHA256 (Node Crypto):** Used for signing and verifying HTTP-only session cookies.
- **@neondatabase/serverless:** Database driver allowing connections in modern serverless/edge environments.

==================================================
## 3. COMPLETE BACKEND FOLDER STRUCTURE
==================================================

```text
src/
├── app/api/                 → Next.js API Endpoints
│   ├── admin/               → Admin-only endpoints (stats, entries, csv)
│   ├── auth/                → Authentication endpoints (login, logout, me)
│   └── registration/        → IIIT registration endpoints (fetch, submit, csv)
├── db/                      → Database configuration and schema
│   ├── index.js             → Connection pooling and ORM setup
│   ├── schema.js            → Source of truth for database tables
│   ├── migrate.js           → Script to execute Drizzle migrations
│   ├── seed.js              → Script to populate initial users/admin
│   └── migrations/          → Auto-generated SQL migration files
├── lib/                     → Core Backend Business Logic
│   ├── admin/               → Admin data retrieval (service.js)
│   ├── auth/                → Session/Password crypto (passwords.js, session.js)
│   ├── csv/                 → CSV string generation (generator.js)
│   ├── registration/        → Submission logic & DB transactions (service.js)
│   ├── sports/              → Core rulebook configuration (config.js)
│   └── validation/          → Zod schemas and Business rule enforcement (rules.js)
└── data/                    → Hardcoded seeded data (e.g., iiits.js)

.env.example                 → Environment variable template
```

**Key File Responsibilities:**
- `src/db/schema.js`: Defines all tables, columns, constraints, and relationships. Drizzle-kit reads this to generate migrations.
- `src/lib/auth/session.js`: Handles creating, signing, parsing, and verifying the HTTP-only session cookie using native Node `crypto`.
- `src/lib/registration/service.js`: The heart of the backend. Enforces business rules and executes the atomic database transaction required to save a 150-student registration.
- `src/lib/admin/service.js`: Constructs dynamic, complex SQL queries using Drizzle to power the admin dashboard filters and pagination.

==================================================
## 4. DATABASE ARCHITECTURE
==================================================

The PostgreSQL database consists of 4 strictly normalized tables.

**1. `users` Table**
- **Purpose:** Stores pre-provisioned IIIT accounts and the master Admin account.
- **Columns:** `id` (PK), `username` (Unique), `password_hash`, `role` (iiit/admin), `iiit_code` (Unique), `iiit_name`.

**2. `registrations` Table**
- **Purpose:** Represents a locked, finalized submission for an IIIT.
- **Columns:** `id` (PK), `iiit_code` (Unique FK), `status`, `contact_name`, `total_students_count`.
- **Relationships:** Belongs to `users` via `iiit_code`. 

**3. `students` Table**
- **Purpose:** The normalized roster of unique students participating in the event.
- **Columns:** `id` (PK), `registration_id` (FK), `iiit_code`, `roll_number`, `name`, `gender`.
- **Constraints:** Unique Index on `(iiit_code, roll_number)` ensures a student only exists once per IIIT.
- **Relationships:** Belongs to `registrations` via `registration_id`.

**4. `student_event_participations` Table**
- **Purpose:** The junction table placing students into specific sports and events.
- **Columns:** `id` (PK), `registration_id` (FK), `student_id` (FK), `sport_id`, `event_id`, `gender`, `is_reserve`.
- **Constraints:** Unique Index on `(student_id, sport_id, event_id)` prevents entering the same student into the same event twice.
- **Relationships:** Belongs to `students` via `student_id`, and `registrations` via `registration_id`.

**Relationship Graph:**
```text
 users (1)
   ↓
 registrations (1)
   ↓ 
 students (Many)
   ↓ 
 student_event_participations (Many)
```

==================================================
## 5. DATABASE INTEGRITY
==================================================

The schema utilizes PostgreSQL's relational guarantees to protect data at the lowest level:
- **Foreign Keys with Cascade:** Deleting a user or registration securely deletes all related students and participations automatically (`onDelete: "cascade"`).
- **Identity Uniqueness:** The DB rejects multiple inserts of the same `roll_number` for a given `iiit_code`.
- **Registration Uniqueness:** A strict `UNIQUE` constraint on `registrations.iiit_code` guarantees that an IIIT can physically only have one final submission record.
- **Atomic Transactions:** Submissions are wrapped in `db.transaction()`. If the server crashes or validation fails halfway through inserting 100 students, the entire operation rolls back.

==================================================
## 6. AUTHENTICATION
==================================================

- **Login Endpoint:** `POST /api/auth/login`.
- **Password Storage:** Plain text passwords are NEVER stored. They are hashed using `bcryptjs` (salt rounds = 10).
- **User Lookup:** The server queries `users` by `username`. `bcrypt.compare` verifies the submitted password against `password_hash`.
- **Role Handling:** The database stores `role` as either `"iiit"` or `"admin"`. This role is embedded securely into the session payload.
- **IIIT Account Identification:** For IIIT users, their `iiit_code` (e.g., `"iiitdm-kancheepuram"`) is also embedded into the session. This is the sole identifier the backend uses to attach data to an IIIT.

==================================================
## 7. SESSION MANAGEMENT
==================================================

The system does NOT use JWTs or external session stores (like Redis). It uses lightweight, secure HTTP-only cookies.

- **Cookie Name:** `inter_iiit_session`
- **Signing Mechanism:** Native Node.js `crypto.createHmac("sha256")`. The token is `base64url(payload).signature`.
- **Expiration:** Hardcoded to 7 days (`SESSION_MAX_AGE_SECONDS`). The `exp` timestamp is embedded in the payload and verified on every request.
- **Security:** `httpOnly: true` (invisible to client-side JS/localStorage), `sameSite: "lax"`, and `secure: true` in production.
- **Server-Side Verification:** Because the server signs the payload with `SESSION_SECRET`, it intrinsically trusts the decoded `iiit_code` and `role` if the signature matches.
- **Logout:** `POST /api/auth/logout` simply issues a `Set-Cookie` header to delete the `inter_iiit_session` cookie.

==================================================
## 8. AUTHORIZATION
==================================================

Authorization is handled entirely server-side via the `requireAuth()` utility in `session.js`.

- **Admin APIs (e.g., `/api/admin/*`):** Use `requireAuth(["admin"])`. If an IIIT user attempts access, they receive a 403 Forbidden.
- **IIIT APIs (e.g., `/api/registration/submit`):** Use `requireAuth(["iiit"])`.
- **Cross-IIIT Isolation:** The backend **never** accepts an `iiitCode` provided by the client in the request body for sensitive operations. It extracts `session.iiitCode` directly from the verified cookie. A client cannot forge the cookie to edit or view another IIIT's registration.

==================================================
## 9. REGISTRATION SUBMISSION FLOW
==================================================

The critical path for finalizing a registration in `src/lib/registration/service.js`:

`POST /api/registration/submit`
↓ 
`requireAuth(["iiit"])` validates the session and extracts `iiitCode`.
↓
`registrationSubmitSchema.safeParse()` validates the JSON structure (Zod).
↓
`validateRegistrationRules()` executes complex business constraints.
↓
**Lock Check:** Queries DB to ensure `registrations` doesn't already contain a record for this `iiitCode`.
↓
`db.transaction()` begins.
↓
`tx.insert(registrations)` creates the master lock record.
↓
`tx.insert(students)` bulk inserts the unique roster, returning DB IDs.
↓
Maps student `rollNumber` to newly generated DB `id`.
↓
`tx.insert(studentEventParticipations)` bulk inserts all sport entries.
↓
Transaction Commits atomically.
↓
Returns 200 OK.

==================================================
## 10. VALIDATION ARCHITECTURE
==================================================

The backend enforces a strict two-pass validation system before touching the database:

**1. Format/Schema Validation (Zod):** 
Found in `src/lib/validation/schemas.js`. Ensures the incoming JSON payload has the correct data types, required fields, string lengths, and basic formats (like valid email addresses). 

**2. Business-Rule Validation:**
Found in `src/lib/validation/rules.js`. This is a complex logic engine that counts unique students, checks squad sizes, verifies gender alignments, and calculates per-student multi-sport limits. 

*Note: The frontend imports these identical validation files to provide live UX feedback. However, the server NEVER trusts the frontend's validation; it re-runs both layers authoritatively upon submission.*

==================================================
## 11. COMPLETE BUSINESS RULES
==================================================

The `validateRegistrationRules` function strictly enforces:

- **Maximum 150 unique students** across the entire payload.
- **Roll Number Uniqueness:** The exact same roll number string constitutes one unique student.
- **Conflicting Names:** If the same roll number is submitted with two different student names, it is rejected.
- **Event Capacity:** Rejects payloads exceeding maximum main participants or reserves for any given sport/event.
- **Athletics Individual Limit:** A single student can enter a maximum of 3 individual Athletics events (relays excluded).
- **Aquatics Individual Limit:** A single student can enter a maximum of 3 individual Aquatics events (relays excluded).
- **Normal Sports Limit:** A single student can participate in a maximum of 2 "normal" sports.
- **Exception to Normal Sports:** Athletics and Aquatics do NOT count towards the 2-sport limit (they are exempt).
- **Gender Restrictions:** Rejects mismatches (e.g., Male student in Women's Basketball).
- **Duplicate Participation:** Rejects putting the exact same student into the exact same event twice.
- **No Minimum Sports Requirement:** Submitting 0 entries or 1 entry is technically valid, provided it doesn't violate limits.

==================================================
## 12. PERMANENT SUBMISSION LOCK
==================================================

The submission lock is not a boolean toggle; it is structural.

- **How it works:** Because `registrations.iiit_code` has a strict unique constraint, the very first successful submission creates that row. Any subsequent call to `/api/registration/submit` will immediately fail step 3 of the service flow (the lock check), returning 403.
- **Enforcement:** Enforced entirely server-side. Deleting browser localStorage or logging out and logging back in cannot bypass the database constraint.
- **Corrections:** The system is intentionally designed without an "un-submit" or "edit" endpoint.

==================================================
## 13. API REFERENCE
==================================================

**Authentication:**
- `POST /api/auth/login` | No Auth | Body: `{ username, password }` | Returns role & sets cookie.
- `POST /api/auth/logout` | No Auth | Clears session cookie.
- `GET /api/auth/me` | Authenticated | Returns current decoded session payload.

**IIIT Registration:**
- `GET /api/registration` | Auth (IIIT) | Returns the IIIT's submitted DB data (or empty state if draft).
- `POST /api/registration/submit` | Auth (IIIT) | Body: complex payload | Runs transactions, locks registration. Returns 200 or 400/422.
- `GET /api/registration/csv` | Auth (IIIT) | Returns raw text/csv file of their own registration.

**Admin:**
- `GET /api/admin/registrations` | Auth (Admin) | Returns high-level submission status of all IIITs.
- `GET /api/admin/entries` | Auth (Admin) | Query params: `iiit, sport, event, gender, rollNumber, name, page, limit` | Returns paginated student entries.
- `GET /api/admin/stats` | Auth (Admin) | Returns global counts (total IIITs, total entries, gender breakdown).
- `GET /api/admin/csv` | Auth (Admin) | Query params: (same filters as entries) | Returns text/csv download of filtered global database.

==================================================
## 14. API ↔ FRONTEND INTEGRATION
==================================================

**Flow 1: IIIT checking lock state**
`RegisterPage (React)` → `GET /api/registration` → `getRegistrationForIIIT (service)` → `PostgreSQL`

**Flow 2: IIIT Submitting**
`ReviewModal (React)` → `POST /api/registration/submit` → `submitRegistration (service)` → `db.transaction()` → `PostgreSQL`

**Flow 3: Admin filtering data**
`Admin Dashboard (React)` → `GET /api/admin/entries?sport=basketball` → `getAdminFilteredEntries (service)` → `PostgreSQL`

==================================================
## 15. ADMIN BACKEND
==================================================

The Admin backend (`src/lib/admin/service.js`) relies heavily on Drizzle ORM's advanced SQL builder (`eq`, `ilike`, `and`) to dynamically construct complex queries based on the frontend's URL query parameters. 
It utilizes `sql` tagged templates for safe string interpolation and executes `COUNT()` queries in parallel with `OFFSET/LIMIT` queries to provide highly efficient server-side pagination for the frontend dashboard. All endpoints are secured behind `requireAuth(["admin"])`.

==================================================
## 16. CSV GENERATION
==================================================

Located in `src/lib/csv/generator.js`.
Instead of relying on heavy third-party libraries, the backend generates raw CSV text strings natively. 
- **Data Source:** It reuses the exact same database query logic from the IIIT and Admin services. 
- **Admin CSV:** Will export the *entire* database if no query parameters are provided, or it will export exactly what the current Admin frontend filter is set to.
- **Fields:** Safely escapes commas and quotes, exporting IIIT Name, Sport, Event, Role (Main/Reserve), Roll Number, Name, and Gender.

==================================================
## 17. TRANSACTION / ATOMICITY
==================================================

`db.transaction()` in `submitRegistration` is critical.
Because a single submission can contain 150 students and 400 event entries, it requires hundreds of SQL `INSERT` statements. 
If the backend crashes on insert 399, or a unique constraint is violated on a duplicate roll number, PostgreSQL automatically rolls back the entire transaction. The database is left perfectly clean, with no orphaned students or partial registrations.

==================================================
## 18. ERROR HANDLING
==================================================

The backend communicates failures back to the Next.js API routes, which send structured JSON to the frontend:
- **401 Unauthorized:** Missing or invalid session cookie.
- **403 Forbidden:** Role mismatch, or attempting to submit when already locked.
- **400 Bad Request:** Malformed JSON or Zod schema failure (e.g., missing required contact email).
- **422 Unprocessable Entity:** Business rule failure (e.g., student exceeds 3 Athletics events). The response includes an array of specific error strings.
- **500 Server Error:** Database timeout or unhandled exception.

==================================================
## 19. MIGRATIONS & SEEDING
==================================================

- **Drizzle Config:** `drizzle.config.js` points to `src/db/schema.js`.
- **Migrations:** `npm run db:generate` creates SQL files in `src/db/migrations`. `npm run db:migrate` (via `src/db/migrate.js`) executes them against the database.
- **Seeding:** `npm run db:seed` executes `src/db/seed.js`. 
  - It creates 1 Admin account (`username: admin`) using `ADMIN_PASSWORD`.
  - It creates 25 IIIT accounts (e.g., `username: iiitdm-kancheepuram`) using `DEFAULT_IIIT_PASSWORD`.
  - It relies entirely on `src/data/iiits.js` as the source of truth for generating valid accounts.

==================================================
## 20. ENVIRONMENT VARIABLES
==================================================

Required in `.env.local` for local dev or Vercel Environment Settings for production:

- `DATABASE_URL`: Connection string (e.g., `postgresql://user:pass@host:5432/db?sslmode=require`).
- `SESSION_SECRET`: A long, random cryptographic string used to sign session cookies.
- `ADMIN_PASSWORD`: The initial password for the admin account (used by seed script).
- `DEFAULT_IIIT_PASSWORD`: The initial unified password for IIITs (used by seed script).
- `PORT`: (Optional) Port binding.

==================================================
## 21. TESTING
==================================================

*Note: As this is a Next.js framework implementation, refer to the repository's CI/CD pipeline or `package.json` scripts (`npm run lint`, etc.) for current testing status. The backend is designed for high testability due to the extraction of business logic (`rules.js`) away from HTTP request/response handlers.*

==================================================
## 22. SECURITY CHECKLIST
==================================================

✅ **Password Hashing:** Implemented (bcrypt).
✅ **Authenticated APIs:** Implemented (HTTP-only session cookie).
✅ **Role Authorization:** Implemented (Admin vs IIIT boundary).
✅ **Cross-IIIT Isolation:** Implemented (Cookie-derived identifiers).
✅ **Server-Side Validation:** Implemented (Zod + Rules Engine).
✅ **Permanent Lock:** Implemented (Database unique constraint).
✅ **Atomic Transactions:** Implemented (Drizzle transaction).
✅ **No Secrets in LocalStorage:** Implemented.
✅ **Protected CSV:** Implemented.
✅ **No Trust in Client Identity:** Implemented.

==================================================
## 23. DEPLOYMENT
==================================================

The application is highly suited for Vercel + Neon (Serverless Postgres).
**Requirements for production launch:**
1. Deploy Next.js to Vercel and attach environment variables.
2. Provision a PostgreSQL instance.
3. Run `npm run db:migrate` against the production DB.
4. Run `npm run db:seed` against the production DB to create the accounts.
5. Provide the seeded credentials to the stakeholders.

==================================================
## 24. MAINTENANCE GUIDE
==================================================

When changing the system, look here:
- **Changing Sports/Events limits:** Edit `src/lib/sports/config.js`. This automatically cascades to frontend UI, backend validation, and CSV export.
- **Changing Business Rules (e.g., max 150 students to 200):** Edit `src/lib/validation/rules.js` and `GLOBAL_RULES` in `config.js`.
- **Changing Database Schema:** Edit `src/db/schema.js`, run `npm run db:generate`, then `npm run db:migrate`.
- **Changing Admin Filters:** Edit `src/lib/admin/service.js` to add the Drizzle SQL filter, and update `src/app/api/admin/entries/route.js`.

==================================================
## 25. SAFE VS SENSITIVE FILES
==================================================

**High-Risk Files (DO NOT modify without extreme caution):**
- `src/lib/auth/session.js`: Changing the signing algorithm or cookie name breaks all active sessions.
- `src/lib/registration/service.js`: Modifying the atomic transaction order can corrupt the database or orphan records.
- `src/db/schema.js`: Modifying existing columns without proper SQL migrations will crash the application.

**Core Backend Files (Must be understood):**
- `src/lib/validation/rules.js`
- `src/lib/admin/service.js`

**Safe Maintenance Areas:**
- `src/data/iiits.js` (Safe to add new IIITs before running seed).

==================================================
## 26. BACKEND MAINTENANCE PRINCIPLES
==================================================

- **The Server is Authoritative:** Never trust frontend payload validation. Re-run all checks on the backend.
- **Preserve Transactions:** Never execute `db.insert()` outside of a transaction context inside `service.js`.
- **Never Log Secrets:** Never `console.log` passwords, `DATABASE_URL`, or `SESSION_SECRET`.
- **Do Not Trust Client Identifiers:** Never accept `{ "iiitCode": "delhi" }` in a POST body. Extract it from the verified `requireAuth()` session.
- **Do Not Bypass the Submission Lock:** Do not add a "force submit" flag. The lock is a core data integrity feature.

==================================================
## 27. FINAL ARCHITECTURE SUMMARY
==================================================

The Inter-IIIT backend is a monolithic, highly secured set of serverless Next.js API endpoints communicating with a normalized PostgreSQL database via Drizzle ORM. 

By centralizing the complex tournament logic into a shared `rules.js` and `config.js` engine, the backend simultaneously empowers the frontend to provide real-time UX feedback while retaining absolute, transactional authority over database writes. The complete avoidance of client-side authentication tokens in favor of HMAC-signed, HTTP-only cookies eliminates an entire class of security vulnerabilities, resulting in a system perfectly designed for high-integrity, write-once registration workflows.
