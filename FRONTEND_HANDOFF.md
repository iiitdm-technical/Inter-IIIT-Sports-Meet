> **Status note (21 October 2026):** this handoff predates cloud drafts, payments, server-side sessions, the single organizer admin and the redesign. See `README.md`, `PROJECT_OVERVIEW.md` and `HOSTING_REQUIREMENTS.md` for the current system.

# FRONTEND HANDOFF & UI REFINEMENT GUIDE
## 9th Inter-IIIT Sports Meet 2026 Registration System

==================================================
## 1. FRONTEND ARCHITECTURE
==================================================

The application is built using the **Next.js App Router** architecture (React). 
It is a modern, serverless-ready web application designed for high performance and strong data integrity.

- **Next.js (React):** Manages routing, page rendering, and data fetching.
- **JavaScript:** Used across the entire frontend (no TypeScript is configured in this project).
- **Tailwind CSS:** The primary styling framework. All styling is utility-first within the components.
- **Client/Server Boundaries:** Pages like the registration form (`src/app/register/page.js`) and admin dashboard (`src/app/admin/page.js`) use the `"use client"` directive because they rely heavily on browser state (React `useState`, `useEffect`) and browser APIs (`localStorage`).
- **Backend Communication:** The frontend communicates with internal backend APIs (located in `src/app/api`) using standard `fetch()` calls. Authentication is handled via secure HTTP-only cookies, meaning the frontend does not manually attach bearer tokens to API requests.

==================================================
## 2. COMPLETE FOLDER STRUCTURE
==================================================

```text
src/
├── app/                  → Next.js file-system routing (pages & layouts)
├── components/           → Reusable React UI components
│   └── registration/     → Specific components for the complex registration UI
├── data/                 → Static hardcoded data arrays (e.g., gallery links, iiit lists)
└── lib/                  → Shared utilities (frontend & backend)
    ├── registration/     → Registration utility functions (client-utils.js)
    ├── sports/           → Shared sports configuration (config.js)
    └── validation/       → Shared business rules (rules.js)

public/
└── assets/               → Static visual assets
    ├── brand/            → Logos
    ├── events/           → Event/Sport specific imagery
    ├── gallery/          → Event photos
    ├── hero/             → Hero backgrounds
    ├── iiits/            → Participating IIIT logos
    └── sponsors/         → Sponsor imagery
```

**Key File Responsibilities:**
- `src/app/layout.js`: The root layout wrapping every page. Defines the global `<html>`, `<body>`, `<Navbar>`, and `<Footer>`.
- `src/app/register/page.js`: The central container for the IIIT registration process. Handles the primary state, API fetching, and localStorage draft saving.
- `src/components/registration/ReviewModal.js`: The critical summary popup before a user permanently locks their submission.
- `src/lib/sports/config.js`: The *Source of Truth* for available sports, events, and limits. Used by both the UI to render forms and the API to validate.
- `src/lib/registration/client-utils.js`: Handles live validation for the UI, translating flat component state into the complex payload required by the API.

==================================================
## 3. COMPLETE ROUTE/PAGE INVENTORY
==================================================

| Route | File | Purpose | Primary User | Important UI States | API Dependencies |
|-------|------|---------|--------------|---------------------|------------------|
| `/` | `src/app/page.js` | Landing page | Public | N/A | None |
| `/about` | `src/app/about/page.js` | About event/host | Public | N/A | None |
| `/events` | `src/app/events/page.js` | List of sports | Public | N/A | None |
| `/team` | `src/app/team/page.js` | Organizing team | Public | N/A | None |
| `/gallery` | `src/app/gallery/page.js` | Event photos | Public | N/A | None |
| `/contact` | `src/app/contact/page.js` | Contact info | Public | N/A | None |
| `/login` | `src/app/login/page.js` | Auth gateway | IIIT/Admin | Loading, Error | `POST /api/auth/login` |
| `/register` | `src/app/register/page.js` | Registration app | IIIT Account | Loading, Draft, Review, Locked, Error | `GET /api/auth/me`, `GET /api/registration`, `POST /api/registration/submit` |
| `/admin` | `src/app/admin/page.js` | Admin Dashboard | Administrator | Loading, Overview, Filtered, Empty | `GET /api/auth/me`, `GET /api/admin/stats`, `GET /api/admin/entries` |

==================================================
## 4. PUBLIC WEBSITE FLOW
==================================================

Users navigate the public site via a global `<Navbar>`. The layout is wrapped in `src/app/layout.js`, which permanently affixes the Navbar to the top and `<Footer>` to the bottom.

Flow:
`Home` → `About` → `Events` → `Gallery` → `Team` → `Contact`
The `Sign In` button in the Navbar routes users to `/login`. If logged in, users are routed based on their role (`/register` or `/admin`).

==================================================
## 5. REGISTRATION PAGE — COMPLETE UI ARCHITECTURE
==================================================

The registration view is highly componentized.

`RegisterPage` (`src/app/register/page.js`)
├── `RegistrationHeader` (Shows IIIT name, student count, auto-save status, logout)
├── `ContactForm` (Collects main contact details)
├── (Tab Navigation: Men's / Women's / Combined)
├── `SportSection` (Renders a specific sport block based on config)
│   └── `EventBlock` (Renders a specific event within that sport)
│       └── `ParticipantSlot` (Individual input for Roll No. & Name)
├── `ReviewModal` (Popup showing errors or final summary)
└── `LockedRegistration` (Alternate read-only view shown if already submitted)

**Component Roles:**
- **RegisterPage (Parent):** Holds the master state (`contactDetails`, `slotsMap`), handles localStorage, calls validation utils, and triggers API submission.
- **SportSection / EventBlock (Presentational/Routing):** They pass down props and layout the UI. They do not hold independent registration data state.
- **ParticipantSlot (Interactive):** Purely presentational. It fires `onChangeSlot` callbacks up to the parent `RegisterPage` when a user types.
- **ReviewModal (Interactive):** Displays validation feedback. Fires the final `onSubmit` callback if the user clicks "Confirm & Final Submit".

==================================================
## 6. REGISTRATION USER FLOW
==================================================

1. User visits `/login` and authenticates.
2. Redirected to `/register`.
3. **Load Auth:** Fetches `/api/auth/me`.
4. **Check Status:** Fetches `/api/registration`. 
5. If submitted → renders `<LockedRegistration>` (read-only state).
6. If not submitted → loads draft from `localStorage`.
7. User interacts with `<ParticipantSlot>` components.
8. State updates → live validation runs in the background.
9. User clicks "Review & Submit" (Floating action bar).
10. **Review Modal:** Shows validation errors (blocking submission) OR shows a clean summary.
11. User clicks "Confirm & Final Submit" inside Modal.
12. **Submission:** `POST /api/registration/submit` is called.
13. Success → localStorage cleared, page reloads.
14. **Locked:** Page now renders `<LockedRegistration>`.

==================================================
## 7. LOCALSTORAGE DRAFT SYSTEM
==================================================

Because registration forms are massive, progress is saved locally.

- **Key Pattern:** `inter_iiit_registration_{username}` (e.g., `inter_iiit_registration_iiitdm-kancheepuram`).
- **Data Stored:** Stringified JSON containing `contactDetails` (object) and `slotsMap` (object).
- **When Written:** Automatically every 1000ms if form state changes (debounced in a `useEffect`).
- **When Read:** Once, on initial page load of `/register`, if the user has not already submitted to the API.
- **Logout Behavior:** The draft is intentionally **NOT cleared** on logout. A user can log out, close the browser, return tomorrow, log in, and their draft will restore.
- **Submission Behavior:** Immediately deleted from `localStorage` upon a successful 200 response from `/api/registration/submit`.

**CRITICAL RULE:** Authentication tokens, passwords, and session secrets are NEVER stored in localStorage. Sessions rely entirely on secure, backend-managed HTTP-only cookies.

==================================================
## 8. VALIDATION UX
==================================================

Validation is handled entirely by `src/lib/registration/client-utils.js`, which imports the exact same `validateRegistrationRules` used by the backend API.

- **No Field-Level Validation:** Due to the cross-dependent nature of the rules (e.g., max 150 unique students across *all* fields), validation is run globally against the entire payload structure.
- **Floating Action Bar (FAB):** Displays a live summary at the bottom of the screen. If rules are failing, it shows "X issues — open Review to fix."
- **Review Modal:** When opened, translates raw validation errors into readable lists (e.g., "Student roster — Maximum 150 unique students allowed").

==================================================
## 9. REVIEW MODAL
==================================================

The `<ReviewModal>` has two distinct states based on validity:

**State 1: Errors Present**
- Displays a red warning banner detailing the number of issues.
- Lists all specific validation failures (e.g., gender mismatch, over quota).
- Hides the "Submit" button.
- Shows a "Close & Fix Issues" button.

**State 2: Valid (Ready to Submit)**
- Displays a blue "Permanent Action Warning" (cannot be undone).
- Shows summary metrics (Total Unique Students, Total Event Entries).
- Summarizes Contact Details.
- Shows the green "Confirm & Final Submit" button.
- **Submitting State:** Button text changes to "Submitting...", buttons disable, and if the API fails, a red API error banner appears at the top.

==================================================
## 10. LOCKED REGISTRATION
==================================================

The `<LockedRegistration>` component is mounted by `RegisterPage` if `/api/registration` returns a `submitted` status.

- **Detection:** Checked on initial load.
- **UI:** A completely different, read-only interface. Replaces the form entirely.
- **Editable:** Nothing.
- **Features:** Shows the exact time of submission, total counts, and an organized view of their submitted data.
- **Export:** Includes a button to download the finalized CSV (via `/api/registration/csv`).
- **Logout:** Provides a standard logout button.

==================================================
## 11. ADMIN UI
==================================================

The Admin dashboard (`src/app/admin/page.js`) is a comprehensive data view.

- **Top KPI Cards:** Shows Submitted IIITs, Unique Students, Total Entries (via `/api/admin/stats`).
- **Filters:** A 6-input form allowing filtering by IIIT name, Sport, Event, Gender, Roll Number, and Student Name.
- **Data Table:** A paginated table displaying the results of `/api/admin/entries`.
- **Loading State:** Entire table says "Searching database..."
- **Empty State:** Shows a grey icon and "No submitted entries found matching your criteria."
- **CSV Controls:** Two buttons: "Export All" and "Export Current Filter ↓". These trigger a direct browser download of a CSV file.

==================================================
## 12. AUTHENTICATION UI
==================================================

The Login page (`src/app/login/page.js`):
- **Fields:** Username, Password.
- **State:** `loading`, `error`.
- **Failed Login:** Displays a red banner with the exact error message returned by the API.
- **Redirects:** Upon successful login, checks the returned role. Admin goes to `/admin`, IIIT goes to `/register`.
- **Logout Behavior:** Handled globally by sending `POST /api/auth/logout` and routing to `/login`.

==================================================
## 13. COMPLETE API INTEGRATION MAP
==================================================

| API Route | Method | Frontend Caller | Purpose | Expected Behavior |
|-----------|--------|-----------------|---------|-------------------|
| `/api/auth/login` | POST | `src/app/login/page.js` | Authenticate | 200: Returns user role. 401: Returns error msg. |
| `/api/auth/logout` | POST | Global | Terminate session | Clears HTTP-only cookie, 200 OK. |
| `/api/auth/me` | GET | `register/page.js`, `admin/page.js` | Auth check on load | 200: Returns user data. 401: Fails (redirects to login). |
| `/api/registration` | GET | `register/page.js` | Check lock status | 200: Returns submitted data or null if draft phase. |
| `/api/registration/submit` | POST | `register/page.js` (Modal) | Finalize form | 200: Success, triggers reload. 400/500: Fails, shows error in Modal. |
| `/api/admin/stats` | GET | `admin/page.js` | Load KPI data | 200: Returns counts for admin cards. |
| `/api/admin/entries` | GET | `admin/page.js` | Load table data | 200: Returns paginated array of participants based on query string. |
| `/api/admin/csv` | GET | `admin/page.js` | File download | 200: Returns raw CSV text stream prompting a file download in browser. |

==================================================
## 14. API → UI STATE MAPPING
==================================================

- **200 OK:** Proceeds with expected state change (e.g., redirect, data load).
- **401 Unauthorized:** The user's session expired or is invalid. The UI will catch this on page load and redirect to `/login`.
- **400 Bad Request / 409 Conflict:** Usually occurs during submission if validation fails server-side or if the user is already locked. The UI catches the `error` string in the JSON response and displays it to the user.
- **500 Server Error / Network Failure:** The `try/catch` blocks around `fetch` will catch network errors and display a generic "unexpected error" message in the UI error banners.

==================================================
## 15. EDITABLE VS PROTECTED AREAS
==================================================

**SAFE for UI refinement (Modify Freely):**
- **`src/app/(public-pages)/*`**: Pages like `/about`, `/contact`, `/team`, `/gallery`, and `/` are purely presentational and safe to refine.
- **`src/components/*`**: `Navbar.js`, `Footer.js`, `SectionHeading.js` etc.
- **Tailwind Classes:** Modifying `className="..."` across any component for spacing, colors, or responsive behavior is completely safe.
- **Layout structure:** Reordering div blocks, adding icons, tweaking typography.

**Modify only with EXTREME CAUTION (Coordinate with Backend/Logic):**
- **`src/app/register/page.js`**: Do not modify the `useEffect` hooks that handle `localStorage` auto-saving. Do not alter the `handleFinalSubmit` fetch request payload structure.
- **`src/lib/registration/client-utils.js`**: Do not alter how `buildSubmissionPayload` maps `slotsMap` to the final array structure.
- **`src/app/admin/page.js`**: Do not break the `loadEntries` function or the URLSearchParams generation for filters.

**DO NOT TOUCH (Backend/Logic Files):**
- **`src/app/api/*`**: Contains server-side API logic, session handling, and database integration. Modifying these breaks the backend.
- **`src/db/*`**: Contains database schemas and connection logic.
- **`src/lib/validation/rules.js`**: The core business rule engine. Do not alter these rules as part of UI work.
- **`src/lib/sports/config.js`**: The source of truth for sports limits. Do not hardcode new sports into the UI; they must be driven by this config.

==================================================
## 16. CODE-LEVEL PROTECTION GUIDE
==================================================

**In `src/app/register/page.js`:**
- **Protected:** The `useEffect` block handling `localStorage.setItem` and `localStorage.getItem`.
- **Protected:** `handleFinalSubmit` — do not change how it parses errors or calls the API.
- **Safe to refine:** The JSX returned at the bottom of the file (tabs, FAB bar layout, colors).

**In `src/components/registration/ReviewModal.js`:**
- **Protected:** The `formatError` function must safely handle string manipulation. Do not break the `onSubmit` prop execution.
- **Safe to refine:** The modal backdrop, padding, text colors, and list styling for the validation errors.

**In `src/app/admin/page.js`:**
- **Protected:** The `useEffect` handling initial auth and the `downloadMasterCsv` function (which dynamically creates a DOM anchor tag to download).
- **Safe to refine:** The table design (`<table>`, `<th>`, `<td>`), KPI card designs, and filter form layouts.

==================================================
## 17. UI REFINEMENT OPPORTUNITIES
==================================================

Frontend developers are encouraged to improve:
- **Responsive Layout:** Ensure the Admin table and Registration grids (Event Blocks) collapse gracefully on mobile devices.
- **Participant-Slot UX:** Improve the focus states and visual feedback when typing into a Roll Number input.
- **Empty States:** Add better illustrations or visual feedback in the Admin dashboard when a filter returns 0 results.
- **Error Presentation:** Refine the red validation banners in the Registration form to be more prominent or visually appealing.
- **Accessibility:** Add `aria-labels` to form inputs, ensure contrast ratios pass WCAG, and make the Tab navigation keyboard accessible.

==================================================
## 18. ACCESSIBILITY
==================================================

**Current state & needed refinements:**
- The application uses semantic HTML where possible, but `ParticipantSlot` inputs currently lack explicit `<label>` tags linked via `htmlFor`. 
- **Focus states:** Tailwind's default `focus:outline` is used, but custom `focus:ring` states would improve keyboard navigation.
- **Modals:** The `<ReviewModal>` currently lacks trap-focus logic. Keyboard users might tab out of the modal. This is a prime target for frontend refinement.
- **Contrast:** Ensure the green (`#1b5e20`) and yellow (`#f5c518`) brand colors maintain appropriate contrast against text.

==================================================
## 19. ASSET USAGE
==================================================

All static assets live in `public/assets/`. 
- `brand/`: Contains the Inter-IIIT logo (`inter-iiit-logo.png`).
- `hero/`: Contains background images for login and landing pages.
- `sponsors/` & `iiits/`: Contains logos used in purely visual pages.
- **Rule:** Do NOT use external URL imagery (e.g., Unsplash links) in production components. All imagery must be hosted locally in the `public/` directory to guarantee availability and prevent mixed-content warnings.

==================================================
## 20. FRONTEND CHANGE RULES
==================================================

**SAFE:**
- Adjusting Tailwind classes for styling, spacing, layout.
- Breaking large presentational components into smaller chunks.
- Enhancing animations (e.g., Framer Motion or Tailwind transitions).

**CAUTION:**
- Changing state variables (`useState`) in `RegisterPage` or `AdminPage`. 
- Modifying how the `slotsMap` dictionary is structured.

**DO NOT:**
- Do not duplicate or invent backend validation rules inside the UI components. Rely entirely on `client-utils.js` or backend API responses.
- Do not store any auth tokens, passwords, or session identifiers in `localStorage`.
- Do not alter any code inside `src/app/api/`.
- Do not hardcode new sports into the UI; read from `src/lib/sports/config.js`.

==================================================
## 21. FRONTEND DEVELOPER QUICK START
==================================================

1. **Read First:** Start by reading `src/app/register/page.js` to understand how state flows top-down to the registration components.
2. **Key UI Components:** Inspect `src/components/registration/SportSection.js` and `ParticipantSlot.js` to see how user input is captured.
3. **Validation Logic:** Look at `src/lib/registration/client-utils.js` to see how the complex form state is validated in real-time.
4. **Sports Config:** Look at `src/lib/sports/config.js` to understand how the UI knows which sports to render and what limits apply.
5. **Local Dev:** Run `npm run dev`. Navigate to `/login`, use provided seeded credentials to test the IIIT flow (`/register`) and the Admin flow (`/admin`).

==================================================
## 22. FINAL COMPLETE INVENTORY
==================================================
- **Pages:** Home, About, Events, Gallery, Team, Contact, Login, Register, Admin.
- **Major Components:** Navbar, Footer, RegistrationHeader, ContactForm, SportSection, EventBlock, ParticipantSlot, ReviewModal, LockedRegistration.
- **Interactive Elements:** Tab navigator, Floating Action Bar (FAB), Review popup, Admin filter bar, CSV export triggers.
- **APIs Integrated:** `/api/auth/me`, `/api/auth/login`, `/api/auth/logout`, `/api/registration`, `/api/registration/submit`, `/api/admin/stats`, `/api/admin/entries`, `/api/admin/csv`.
- **Local Storage:** `inter_iiit_registration_{username}` strictly used for form drafts.
