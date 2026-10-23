// Weekly plan generation. Deterministic: same inputs → same plan. One plan per week;
// regenerating replaces that week's plan and appends to run history.
import { costFromPrice, toBudgetAmount } from "./budget";
import { describeFit } from "./availability";
import { DAY, addDays, localDate, overlaps, startOfWeek, zonedToEpoch } from "./time";
import { rankAll, selectShortlist, weeklyCapacity, type RankContext, type Recommendation } from "./ranking";
import type { CuratorEvent } from "./types";

export interface PlanItem {
  eventId: string;
  suggestedStart: string;
  suggestedEnd: string | null;
  calendarFitReason: string;
  recommendationReason: string;
  score: number;
  estimatedCost: number | null;
  kind: "local" | "travel";
}

export interface WeeklyPlan {
  id: string;
  weekStart: string;
  generatedAt: string;
  status: "generated" | "failed";
  error: string | null;
  calendarMode: string;
  items: PlanItem[];
  note: string | null;
}

export interface PlanRun {
  at: string;
  weekStart: string;
  trigger: "manual" | "scheduled";
  outcome: "generated" | "failed";
  itemCount: number;
  error: string | null;
}

const EVENING = { start: "18:30", end: "22:30" };

/** Counts evenings in the next 7 days with no busy time and no protected friends/personal time. */
export function countFreeEvenings(ctx: RankContext): number | null {
  if (ctx.calendar.mode === "disconnected") return null;
  const today = localDate(ctx.now, ctx.prefs.timezone);
  let free = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const w = { start: zonedToEpoch(d, EVENING.start, ctx.prefs.timezone), end: zonedToEpoch(d, EVENING.end, ctx.prefs.timezone) };
    const busy = ctx.calendar.busy.some((b) => overlaps(b, w));
    const guarded = ctx.protectedIntervals.some((p) => p.category !== "open_to_suggestions" && overlaps(p, w));
    if (!busy && !guarded) free++;
  }
  return free;
}

export function generateWeeklyPlan(events: CuratorEvent[], ctx: RankContext): WeeklyPlan {
  const { prefs, now } = ctx;
  const weekStart = startOfWeek(localDate(now, prefs.timezone));
  const ranked = rankAll(events, { ...ctx, mode: "recommend" });
  const horizonEnd = now + prefs.planningHorizonDays * DAY;
  const freeEvenings = countFreeEvenings(ctx);
  const capacity = freeEvenings === null ? 4 : weeklyCapacity(freeEvenings);

  const local = selectShortlist(
    ranked.filter((r) => r.isLondon && Date.parse(r.event.start) <= horizonEnd),
    prefs,
    capacity,
  );
  // Travel only when strong, feasible and weekend-compatible; at most two.
  const travel = ranked.filter((r) => !r.isLondon && r.exclusions.length === 0 && r.trip?.weekendCompatible).slice(0, 2);

  const toItem = (r: Recommendation, kind: PlanItem["kind"]): PlanItem => ({
    eventId: r.event.id,
    suggestedStart: r.event.start,
    suggestedEnd: r.event.end,
    calendarFitReason: r.fit
      ? describeFit(r.fit, r.event.venue.area, prefs.timezone)
      : r.trip
        ? r.trip.weekendCompatible
          ? "Trip appears to fit a weekend using reference journey times."
          : "Trip would need time off."
        : "",
    recommendationReason: r.whyItFits.join(" "),
    score: r.score,
    estimatedCost: toBudgetAmount(costFromPrice(r.event), prefs),
    kind,
  });

  const note =
    freeEvenings !== null && freeEvenings <= 1
      ? "Your week looks full, so this plan is deliberately light."
      : local.length === 0
        ? "Nothing strong fits your calendar right now. Discover lets you browse more widely."
        : null;

  return {
    id: `plan-${weekStart}`,
    weekStart,
    generatedAt: new Date(now).toISOString(),
    status: "generated",
    error: null,
    calendarMode: ctx.calendar.mode,
    items: [...local.map((r) => toItem(r, "local")), ...travel.map((r) => toItem(r, "travel"))],
    note,
  };
}

/** Replaces any existing plan for the same week (duplicate prevention). */
export function upsertPlan(plans: WeeklyPlan[], plan: WeeklyPlan): WeeklyPlan[] {
  return [plan, ...plans.filter((p) => p.weekStart !== plan.weekStart)].slice(0, 12);
}
