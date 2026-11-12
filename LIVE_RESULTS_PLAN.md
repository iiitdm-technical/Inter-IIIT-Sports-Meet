# Live Results Board — Plan

Status: **phase 1 built** on branch `feature/live-results` (3 Nov 2026), not yet deployed. Deploying needs `./update.sh --migrate` (migration `0003_live_results`, add-only) after a database backup.

### What phase 1 includes

- Public `/live` (no login, "Live" in the navbar): Live now, Up next, Results, Medal tally; filters for sport, category and IIIT kept in the link; refreshes every 10 s while the tab is open; sample-data banner; times in IST.
- `/admin/live` for coordinators (phone-first): their own sports only; start, +/− score with a detail line, finish with winner (no draw in a Final / 3rd place), placings for athletics / aquatics / powerlifting. A stale save is refused and the latest score is shown.
- Super admin (`sports-sac`) on the same page: all sports, schedule a match, edit / postpone / cancel / delete, reopen a finished match, change history, coordinator management (add by email with a one-time password, change sports, new password, remove), add / clear sample matches. A "Live results" button is on `/admin`.
- API: `GET /api/live`; `GET/POST /api/admin/live/matches`; `GET/PATCH/DELETE /api/admin/live/matches/:id` (PATCH actions: start, score, placings, finish, reopen, details); `GET/POST /api/admin/live/coordinators`; `PUT/POST/DELETE /api/admin/live/coordinators/:id`; `POST/DELETE /api/admin/live/sample`.
- Medals are counted from completed Finals and 3rd-place matches. Championship points wait for the Sports Board's rules (open question 2).
- Not yet built: undo button (the change history is recorded), CSV schedule import, points table, big-screen mode.

### Brackets (branch `feature/brackets`, 12 Nov 2026)

- **Tournaments** per sport and category (optionally named, e.g. "Singles"), each with its own pool points (win/draw/loss), whether pool draws are allowed, how many go through from each pool (highlighted only) and a 3rd-place match.
- **Admin** (`/admin/live` → Brackets, super admin only):
  1. Teams and pools: any number of pools and teams; "Spread evenly" is a helper.
  2. Pool matches: round-robin; preview, then apply. Played matches are never removed.
  3. Standings: points, then head-to-head, score difference, score; any pool's order can be set by hand.
  4. Knockout: 2–32 teams placed by hand (pre-fill from standings is a suggestion); empty positions are byes. Winners, and semi-final losers to the 3rd-place match, move on automatically; reopening a match takes them back out if the next match has not started.
  5. Schedule (optional): times and venues in play order within a daily window. Every match stays editable and deletable one by one.
- **Public** `/brackets?t=<id>&view=bracket|schedule|list`: pool leaderboards with match logs, the knockout tree, the schedule and the full match log; linked from `/live` (not in the navbar while Live is hidden).
- Matches may now have no time ("Time TBA"); pools go up to Z. Migration `0006_tournaments` (add-only, plus `matches.scheduled_at` made nullable).
- Sample data now includes a 20-team sample football tournament.

A public, live-updating results board for the 9th All India Inter-IIIT Sports Meet (19–23 Dec 2026), in the spirit of IIITDM Jabalpur's Employee Sports Meet `/live` page. The reference page (`employee-sportsmeet.iiitdmj.ac.in/live`) did not respond from our network or from our server when this plan was written; screenshots of it would help match its layout.

## Goals

1. Anyone can open **/live** on a phone or a projector and see what is happening now, what is next, and final results, without signing in.
2. Scores are entered **at the venue, from a phone**, by the coordinator of that sport.
3. Each coordinator can change **only their own sports**. The Sports SAC (super admin) can change everything and manage coordinators.
4. Every change is recorded (who, when, what), and a wrong entry can be corrected.
5. Until the official schedule arrives, the board shows **sample matches between real IIITs**, clearly marked as sample data and removable with one command.

## Roles

| Role | Who | Can |
| --- | --- | --- |
| **Super admin** | `sports-sac` (`sports@iiitdm.ac.in`), the existing admin | Everything: manage coordinators and their sports, create and edit the schedule, enter or correct any result, finalise and reopen matches, import the schedule, clear sample data. Keeps all current admin powers (registrations, payments). |
| **Coordinator** (Sainatha's "admin") | Volunteers added by email by the super admin | For **their assigned sports only**: start a match, update the score, set the winner or placings, finalise. Cannot see registrations, payments or other sports. |
| **Public** (Sainatha's "user") | Everyone | View `/live`. No login. |
| IIIT accounts | Existing 25 accounts | Unchanged. They see `/live` like the public. |

Implementation: a new `coordinator` value in `users.role`, plus a `coordinator_sports` table (user, sport, optional gender). The super admin adds a coordinator with email, name and sports; the site generates a password to hand over (same flow as the IIIT accounts), and can revoke access at any time (which signs the coordinator out everywhere). Every API route checks the role **and** the sport on the server, never in the browser only.

## What the public sees (`/live`)

- **Live now**: matches in progress, with the score, the period or set, the venue and "updated 20 s ago". Highlighted at the top.
- **Up next**: today's schedule in time order, with venue.
- **Results**: completed matches and events, newest first; finals and medal positions are emphasised.
- **Points table / medal tally**: IIITs ranked by championship points (rules below), with gold/silver/bronze counts. Men's, women's and overall views.
- **Filters**: sport, men/women/mixed, day, IIIT ("follow my IIIT").
- **Big-screen mode** (`/live?tv=1`): large type, auto-rotating sections, for a projector at the venue.
- Updates **every 10 seconds** automatically, without reloading the page; a small "Live" indicator shows when data is fresh, and "Reconnecting…" if the phone loses signal.

## What a coordinator sees (`/admin/live`)

Designed for a phone at the venue, one hand, outdoors:

- A list of **their** matches for today: *Scheduled*, *Live*, *Completed*.
- Tap a match → **Start** → large **+ / −** buttons for each side, or set and period fields where the sport needs them → **Finish** → confirm the winner → **Finalise**.
- Athletics, aquatics and powerlifting: enter the **placings** (1st–4th, IIIT, athlete name, time / distance / weight) for each event or weight class.
- **Undo last change** for 2 minutes; after finalising, only the super admin can reopen.
- Clear errors if two people edit the same match at once (the second save is refused and the latest score is shown).

The super admin additionally sees: all sports, the schedule editor, coordinator management, the CSV import, the change log, and a "clear sample data" button.

## Sports and how their results are entered

| Kind | Sports | Entered as |
| --- | --- | --- |
| Team vs team, simple score | Football, Basketball, Kabaddi, Kho-Kho, Handball | Score A – Score B (+ optional note, e.g. "won on penalties 4–3") |
| Team vs team, by sets/games | Volleyball, Badminton, Table Tennis, Lawn Tennis, Tug of War | Sets won, plus set scores ("25-18, 22-25, 15-11") |
| Cricket | Cricket | Runs/wickets/overs per side ("152/6 (20)"), result text ("IIIT Kota won by 23 runs") |
| Board points | Chess | Match points per board total ("2.5 – 1.5") |
| Timed / measured events | Athletics, Aquatics (incl. relays and mixed relays) | Heats and finals: placings with time or distance |
| Weight classes | Powerlifting | Placings per weight class with total lifted |

Phase 1 stores a structured score A/B plus a free-text detail line for every team sport, so any sport can be entered from day one; sport-specific inputs (sets, cricket overs) come in phase 2.

## Points and medals

Rulebook Table 3 gives championship points per sport for positions I–IV: **team sports 10 / 6 / 4 / 2**, **athletics and aquatics 20 / 12 / 8 / 4**, counted separately for men and women (chess is combined). The tally is computed from **finalised** results only, so a live score never changes the standings. *To confirm with the Sports Board:* whether athletics/aquatics points are per event or for the overall sport championship, and the tie-break rule.

## Data model (MySQL, one add-only migration)

- `coordinator_sports` — user_id, sport_id, gender (nullable = all).
- `matches` — id, sport_id, gender (M/F/mixed), event_id (for individual events), round (league, quarter-final, semi-final, final, heat…), venue, scheduled_at, status (scheduled / live / completed / postponed / cancelled), side_a and side_b (IIIT codes), score_a, score_b, score_detail, winner (IIIT code or draw), result_note, is_sample, version (for safe concurrent edits), created_by, updated_by, timestamps.
- `event_placings` — match_id, position (1–8), iiit_code, athlete name, mark (time / distance / weight).
- `match_changes` — match_id, user, timestamp, before → after (JSON). Powers undo, the change log and dispute checks.

Storage is negligible: a few thousand rows, well under 5 MB, against the 3 GB allocation.

## API

Public (cached a few seconds on the server, so 500 phones refreshing cost almost nothing):

- `GET /api/live` — live and today's matches, latest results, points table; supports `?sport=&gender=&day=&iiit=`.

Coordinator / super admin (signed in, same-origin, rate-limited, audited):

- `GET /api/admin/live/matches` — the matches this user may edit.
- `PATCH /api/admin/live/matches/:id` — start, score, finish, finalise (sport scope and version checked).
- `PUT /api/admin/live/matches/:id/placings` — individual-event placings.
- `POST /api/admin/live/matches/:id/undo`.
- Super admin only: `POST/PATCH/DELETE /api/admin/live/schedule`, `POST /api/admin/live/schedule/import` (CSV), `GET/POST/DELETE /api/admin/coordinators`, `DELETE /api/admin/live/sample-data`.

Live updates use polling every 10 seconds (no WebSockets): it works behind DreamHost's proxy and with our single app process, and degrades gracefully on poor mobile networks.

## Sample data until the schedule arrives

`npm run db:seed-live-sample` adds a realistic day of matches between real IIITs (a few live, some upcoming, some completed, plus an athletics final), all marked `is_sample`. `/live` shows a **"Sample data — official schedule coming soon"** banner while any sample row exists. One button (super admin) or `npm run db:clear-live-sample` removes every sample row; real results are never touched.

## Schedule import

When the organizers share the schedule, the super admin uploads a CSV (or we import it):

```
date,time,sport,gender,round,venue,side_a,side_b
2026-12-19,09:00,football,M,League,Main Ground,iiit-kota,iiitdm-jabalpur
```

The import validates sports, IIIT codes and dates, shows a preview, and creates or updates matches in one go.

## Phases

| Phase | Scope | Effort |
| --- | --- | --- |
| **1** | Migration; coordinator role and sport scoping; coordinator management for the super admin; schedule and match CRUD; public `/live` with polling; sample data and banner | ~1 day |
| **2** | Phone scoring screen (start / +− / finish / finalise / undo); sets and cricket inputs; individual-event placings; change log | ~1 day |
| **3** | Points table and medal tally; CSV schedule import; filters and "follow my IIIT"; big-screen mode | ~1 day |
| **4** | Rehearsal with real coordinators on phones; load test of `/live`; fixes | ~0.5 day |

Each phase ships behind the existing deploy checks (tests, build, health checks). Tests cover: a coordinator cannot change another sport (server-side), concurrent edits, undo, points calculation, sample-data removal, and `/live` on mobile.

## Open questions

1. Coordinator list: who covers which sport (and gender), with their emails.
2. Points rules: confirm Table 3 usage for athletics/aquatics, and tie-breaks.
3. Should finalising need super-admin approval, or is the coordinator's final result official (with the super admin able to correct)? *Proposed: coordinator finalises; super admin can reopen.*
4. Schedule format and when it will be available.
5. Any sport-specific display wishes (e.g. cricket ball-by-ball is out of scope; final score and summary only).
6. Screenshots of the IIITDMJ `/live` page, if a specific look is wanted.
