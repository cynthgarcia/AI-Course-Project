# Progress Tracker — Becca's Glow Up Plan

A self-contained, interactive tracker for Becca's own Twelve-Month Plan: tick
off actions across the six pillars (Health, Wealth, Career, Spirituality,
Hobbies & Fun, Creative), log evidence of key achievements, check off Life
Audit checkpoints, and keep a weekly gratitude journal.

This is a separate copy of the tracker seeded with Becca's own goals — it
does not share data with Cynthia's copy in `../progress-tracker`. Each
person's progress lives only in their own browser.

No build step, no backend, no dependencies to install — it's a static page
that saves your progress in your browser's local storage.

## Running it

Open `index.html` directly in a browser, or serve the folder locally:

```bash
cd progress-tracker-becca
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

You can also host it for free with GitHub Pages (Settings → Pages → serve
from this folder) to access it from your phone.

## Features

- **Dashboard** — overall completion ring, per-pillar progress, next Life
  Audit countdown, and your latest gratitude entry at a glance.
- **The 6 Pillars** — every action from the plan as a checklist, with an
  optional note per action, plus an "Evidence of achievements" log per
  pillar (title, date, description, and an optional link to proof).
- **Life Audits** — the three checkpoint dates (Oct 28 / Nov 25 / Dec 28 in
  the original plan) with editable dates, a countdown, the seeded
  checklist for Audit 01, and the ability to add your own checkpoints to
  any audit.
- **Gratitude Journal** — a weekly entry with a mood picker, what you're
  proud of, what you're grateful for, and — the important one — how you
  genuinely feel, edit/delete any past entry.

## Your data

Everything is stored locally in this browser only (`localStorage`) — nothing
is sent anywhere. Use the **Export** button regularly to download a JSON
backup, and **Import** to restore it (on this or another device/browser).
**Reset** wipes everything after a confirmation, so export first if unsure.
