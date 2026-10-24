// Applies a validated client action for one user: load → shared reducer → server-only
// checks → persist the diff, all in one transaction.
import { expandBlocks } from "@/lib/domain/availability";
import { summarizeMonth } from "@/lib/domain/budget";
import type { RankContext } from "@/lib/domain/ranking";
import { canConfirmAttendance } from "@/lib/domain/status";
import { addDays, localDate } from "@/lib/domain/time";
import { hobbyTasteEntries } from "@/lib/domain/hobbies";
import { generateWeeklyPlan } from "@/lib/domain/weeklyPlan";
import { demoCalendar, DISCONNECTED_CALENDAR } from "@/lib/data/demoCalendar";
import { reducer, type Action, type AppState } from "@/lib/store/state";
import { getDb } from "./db";
import { catalogue } from "./events";
import { loadState, persistDiff } from "./repo";
import { normalizeCustomEvent, type ClientAction } from "./validate";

export class ActionError extends Error {}

export async function rankContextFor(state: AppState, now: number): Promise<{ ctx: RankContext; events: Awaited<ReturnType<typeof catalogue>>["events"] }> {
  const { events: shared } = await catalogue(now);
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
  const db = await getDb();
  return db.transaction(async (q) => {
    const before = await loadState(q, userId, true);
    let after: AppState;

    if (action.type === "generatePlan") {
      const at = new Date(now).toISOString();
      const { ctx, events } = await rankContextFor(before, now);
      try {
        const plan = generateWeeklyPlan(events, ctx);
        after = reducer(before, { type: "addPlan", plan, run: { at, weekStart: plan.weekStart, trigger: "manual", outcome: "generated", itemCount: plan.items.length, error: null } });
      } catch {
        after = reducer(before, { type: "recordFailedRun", run: { at, weekStart: localDate(now, before.prefs.timezone), trigger: "manual", outcome: "failed", itemCount: 0, error: "Plan generation failed." } });
      }
    } else {
      if ((action.type === "setStatus" || action.type === "setTripStatus") && action.status === "attended") {
        const { events } = await catalogue(now);
        const ev = events.find((e) => e.id === action.eventId) ?? before.customEvents[action.eventId];
        if (!ev || !canConfirmAttendance(Date.parse(ev.start), now)) throw new ActionError("Attendance can only be confirmed after the event has started.");
      }
      if (action.type === "addCustomEvent") {
        if (Object.keys(before.customEvents).length >= 500) throw new ActionError("You've reached the limit of 500 added events.");
        after = reducer(before, { type: "addCustomEvent", event: normalizeCustomEvent(action.event, now) });
      } else {
        after = reducer(before, action as Action);
      }
    }

    await persistDiff(q, userId, before, after);
    return after;
  });
}
