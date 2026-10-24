# Your Life Curator

A personal concierge for experiences, culture, friends and travel — it finds things worth doing,
checks whether they realistically fit your time and budget, and helps you plan (never books or sends anything).

> **Status:** a full-stack app with accounts and a Postgres database. Events are still fictional
> sample data, and Google Calendar isn't connected live yet. See `PRODUCT_SPEC.md` for the roadmap.

## Run it
```bash
cd life-curator
npm install
npm run dev          # http://localhost:3000 — create an account on first visit
```
No setup needed: locally the app uses an embedded Postgres (PGlite) stored in `.data/`.
For production, set `DATABASE_URL` to any hosted Postgres (Supabase, Neon, …) — the same
migrations run automatically on startup.

## Architecture
- **Frontend:** Next.js App Router pages (`src/app/(app)`, `src/app/(auth)`), React, Tailwind.
- **Backend:** Next.js API routes in `src/app/api/*`, server code in `src/server/`:
  - `db.ts` — Postgres via `DATABASE_URL`, or embedded PGlite; migrations in `migrations.ts`.
  - `auth.ts` — email/password accounts (scrypt), server-side sessions (only token hashes stored), HttpOnly cookies.
  - `validate.ts` — strict zod validation of every request.
  - `service.ts` — runs the same pure reducer as the browser to apply each change, plus server-only
    checks (e.g. attendance only after an event starts), inside a per-user transaction.
  - `repo.ts` — maps state to tables; every query is scoped to the signed-in user.
- **Domain logic:** `src/lib/domain/` — deterministic scheduling, budget, ranking, taste, Wrapped.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/signup`, `/login`, `/logout`, `GET /api/auth/me` | Accounts and sessions |
| `GET /api/state` | The signed-in user's data |
| `POST /api/actions` | Apply one validated change |
| `GET /api/events` | Event catalogue (public, sample data for now) |
| `GET /api/export`, `DELETE /api/account` | Data export and account deletion |

Security: same-origin checks on every state-changing request, SameSite=Lax HttpOnly cookies,
login and signup rate limits, no payload or credential logging, cascading account deletion.

## What works now
- **This Week** — evening availability strip, budget summary, a shortlist of ≤6 calendar-compatible
  suggestions (fewer when the week is busy), travel-worthy ideas, booking deadlines, saved/planned list,
  and **Generate my weekly plan** (manual, deterministic, one plan per week with run history).
- **Discover** — London and Europe views with filters for date, category, price, neighbourhood/city,
  company, weekday/weekend, duration, novelty, calendar fit, and explicit browsing inside protected time.
  Europe adds weekend-fit, direct route, booking deadline, strong match, one-off and max trip cost filters.
- **Event details** — facts with explicit unknowns, why it fits, calendar fit with leave-by time,
  status controls (interested → saved → invited → planned → attended, skipped, not for me with reasons),
  budget warning with intentional override, actual-cost recording, reflection, editable/copyable invitation.
- **Trips** — whole-trip feasibility (reference journey times, overnight, leave days, conflicts, protected time),
  separate ticket/transport/accommodation/other costs with your own research estimates, travel shortlist statuses.
- **My Life** — every status plus the travel shortlist, with search and filters.
- **Wrapped** — your history by year (including things from before you used the app), each rated
  out of 5: totals, a persona, month-by-month chart, top-rated, categories, company, places, spend.
  Ratings build a taste profile that nudges recommendations (never past hard constraints), with
  explanations like "You've rated 3 jazz experiences 4.7★ on average."
- **Settings** — places, office days, calendar mode, protected-time blocks, budget & exchange rate,
  interests, planning, travel, digest preferences, JSON export, delete-all.

## What is demo-only or not built
| Area | State |
|---|---|
| Events | Fictional sample feeds (two, to exercise deduplication) |
| Calendar | Sample busy times or "no calendar"; Google Calendar not connected |
| Persistence | Real database and accounts; no hosted deployment yet |
| Travel prices | Not fetched; journey times are typical reference durations |
| Digest | Manual only; no scheduler; nothing is ever emailed |
| AI | Not used; explanations are deterministic templates |

## Needs credentials / decisions before next phases
- **Hosting** (e.g. Vercel) and a **hosted Postgres** connection string (`DATABASE_URL`, e.g. Supabase or Neon).
- **Google Cloud OAuth client** with the `calendar.freebusy` (or `calendar.readonly`) scope (Phase 3).
- **Event sources**: choose permitted APIs/feeds (e.g. venue ICS feeds, Ticketmaster Discovery API — check terms) (Phase 4).
- Scheduler (e.g. Vercel Cron / Supabase scheduled functions) and any notification channel (Phase 6).

## Tests
```bash
npm run check                       # typecheck, lint, unit + backend integration tests
npm run build && npm run e2e        # Playwright: desktop + mobile, against the real backend
```

## Privacy
Each user's data is private to their account. No analytics, no third-party requests (apart from links you choose to open).
When Google Calendar is added, only free/busy intervals will be read — never titles or descriptions —
and nothing is written back. Third parties that will receive data in later phases: Supabase (storage),
Google (calendar OAuth).
