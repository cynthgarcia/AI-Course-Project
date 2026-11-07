// Daily alert run: finds new events each user follows or would love, records them in the
// in-app alert list, and sends at most one push per user per run.
import { pickAlerts } from "@/lib/domain/alerts";
import { rankAll } from "@/lib/domain/ranking";
import { formatShortDay, formatTime } from "@/lib/domain/time";
import type { CuratorEvent } from "@/lib/domain/types";
import { getDb, type Queryable } from "./db";
import { catalogue } from "./events";
import { liveCalendar } from "./googleCalendar";
import { pushToUser, type Sender } from "./push";
import { loadState } from "./repo";
import { rankContextFor } from "./service";

const DAILY_CAP = 6;

export interface AlertRunResult {
  users: number;
  alerts: number;
  pushes: number;
}

export async function alertsForUser(q: Queryable, userId: string, shared: CuratorEvent[], now: number, send?: Sender): Promise<{ created: number; pushed: number }> {
  const state = await loadState(q, userId);
  if (!state.onboarded || !state.prefs.alertsEnabled) return { created: 0, pushed: 0 };
  const today = await q.query<{ n: number }>("select count(*)::int as n from notifications where user_id = $1 and created_at > now() - interval '1 day'", [userId]);
  const room = DAILY_CAP - (today[0]?.n ?? 0);
  if (room <= 0) return { created: 0, pushed: 0 };

  const live = state.calendarMode === "google" ? await liveCalendar(q, userId, now).catch(() => null) : null;
  const { ctx, events } = rankContextFor(state, now, shared, live);
  const recs = rankAll(events, ctx);
  const already = new Set((await q.query<{ event_id: string }>("select event_id from notifications where user_id = $1", [userId])).map((r) => r.event_id));
  const statuses = new Map(Object.values(state.saved).map((s) => [s.eventId, s.status]));
  const picks = pickAlerts(recs, state.prefs, now, statuses, already).slice(0, room);

  const created: typeof picks = [];
  for (const a of picks) {
    const rows = await q.query(
      "insert into notifications (user_id, event_id, title, reason, starts_at) values ($1, $2, $3, $4, $5) on conflict (user_id, event_id) do nothing returning event_id",
      [userId, a.eventId, a.title, a.reason, a.startsAt],
    );
    if (rows.length) created.push(a);
  }
  if (!created.length) return { created: 0, pushed: 0 };

  const tz = state.prefs.timezone;
  const first = created[0]!;
  const when = `${formatShortDay(Date.parse(first.startsAt), tz)} ${formatTime(Date.parse(first.startsAt), tz)}`;
  const msg =
    created.length === 1
      ? { title: first.title, body: `${when} · ${first.reason}`, url: `/events/${encodeURIComponent(first.eventId)}`, tag: first.eventId }
      : { title: `${created.length} events you'll want to see`, body: created.map((c) => c.title).slice(0, 3).join(" · "), url: "/alerts", tag: "alerts" };
  const pushed = await pushToUser(q, userId, msg, send);
  if (pushed) {
    await q.query("update notifications set pushed_at = now() where user_id = $1 and event_id = any(string_to_array($2, chr(31)))", [userId, created.map((c) => c.eventId).join("\u001f")]);
  }
  return { created: created.length, pushed: pushed ? 1 : 0 };
}

export async function runAlerts(now = Date.now(), budgetMs = 40_000, send?: Sender): Promise<AlertRunResult> {
  const db = await getDb();
  const started = Date.now();
  const shared = (await catalogue(now)).events;
  const users = await db.query<{ user_id: string }>("select user_id from profiles where onboarded = true order by user_id");
  const result: AlertRunResult = { users: 0, alerts: 0, pushes: 0 };
  for (const u of users) {
    if (Date.now() - started > budgetMs) break;
    try {
      const r = await alertsForUser(db, u.user_id, shared, now, send);
      result.users++;
      result.alerts += r.created;
      result.pushes += r.pushed;
    } catch {
      // One user's failure doesn't stop the others.
    }
  }
  return result;
}
