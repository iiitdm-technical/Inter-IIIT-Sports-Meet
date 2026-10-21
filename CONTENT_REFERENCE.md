> **Status note (21 October 2026):** this handoff predates cloud drafts, payments, server-side sessions, the single organizer admin and the redesign. See `README.md`, `PROJECT_OVERVIEW.md` and `HOSTING_REQUIREMENTS.md` for the current system.

# CONTENT REFERENCE GUIDE
## 9th Inter-IIIT Sports Meet 2026

==================================================
## 1. DOCUMENT PURPOSE
==================================================

This document serves as the single quick-reference guide for ALL website content across the 9th Inter-IIIT Sports Meet 2026 project. 

**Core Principle:** *If content is listed here, it is explicitly identified existing project content or approved. If content is not listed here, the team must NOT assume that it belongs on the website.*

This document helps frontend developers, backend developers, and content editors quickly verify exact naming conventions, event rules, missing assets, and page-specific content without having to dig through source code.

==================================================
## 2. EVENT IDENTITY
==================================================

| Element | Current Value | Source | Status |
|---|---|---|---|
| **Official Name** | 9th All India Inter-IIIT Sports Meet | `src/data/info.js` | IMPLEMENTED |
| **Short Name** | Inter-IIIT Sports Meet 2026 | `src/data/info.js` | IMPLEMENTED |
| **Edition** | 9th Edition | `src/app/page.js` | IMPLEMENTED |
| **Host Institute** | IIITDM Kancheepuram | `src/data/info.js` | IMPLEMENTED |
| **Dates** | 19 December to 23 December 2026 | `src/data/info.js` | IMPLEMENTED |
| **Expected Footfall** | 5,000+ | `src/data/info.js` | IMPLEMENTED |
| **Student-Athletes**| 2,000+ | `src/data/info.js` | IMPLEMENTED |

==================================================
## 3. IIIT / INSTITUTE MASTER LIST
==================================================

**Total Expected IIIT Accounts:** 25
**Admin Account Exists:** Yes (`username: admin`)
**Username Convention:** Slugified version of the institute name (e.g., `iiitdm-kancheepuram`).
**Credentials:** Passwords are pre-seeded via `.env.local` configuration.
**Source of Truth:** `src/data/iiits.js` and `src/db/seed.js`

| # | IIIT Code | Official Institute Name | Logo Available |
|---|---|---|---|
| 1 | iiit-allahabad | IIIT Allahabad | Yes (`IIIT Allahabad.png`) |
| 2 | iiitm-gwalior | IIITM Gwalior | Yes (`IIIT Gwalior.png`) |
| 3 | iiitdm-jabalpur | IIITDM Jabalpur | Yes (`IIIT Jabalpur.png`) |
| 4 | iiitdm-kancheepuram | IIITDM Kancheepuram | Yes (`IIITDM Kancheepuram.png`) |
| 5 | iiitdm-kurnool | IIITDM Kurnool | Yes (`IIITDM Kurnool.png`) |
| 6 | iiit-sri-city | IIIT Sri City | Yes (`IIIT Chittoor.png`) |
| 7 | iiit-guwahati | IIIT Guwahati | Yes (`IIIT Guwahati.png`) |
| 8 | iiit-kalyani | IIIT Kalyani | Yes (`IIIT Kalyani.png`) |
| 9 | iiit-una | IIIT Una | Yes (`IIIT Una.png`) |
| 10 | iiit-vadodara | IIIT Vadodara | Yes (`IIIT Vadodara.png`) |
| 11 | iiit-kota | IIIT Kota | Yes (`IIIT Kota.png`) |
| 12 | iiit-tiruchirappalli | IIIT Tiruchirappalli | Yes (`IIIT Tiruchirapalli.png`) |
| 13 | iiit-kottayam | IIIT Kottayam | Yes (`IIIT Kottayam.png`) |
| 14 | iiit-sonepat | IIIT Sonepat | Yes (`IIIT Sonepat.png`) |
| 15 | iiit-manipur | IIIT Manipur | Yes (`IIIT Manipur.png`) |
| 16 | iiit-lucknow | IIIT Lucknow | Yes (`IIIT Lucknow.png`) |
| 17 | iiit-dharwad | IIIT Dharwad | Yes (`IIIT Dharwad.png`) |
| 18 | iiit-ranchi | IIIT Ranchi | Yes (`IIIT Ranchi.png`) |
| 19 | iiit-nagpur | IIIT Nagpur | Yes (`IIIT Nagpur.png`) |
| 20 | iiit-pune | IIIT Pune | Yes (`IIIT Pune.png`) |
| 21 | iiit-bhopal | IIIT Bhopal | Yes (`IIIT Bhopal.png`) |
| 22 | iiit-surat | IIIT Surat | Yes (`IIIT Surat.png`) |
| 23 | iiit-agartala | IIIT Agartala | Yes (`IIIT Agartala.png`) |
| 24 | iiit-raichur | IIIT Raichur | Yes (`IIIT Raichur.png`) |
| 25 | iiit-bhagalpur | IIIT Bhagalpur | Yes (`IIIT Bhagalpur.png`) |

==================================================
## 4. SPORTS MASTER CATALOGUE
==================================================

**Source of Truth:** `src/lib/sports/config.js` (The backend validation engine).
*Note: A conflict exists with the frontend presentation file (`src/data/sports.js`). The backend engine is the authoritative source.*

| Sport ID | Name | Type | Categories | M Limit | F Limit | Exempt from 2-sport rule? |
|---|---|---|---|---|---|---|
| `athletics` | Athletics | Events | M, F | - | - | **Yes** |
| `aquatics` | Aquatics | Events | M, F | - | - | **Yes** |
| `powerlifting`| Powerlifting | Weights | M, F | 2/wt | 2/wt | No |
| `badminton` | Badminton | Team | M, F | 5 | 3 | No |
| `basketball`| Basketball | Team | M, F | 12 | 10 | No |
| `carrom` | Carrom | Team | M, F | 3 | 3 | No |
| `cricket` | Cricket | Team | M only | 15 | - | No |
| `kabaddi` | Kabaddi | Team | M, F | 12 | 12 | No |
| `football` | Football | Team | M only | 16 | - | No |
| `table_tennis`| Table Tennis | Team | M, F | 3 | 3 | No |
| `lawn_tennis` | Lawn Tennis | Team | M, F | 3 | 3 | No |
| `volleyball`| Volleyball | Team | M, F | 12 | 10 | No |
| `squash` | Squash | Team | M, F | 3 | 3 | No |
| `tug_of_war`| Tug of War | Team | M, F | 8 | 8 | No |
| `kho_kho` | Kho-Kho | Team | M, F | 12 | 12 | No |
| `chess` | Chess | Mixed Team| Mixed| (4 Total)| (4 Total)| No |

==================================================
## 5. ATHLETICS CATALOGUE
==================================================
**Source:** `src/lib/sports/config.js`

**Rules:** 
- Max 2 main participants & 1 reserve per individual event.
- Max 4 main participants & 2 reserves per relay.
- Max 3 individual events per student (excluding relays).

**Men's Events:** 100M, 200M, 400M, 800M, 1500M, 5000M, 4x100M Relay, 4x400M Relay, Long Jump, High Jump, Triple Jump, Shot Put, Discus Throw, Javelin Throw, Hurdles 110M.
**Women's Events:** 100M, 200M, 400M, 800M, 1500M, 3000M, 4x100M Relay, Long Jump, High Jump, Shot Put, Discus Throw, Hurdles 110M.

==================================================
## 6. AQUATICS CATALOGUE
==================================================
**Source:** `src/lib/sports/config.js`

**Rules:** 
- Max 2 main participants (no reserves) per individual event.
- Max 4 main participants & 2 reserves per relay.
- Max 3 individual events per student (excluding relays).

**Events (Same for Men & Women):** 
50M Freestyle, 100M Freestyle, 200M Freestyle (M only), 50M Backstroke, 100M Backstroke, 200M Backstroke (M only), 50M Butterfly, 100M Butterfly, 200M Butterfly (M only), 50M Breaststroke, 100M Breaststroke, 200M Breaststroke (M only), 200M Individual Medley, 4x50M Freestyle Relay, 4x50M Medley Relay.
*(Note: 200M variants are Men only in config).*

==================================================
## 7. COMBINED EVENTS / SPECIAL CATEGORIES
==================================================

- **Chess:** Classified as `combined_team`. Gender array accepts `['mixed']`. Total team limit is 4 students combined.
- **Powerlifting (Men):** Up to 66 KG, 66.01 to 74 KG, 74.01 to 83 KG, 83.01 KG+. (2 participants per category).
- **Powerlifting (Women):** Up to 52 KG, 52.01 to 63 KG, 63.01 to 72 KG, 72.01 KG+. (2 participants per category).

==================================================
## 8. REGISTRATION CONTENT + BUSINESS RULES
==================================================

**Participant Fields:** Roll Number (Identity), Name, Gender (M/F).
**Normalization:** Roll numbers and names are automatically trimmed and uppercase'd by the backend.
**Identity Constraint:** Submitting the same roll number with two different student names triggers a validation error.
**Global Limits:** Maximum 150 unique students per IIIT.
**Multi-Sport Limit:** Maximum 2 normal sports per student (Athletics and Aquatics are exempt from this count).
**Submission UX:** 
- Form automatically saves drafts to `localStorage`.
- Final submit locks the form completely.
- Locked screen shows: "Once submitted, this registration will be permanently locked and cannot be edited. For corrections after submission, you must contact IIITDM Kancheepuram Sports Cell."

==================================================
## 9. FRONTEND CONTENT INVENTORY
==================================================

| Category | Item | Current File | Usage |
|---|---|---|---|
| **Branding** | Main Logo | `/assets/brand/inter-iiit-logo.png` | Hero, Navbar |
| **Hero** | Background | `/assets/hero/hero-placeholder.png` | Landing page |
| **Gallery** | Gallery 01-06 | `/assets/gallery/gallery-01.jpg` to `06.jpg` | About & Home pages |
| **Sponsors** | Sponsor 1-5 | `/assets/sponsors/sponsor-01.png` to `05.png` | Home footer |
| **Sports** | Images | `/assets/events/*.jpg` | `/events` page grid |
| **Institutes** | IIIT Logos | `/assets/iiits/*.png` | Home grid |

==================================================
## 10. BRANDING CONTENT
==================================================

**Official Taglines (Currently Implemented):**
- "A Legacy of Sportsmanship" (Home/About)
- "Beyond the Field" (About page)
- "25+ IIITs · 1 Champion" (Home page)

**Colors:** 
- Brand Green: `#0a2112`, `#1b5e20`
- Brand Gold/Yellow: `#f5c518`, `#c9972f`
- Background: `#faf6ee`

==================================================
## 11. PAGE-BY-PAGE CONTENT MAP
==================================================

### `/` (Home Page)
**Content Present:** Hero block, "19-23 Dec" ticker, 4 KPI stats, "About the Meet" snippet, IIIT logo grid, Students' vs Employees' Meet split block, Gallery preview, Sponsor grid, "Contact us -> sports@iiitdm.ac.in".

### `/about`
**Content Present:** "History & Legacy" text (from `info.js`), KPI stats, 2 gallery images, "Beyond the Field" vision block.

### `/events`
**Content Present:** 15 Sport cards rendered from `src/data/sports.js`. *(Warning: This currently conflicts with the 16 sports in the backend config).*

### `/team`
**Content Present:** 
- Patron (Director)
- Advisory/Monitoring Committee (Deans, Registrar)
- Employee Core Team (Finance, Security, Accommodation, Web Ops)
- Student Core Team (President, Sports Sec, Gen Sec)
*(Currently uses placeholder names like "Prof. ABC" and "Dr. John Doe").*

==================================================
## 12. REGISTRATION PAGE CONTENT MAP
==================================================

### `/register`
**Header:** Displays IIIT Name, Unique Students count, "Last saved" timestamp, and Sign Out button.
**Contact Form:** Name, Email, Phone, Additional Notes.
**Navigation:** Tabs for "Men's Events", "Women's Events", "Combined Events".
**Action Bar:** Floating bar at bottom. Shows live error count or green "All validation rules passed".
**Review Modal:** 
- List of specific human-readable errors.
- "Permanent Action Warning" (Blue banner).
- Summary counts.
- "Confirm & Final Submit" button.

==================================================
## 13. ADMIN CONTENT MAP
==================================================

### `/admin`
**Dashboard Cards:** Submitted IIITs, Unique Students, Total Event Entries.
**Filters:** IIIT, Sport, Event, Gender, Roll Number, Student Name.
**Controls:** "Clear", "Apply Filters", "Export All", "Export Current Filter".
**Table Columns:** IIIT Name, Sport, Event, Gender, Roll Number, Student Name.
**Empty State:** "No submitted entries found matching your criteria."

==================================================
## 14. AUTHENTICATION CONTENT
==================================================

### `/login`
**Content:** 
- Username (IIIT Code or admin)
- Password
- Error banners returned dynamically from the API (e.g., "Invalid credentials").

==================================================
## 15. CONTENT / DATA SOURCE MAP
==================================================

| Content Area | Source Code File | Status |
|---|---|---|
| Business Rules & Limits | `src/lib/sports/config.js` | Authoritative |
| Sport List (Registration) | `src/lib/sports/config.js` | Authoritative |
| Sport List (Frontend UI) | `src/data/sports.js` | Contains Conflicts |
| IIIT List & Logos | `src/data/iiits.js` | Authoritative |
| General Info & Dates | `src/data/info.js` | Authoritative |
| Gallery Images | `src/data/gallery.js` | Implemented |
| Team Hierarchy | `src/app/team/page.js` | Contains Placeholders |

==================================================
## 16. CONTENT STATUS / GAP CHECKLIST
==================================================

### ❌ Conflicting (Requires Immediate Attention)
- **Sport Catalogs Disagree:** The backend `config.js` defines 16 sports (including Squash, Tug of War, and Lawn Tennis). The frontend presentation `sports.js` only defines 15 sports (missing Squash and Tug of War, includes Handball which the backend lacks, and calls Lawn Tennis just "Tennis").
- **Aquatics 200M Limits:** Backend config restricts 200M Freestyle, Backstroke, Butterfly, and Breaststroke to Men only. If Women are meant to swim 200M, the config must be updated.

### ⚠️ Required but Missing / Placeholder
- **Team Names:** `src/app/team/page.js` is currently hardcoded with placeholders ("Prof. ABC", "John Doe"). These must be updated with the real 2026 organizing committee names.
- **Sponsors:** Current logos in `/public/assets/sponsors/` are placeholders. Real sponsor logos must be acquired.
- **Contact Info:** Currently pointing to a generic `sports@iiitdm.ac.in`.

### ✅ Present and Implemented
- Registration constraint engine.
- IIIT list (25 institutes).
- Gallery images.
- Event identity and dates.

==================================================
## 17. FRONTEND TEAM QUICK CHECKLIST
==================================================

- [ ] Reconcile `src/data/sports.js` to match the exact 16 sports defined in `src/lib/sports/config.js`.
- [ ] Add missing event imagery for Squash and Tug of War to `public/assets/events/`.
- [ ] Remove "Handball" from the frontend if it is not a sanctioned sport in `config.js`.
- [ ] Obtain the real names for the Organizing Committee to replace placeholders in `/team`.
- [ ] Ensure all IIIT logos in `/public/assets/iiits/` are high-resolution and maintain a consistent aspect ratio.
- [ ] Review the "Contact us" email address on the homepage footer for accuracy.
