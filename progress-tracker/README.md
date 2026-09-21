# Progress Tracker — Cynthia's Glow Up Plan

A self-contained, interactive tracker for the Twelve-Month Plan: tick off actions
across the six pillars (Health, Wealth, Career, Spirituality, Hobbies & Fun,
Creative), log evidence of key achievements, check off Life Audit checkpoints,
and keep a weekly gratitude journal.

No build step, no backend, no dependencies to install — it's a static page
that saves your progress in your browser's local storage.

## Running it

Open `index.html` directly in a browser, or serve the folder locally:

```bash
cd progress-tracker
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

### Putting it on your phone as an app

This is a full installable web app (PWA) — it has an app icon, manifest,
and offline support, so once it's served over `https://` you can add it
to your home screen and it opens full-screen, no browser bar, like a
normal app.

1. Host it somewhere over HTTPS. The easiest free option is GitHub Pages:
   in this repo, go to **Settings → Pages → Source → Deploy from a
   branch**, pick this branch and the repo root (`/`), save, then your
   app is at `https://<your-username>.github.io/<repo>/progress-tracker/`.
2. Open that URL on your phone.
   - **iPhone (Safari):** tap the Share icon → **Add to Home Screen**.
   - **Android (Chrome):** tap the ⋮ menu → **Add to Home screen** / **Install app**.
3. You'll get an app icon on your home screen that launches full-screen
   and keeps working with your saved progress even if you lose signal.

You can also use it this way immediately from a Claude Artifact link
without setting up GitHub Pages — "Add to Home Screen" works on any live
web page, GitHub Pages just gives it a permanent, shareable URL you (or a
friend) don't need a claude.ai login to open.

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
