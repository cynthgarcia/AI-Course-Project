# Your Life Curator

A personal concierge for experiences, culture, friends and travel — it finds things worth doing,
checks whether they realistically fit your time and budget, and helps you plan (never books or sends anything).

> **Status: Phase 1 demo.** All events are fictional sample data and the calendar is a sample
> calendar. Nothing is live, real or bookable yet. See `PRODUCT_SPEC.md` for the roadmap.

## Run it
```bash
cd life-curator
npm install
npm run dev          # http://localhost:3000
```
No environment variables are needed. Data is stored in your browser's localStorage only.

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
- **Settings** — places, office days, calendar mode, protected-time blocks, budget & exchange rate,
  interests, planning, travel, digest preferences, JSON export, delete-all.

## What is demo-only or not built
| Area | State |
|---|---|
| Events | Fictional sample feeds (two, to exercise deduplication) |
| Calendar | Sample busy times or "no calendar"; Google Calendar not connected |
| Persistence | This browser only; no accounts (Supabase schema drafted, not applied) |
| Travel prices | Not fetched; journey times are typical reference durations |
| Digest | Manual only; no scheduler; nothing is ever emailed |
| AI | Not used; explanations are deterministic templates |

## Needs credentials / decisions before next phases
- **Supabase** project URL + anon key + service role key (Phase 2).
- **Google Cloud OAuth client** with the `calendar.freebusy` (or `calendar.readonly`) scope (Phase 3).
- **Event sources**: choose permitted APIs/feeds (e.g. venue ICS feeds, Ticketmaster Discovery API — check terms) (Phase 4).
- Scheduler (e.g. Vercel Cron / Supabase scheduled functions) and any notification channel (Phase 6).

## Tests
```bash
npm run check                       # typecheck, lint, 63 unit tests
npm run build && npm run e2e        # Playwright: desktop + mobile flows
```

## Privacy
No accounts, no analytics, no third-party requests (apart from links you choose to open).
When Google Calendar is added, only free/busy intervals will be read — never titles or descriptions —
and nothing is written back. Third parties that will receive data in later phases: Supabase (storage),
Google (calendar OAuth).
