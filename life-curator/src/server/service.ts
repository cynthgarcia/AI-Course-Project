// Applies a validated client action for one user: load → shared reducer → server-only
// checks → persist the diff, all in one transaction.
import { expandBlocks } from "@/lib/domain/availability";
import { summarizeMonth } from "@/lib/domain/budget";
import type { RankContext } from "@/lib/domain/ranking";
import { canConfirmAttendance } from "@/lib/domain/status";
import { addDays, localDate, startOfWeek, weekdayOfDate } from "@/lib/domain/time";
import type { CuratorEvent, Preferences } from "@/lib/domain/types";
import { hobbyTasteEntries } from "@/lib/domain/hobbies";
import { generateWeeklyPlan } from "@/lib/domain/weeklyPlan";
import { demoCalendar, DISCONNECTED_CALENDAR } from "@/lib/data/demoCalendar";
import { reducer, type Action, type AppState } from "@/lib/store/state";
import { getDb } from "./db";
import { catalogue } from "./events";
import { loadState, persistDiff } from "./repo";
import { normalizeCustomEvent, type ClientAction } from "./validate";

export class ActionError extends Error {}

/** Shared catalogue events must be loaded before any transaction starts (one-connection databases). */
export function rankContextFor(state: AppState, now: number, shared: CuratorEvent[]): { ctx: RankContext; events: CuratorEvent[] } {
  const events = [...shared, ...Object.values(state.customEvents)].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const { prefs } = state;
  const today = localDate(now, prefs.timezone);
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const budget = summarizeMonth(today.slice(0, 7), eventMap, Object.values(state.saved), Object.values(state.trips), prefs);
  return {
    events,
    ctx: {
      now,
      prefs,
      calendar: state.calendarMode === "demo" ? demoCalendar(now) : DISCONNECTED_CALENDAR,
      protectedIntervals: expandBlocks(prefs.protectedBlocks, addDays(today, -1), 130, prefs.timezone),
      saved: new Map(Object.entries(state.saved)),
      trips: new Map(Object.entries(state.trips)),
      feedback: state.feedback,
      remainingBudget: budget.remaining,
      mode: "recommend",
      experiences: [...Object.values(state.experiences), ...hobbyTasteEntries(Object.values(state.hobbies))],
    },
  };
}

export async function applyAction(userId: string, action: ClientAction, now = Date.now()): Promise<AppState> {
  return applyActions(userId, [action], now);
}

/** Applies several actions in order, atomically: all succeed or none are saved. */
export async function applyActions(userId: string, actions: ClientAction[], now = Date.now()): Promise<AppState> {
  const db = await getDb();
  const needsEvents = actions.some(
    (action) => action.type === "generatePlan" || ((action.type === "setStatus" || action.type === "setTripStatus") && action.status === "attended"),
  );
  const shared = needsEvents ? (await catalogue(now)).events : [];
  return db.transaction(async (q) => {
    const initial = await loadState(q, userId, true);
    let before = initial;
    for (const action of actions) before = step(before, action, now, shared);
    await persistDiff(q, userId, initial, before);
    return before;
  });
}

function step(before: AppState, action: ClientAction, now: number, shared: CuratorEvent[]): AppState {
  let after: AppState;

  if (action.type === "generatePlan") {
    const at = new Date(now).toISOString();
    const { ctx, events } = rankContextFor(before, now, shared);
    try {
      const plan = generateWeeklyPlan(events, ctx);
      after = reducer(before, { type: "addPlan", plan, run: { at, weekStart: plan.weekStart, trigger: "manual", outcome: "generated", itemCount: plan.items.length, error: null } });
    } catch {
      after = reducer(before, { type: "recordFailedRun", run: { at, weekStart: localDate(now, before.prefs.timezone), trigger: "manual", outcome: "failed", itemCount: 0, error: "Plan generation failed." } });
    }
  } else {
    if ((action.type === "setStatus" || action.type === "setTripStatus") && action.status === "attended") {
      const ev = shared.find((e) => e.id === action.eventId) ?? before.customEvents[action.eventId];
      if (!ev || !canConfirmAttendance(Date.parse(ev.start), now)) throw new ActionError("Attendance can only be confirmed after the event has started.");
    }
    if (action.type === "addCustomEvent") {
      if (Object.keys(before.customEvents).length >= 500) throw new ActionError("You've reached the limit of 500 added events.");
      after = reducer(before, { type: "addCustomEvent", event: normalizeCustomEvent(action.event, now) });
    } else {
      after = reducer(before, action as Action);
    }
  }
  return after;
}

/**
 * Daily job: for each user whose digest day is today (in their timezone), prepares this
 * week's plan once. Idempotent per week. Nothing is sent — plans appear in the app.
 */
export async function runScheduledPlans(now = Date.now(), budgetMs = 45_000): Promise<{ generated: number; skipped: number; failed: number; remaining: boolean }> {
  const db = await getDb();
  const started = Date.now();
  const shared = (await catalogue(now)).events;
  const users = await db.query<{ user_id: string; prefs: Partial<Preferences> }>("select user_id, prefs from profiles where onboarded = true order by user_id");
  const result = { generated: 0, skipped: 0, failed: 0, remaining: false };
  for (const u of users) {
    if (Date.now() - started > budgetMs) {
      result.remaining = true;
      break;
    }
    const tz = u.prefs.timezone ?? "Europe/London";
    const today = localDate(now, tz);
    if (u.prefs.digestEnabled === false || weekdayOfDate(today) !== (u.prefs.digestDay ?? "thu")) {
      result.skipped++;
      continue;
    }
    await db
      .transaction(async (q) => {
        const before = await loadState(q, u.user_id, true);
        const weekStart = startOfWeek(today);
        if (before.runs.some((r) => r.trigger === "scheduled" && r.weekStart === weekStart && r.outcome === "generated")) {
          result.skipped++;
          return;
        }
        const at = new Date(now).toISOString();
        let after: AppState;
        try {
          const { ctx, events } = rankContextFor(before, now, shared);
          const plan = generateWeeklyPlan(events, ctx);
          after = reducer(before, { type: "addPlan", plan, run: { at, weekStart, trigger: "scheduled", outcome: "generated", itemCount: plan.items.length, error: null } });
          result.generated++;
        } catch {
          after = reducer(before, { type: "recordFailedRun", run: { at, weekStart, trigger: "scheduled", outcome: "failed", itemCount: 0, error: "Plan generation failed." } });
          result.failed++;
        }
        await persistDiff(q, u.user_id, before, after);
      })
      .catch(() => {
        result.failed++;
      });
  }
  return result;
}
