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

## Deploy
See **[DEPLOY.md](DEPLOY.md)** — Vercel + Supabase, about 15 minutes. Check `/api/health` afterwards.

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
| `GET /api/events` | Event catalogue and source status (cached per source in the database) |
| `GET /api/health` | Setup check: database, schema, scheduled jobs, sources (no secrets) |
| `GET /api/cron/*` | Daily jobs (event refresh, weekly plans); require `CRON_SECRET` |
| `POST /api/import` | Read one pasted event page into a draft (https only, public IPs only, size and time limits) |
| `GET /api/export`, `DELETE /api/account` | Data export and account deletion |

Security: same-origin checks on every state-changing request, SameSite=Lax HttpOnly cookies,
database-backed rate limits (hashed keys), optional invite-only sign-up, no payload or credential
logging, cascading account deletion. Changes made together are saved as one atomic batch.

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
- **Hobbies** — set goals (e.g. "speak confidently in public", or your own words), track hobbies
  (curious → signed up → trying → part of my life), log your next class, rate how it's going, and get
  suggestions ranked by interests, goals, past ratings and natural next steps (acting → improv,
  public speaking, voice), with upcoming events that let you try each one.
- **Add your own events** — paste a link (reads the event details many sites publish for search
  engines) or add by hand, including invitation-only galas with a "how to get in" note. Private to you.
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
| Events | Ticketmaster and Eventbrite adapters built and tested against sample responses; they switch on with API keys. Until then, fictional sample feeds |
| Calendar | Sample busy times or "no calendar"; Google Calendar not connected |
| Persistence | Real database and accounts; no hosted deployment yet |
| Travel prices | Not fetched; journey times are typical reference durations |
| Digest | Manual only; no scheduler; nothing is ever emailed |
| AI | Not used; explanations are deterministic templates |

## Needs credentials / decisions before next phases
- **Hosting** (e.g. Vercel) and a **hosted Postgres** connection string (`DATABASE_URL`, e.g. Supabase or Neon).
- **Google Cloud OAuth client** with the `calendar.freebusy` (or `calendar.readonly`) scope (Phase 3).
- **Built in, automatic**: Luma's London feed plus ~25 curated London venues (classical, jazz, theatre,
  galleries, talks, film), read daily from their published event data with robots.txt respected.
- **AI scout** (optional, `ANTHROPIC_API_KEY` + `SCOUT_ENABLED=1`): Claude (`claude-opus-5-5`, web search)
  proposes events twice a week; the app keeps only those confirmed by the organiser's own page.
- **Ticketmaster**: `TICKETMASTER_API_KEY` (free at developer.ticketmaster.com). Covers London plus the
  European destinations (`TICKETMASTER_EUROPE=0` to limit to London).
- **Eventbrite**: `EVENTBRITE_TOKEN` + `EVENTBRITE_ORGANIZER_IDS` (comma-separated). Eventbrite has no
  public search, so it follows organisers you choose.
- Sample events turn off automatically once a real source is set (`DEMO_EVENTS=1` keeps them).
- **Calendar feeds** (`EVENT_ICS_FEEDS`): Luma calendars, Meetup groups and venue iCal feeds. Timed,
  in-person, non-recurring events only.
- **Venue pages** (`EVENT_PAGES`): "What's on" pages that publish schema.org event data. robots.txt is
  checked first; disallowed pages are skipped. Only add sites whose terms allow it.
- Not supported, by design: DICE (no public API), Instagram (doesn't permit reading posts), and Google's
  event listings (no official API; third-party resellers are paid and often lack exact times). Use
  "Add from a link" or "Add by hand". No scraping.
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
