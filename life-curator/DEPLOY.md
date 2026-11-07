# Deploying Off Hours (Vercel + Supabase)

About 15 minutes. Your secrets go straight into Vercel; nobody else needs to see them.

## 1. Supabase — the database
1. In Supabase, **New project**. Pick region **London (eu-west-2)** so it sits next to the app.
   Save the database password somewhere safe.
2. Open **Connect** (top of the project page) → **Connection string** → choose **Transaction pooler**
   (port **6543**). Copy the URI and put your password into it:
   `postgresql://postgres.<ref>:<password>@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`
3. That's all — the app creates its own tables on first start.

## 2. Vercel — the app
1. **Add New… → Project → Import** the GitHub repo `cynthgarcia/AI-Course-Project`.
2. **Root Directory:** `life-curator` (Framework: Next.js is detected automatically).
3. **Environment Variables** (Production and Preview):

   | Name | Value | Needed? |
   |---|---|---|
   | `DATABASE_URL` | the Supabase transaction-pooler URI from step 1 | **Yes** |
   | `CRON_SECRET` | any random string of 32+ characters (e.g. from a password manager) | **Yes** — protects the scheduled jobs |
   | `SIGNUP_INVITE_CODE` | a code you share with friends | Recommended while it's private |
   | `TICKETMASTER_API_KEY` | free key from developer.ticketmaster.com | Recommended — concerts, West End, Europe |
   | `ANTHROPIC_API_KEY` + `SCOUT_ENABLED=1` | key from console.anthropic.com | Optional — the AI scout (small cost per run, see below) |
   | `APP_URL` | your live address, e.g. `https://offhours.vercel.app` | For Google Calendar + notifications |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from Google Cloud (section 4) | For "Connect Google Calendar" |
   | `TOKEN_ENCRYPTION_KEY` | another random string of 32+ characters | For "Connect Google Calendar" (encrypts stored access) |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | run `npx web-push generate-vapid-keys` once | For phone notifications |
   | `EVENT_ICS_FEEDS` | `Name|https://…ics` entries, one per line | Optional extras |
   | `EVENT_PAGES` | `Name|https://…` venue "What's on" pages | Optional extras |
   | `EVENTBRITE_TOKEN`, `EVENTBRITE_ORGANIZER_IDS` | private token + organiser IDs | Optional |

4. **Deploy.**

### Which branch?
Vercel deploys **production from `main`**. This work currently lives on
`claude/life-curator-build-ncutq3`. Either merge it into `main` (via a pull request), or in Vercel
**Settings → Git → Production Branch**, set it to `claude/life-curator-build-ncutq3`.
Every other push also gets its own preview URL.

## 3. Check it works
Open `https://<your-app>.vercel.app/api/health`. You should see:
```json
{ "ok": true, "database": "ok", "databaseKind": "postgres", "schema": "0003_shared_state", "scheduledJobs": "configured", ... }
```
- `"database": "not configured"` → `DATABASE_URL` is missing (add it, then **Redeploy**).
- `"database": "unreachable"` → check the password and that you used the **pooler** URI (port 6543).

Then go to `/signup`, create your account (with the invite code if you set one) and finish the welcome steps.

## 4. Google Calendar sign-in (one-time, ~10 minutes)
1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (e.g. "Off Hours").
2. **APIs & Services → Library**: enable **Google Calendar API**.
3. **OAuth consent screen**: User type **External**; app name **Off Hours**; add your email as a
   **test user**; add the scope `https://www.googleapis.com/auth/calendar.freebusy` ("See the availability
   on Google Calendars"). Leave the app in **Testing** while it's just you and friends (up to 100 test users;
   add each person's Google email). Opening it to everyone requires Google's verification review.
4. **Credentials → Create credentials → OAuth client ID**, type **Web application**. Authorised redirect URI:
   `https://<your-app>.vercel.app/api/calendar/google/callback` (must match `APP_URL` exactly).
5. Copy the client ID and secret into Vercel (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), add
   `TOKEN_ENCRYPTION_KEY` and `APP_URL`, then redeploy. "Connect Google Calendar" appears in Settings and the welcome steps.

While the Google app is in Testing, Google may ask people to reconnect about once a week; Off Hours shows a
"Reconnect" banner when that happens.

## 5. Phone notifications
1. On your computer, in the `life-curator` folder: `npx web-push generate-vapid-keys`.
2. Put the two keys in Vercel as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, and redeploy.
3. In the app: **Alerts → Turn on notifications on this device**. On iPhone, first add Off Hours to your
   home screen (Share → Add to Home Screen) and open it from there — iOS only allows notifications that way.

## Scheduled jobs (set up automatically by `vercel.json`)
| Job | When (UTC) | What it does |
|---|---|---|
| `/api/cron/refresh-events` | daily 05:17 | Refreshes every event source. Sources also refresh on demand when older than 3 hours. |
| `/api/cron/daily` | daily 14:07 | Prepares this week's plan for people whose digest day is today, then sends alerts (followed artists/venues and very strong matches) — at most a few per person, in the afternoon. |

Vercel's free (Hobby) plan allows daily jobs, which is why both run once a day.

## Where events come from (automatically)
Nothing needs to be added by hand. Out of the box the app reads:
- **Luma — London**: the public London feed on Luma (AI, founders, talks, wellness, creative).
- **About 25 London venues** picked for your interests (`src/server/curatedSources.ts`): it reads the
  event details each venue publishes for search engines, checks robots.txt first, reads slowly, once a day.
- **Ticketmaster**, once `TICKETMASTER_API_KEY` is set.
- **AI scout**, if enabled: Claude searches the web twice a week (Eventbrite, DICE, Fever, venue sites…)
  for events matching your interests. The app then opens each event page itself and keeps an event only
  if that page confirms it — nothing the AI says is shown as fact. Roughly $0.20–0.50 per run, about
  $2–4 a month. Change what it looks for with `SCOUT_BRIEF`.

Sources that publish nothing readable just contribute nothing; Settings → Event sources shows status.
Sample events appear only until real events have loaded. Set `CURATED_SOURCES=0` to turn the built-in
list off.

## Good to know
- **Cost:** Vercel Hobby and Supabase Free cover this comfortably. Vercel Hobby is for
  non-commercial use; Supabase's free tier pauses a project after a week with no activity.
- **Privacy:** the production URL is public, but every page needs an account, and with
  `SIGNUP_INVITE_CODE` set only people with the code can sign up.
- **Region:** functions run in London (`lhr1`, set in `vercel.json`).
- **Changing secrets** needs a redeploy (Deployments → … → Redeploy).
- **Never** put `DATABASE_URL` or API keys in the code or in a `NEXT_PUBLIC_` variable.
