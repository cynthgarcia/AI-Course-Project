# Your Life Curator — product spec (condensed)

The full master specification was provided in the initial brief and is canonical. This file
records the decisions that shape the code and where each lives.

## Vision
A personal concierge for experiences, culture, friends and travel. Quality over quantity;
personal relevance over popularity; a fuller life, not a busier one. All external actions stay
under user control: **no bookings, purchases, calendar writes or messages in the MVP.**

## Hard rules (deterministic code, never AI)
| Rule | Where |
|---|---|
| Calendar conflicts incl. travel + prep buffer | `src/lib/domain/availability.ts` |
| Personal Time & Keep Open for Friends never filled; browsing them never recategorises | `availability.ts`, `trip.ts` |
| Timezones & DST (Intl-based, tested across 25 Oct 2026 change) | `src/lib/domain/time.ts` |
| Late finishes / getting home; Mon–Fri location not assumed | `availability.ts` |
| Whole-trip feasibility; leave days flagged, never assumed | `src/lib/domain/trip.ts` |
| Budget: one figure per item (actual > planned), unknown ≠ 0, no FX unless user-entered | `src/lib/domain/budget.ts` |
| Status transitions reflect actual behaviour | `src/lib/domain/status.ts` |
| Hard exclusions applied before scoring; ≤6 shortlist; diversity | `src/lib/domain/ranking.ts` |
| Deduplication keeps separate performances | `src/lib/domain/dedupe.ts` |
| One plan per week, run history, safe retry | `src/lib/domain/weeklyPlan.ts` |
| Taste profile from 1–5★ ratings (shrunk toward neutral, samples excluded) | `src/lib/domain/taste.ts` |
| Wrapped yearly summary (no invented costs) | `src/lib/domain/wrapped.ts` |
| Hobby recommendations (interests, goals, ratings, progression) | `src/lib/domain/hobbies.ts` |

## Data honesty
- Sample events are fictional, badged "Sample" everywhere, and carry no official/booking links,
  so no booking action is ever shown for them.
- Journey times in `destinations.ts` are typical scheduled durations, labelled "reference, not live".
  No fares or hotel prices are stored or invented — trip totals stay unknown until researched.
- London travel times (`areas.ts`) are coarse zone estimates, labelled approximate.
- Unknown price → "Price not verified", never "Free".

## Screens
This Week (`/`), Discover (`/discover`, with Europe tab), My Life (`/my-life`), Wrapped
(`/wrapped`), Event details (`/events/[id]`), Settings (`/settings`), sign-in/up, and first-run onboarding.

## Roadmap status
| Phase | Status |
|---|---|
| 0 Inspect & prepare | Done |
| 1 Functional core app (demo data, local persistence) | Done |
| 2 Persistence & auth | Done: Postgres (PGlite locally / DATABASE_URL in prod), email+password accounts, per-user scoping |
| 3 Google Calendar read-only free/busy | Not started — needs OAuth credentials |
| 4 Real event sources | Ticketmaster + Eventbrite (organisers) adapters, link import, manual add; stale-tolerant catalogue. Needs API keys to go live |
| 5 Recommendation engine | Deterministic engine done; AI explanations optional/not used |
| 6 Digest automation | Manual generation + run history only; no scheduler, nothing is sent |
| 7 Quality & deployment prep | Unit + browser tests in place; no deployment |
