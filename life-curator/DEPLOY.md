# Deploying Your Life Curator (Vercel + Supabase)

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
   | `TICKETMASTER_API_KEY` | free key from developer.ticketmaster.com | For real events |
   | `EVENT_ICS_FEEDS` | `Name|https://…ics` entries, one per line | Optional — Luma, Meetup, venue calendars |
   | `EVENT_PAGES` | `Name|https://…` venue "What's on" pages | Optional |
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

## Scheduled jobs (set up automatically by `vercel.json`)
| Job | When (UTC) | What it does |
|---|---|---|
| `/api/cron/refresh-events` | daily 05:17 | Refreshes every event source. Sources also refresh on demand when older than 3 hours. |
| `/api/cron/weekly-plans` | daily 14:07 | For people whose digest day is today, prepares this week's plan once. Nothing is sent. |

Vercel's free (Hobby) plan allows daily jobs, which is why both run once a day.

## Good to know
- **Cost:** Vercel Hobby and Supabase Free cover this comfortably. Vercel Hobby is for
  non-commercial use; Supabase's free tier pauses a project after a week with no activity.
- **Privacy:** the production URL is public, but every page needs an account, and with
  `SIGNUP_INVITE_CODE` set only people with the code can sign up.
- **Region:** functions run in London (`lhr1`, set in `vercel.json`).
- **Changing secrets** needs a redeploy (Deployments → … → Redeploy).
- **Never** put `DATABASE_URL` or API keys in the code or in a `NEXT_PUBLIC_` variable.
