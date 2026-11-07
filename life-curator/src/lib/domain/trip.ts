// Deterministic trip-feasibility evaluation for events outside London.
// Evaluates the whole trip (door to door), not just the event time.
import { TRANSFER_ALLOWANCES, type Destination, type RouteRef } from "./destinations";
import { HOUR, MINUTE, addDays, localDate, overlaps, weekdayOfDate, zonedToEpoch } from "./time";
import type { CalendarSnapshot, CategorizedInterval, CostItem, CuratorEvent, Interval, Preferences, ProtectedCategory, TripCosts, Weekday } from "./types";
import { costFromPrice } from "./budget";

export const ASSUMED_TRIP_EVENT_MINUTES = 180;
const ARRIVAL_BUFFER_MINUTES = 60;
const EARLIEST_DEPARTURE = "07:00";
const LATEST_SAME_DAY_HOME = "23:30";
const NEXT_DAY_RETURN_DEPARTURE = "11:00";
const FRIDAY_EVENING_DEPARTURE = "18:30";
const WORKING_HOURS = { start: "09:00", end: "17:30" };

export interface TripAssessment {
  route: RouteRef;
  doorToDoorMinutes: number;
  latestLeaveHome: number;
  dayTrip: boolean;
  overnightLikely: boolean;
  window: Interval;
  /** Weekdays whose working hours the trip overlaps — leave would be needed. Never assumed available. */
  leaveDays: { date: string; weekday: Weekday }[];
  weekendCompatible: boolean;
  conflict: boolean;
  protectedOverlap: ProtectedCategory | null;
  hardBlocked: boolean;
  feasible: boolean;
  concerns: string[];
  assumedEnd: boolean;
  calendarVerified: boolean;
}

export interface TripInput {
  event: CuratorEvent;
  destination: Destination;
  prefs: Preferences;
  calendar: CalendarSnapshot;
  protectedIntervals: CategorizedInterval[];
  now: number;
  mode: "recommend" | "browse";
}

function chooseRoute(dest: Destination): RouteRef {
  // Prefer rail when one exists and is not dramatically slower door to door.
  const doorToDoor = (r: RouteRef) => r.typicalMinutes + TRANSFER_ALLOWANCES[r.mode].beforeDeparture + TRANSFER_ALLOWANCES[r.mode].afterArrival;
  const sorted = [...dest.routes].sort((a, b) => doorToDoor(a) - doorToDoor(b));
  const rail = dest.routes.find((r) => r.mode === "rail");
  const fastest = sorted[0]!;
  return rail && doorToDoor(rail) - doorToDoor(fastest) <= 60 ? rail : fastest;
}

export function assessTrip(input: TripInput): TripAssessment {
  const { event, destination, prefs, calendar, protectedIntervals, now, mode } = input;
  const tz = prefs.timezone;
  const concerns: string[] = [];
  const route = chooseRoute(destination);
  const allowance = TRANSFER_ALLOWANCES[route.mode];
  const D = route.typicalMinutes + allowance.beforeDeparture + allowance.afterArrival;

  const S = Date.parse(event.start);
  const assumedEnd = event.end === null;
  const E = event.end ? Date.parse(event.end) : S + ASSUMED_TRIP_EVENT_MINUTES * MINUTE;
  if (assumedEnd) concerns.push("No published end time — planning assumes about 3 hours.");

  const latestLeaveHome = S - (ARRIVAL_BUFFER_MINUTES + D) * MINUTE;
  const eventDateHome = localDate(S, tz);
  const earliestOut = zonedToEpoch(eventDateHome, EARLIEST_DEPARTURE, tz);
  const canGoSameDay = latestLeaveHome >= earliestOut;

  const sameDayHome = E + 20 * MINUTE + D * MINUTE;
  const canReturnSameDay = sameDayHome <= zonedToEpoch(eventDateHome, LATEST_SAME_DAY_HOME, tz);
  const dayTrip = canGoSameDay && canReturnSameDay;
  const overnightLikely = !dayTrip;

  let depart: number;
  if (canGoSameDay) {
    depart = overnightLikely ? Math.min(latestLeaveHome, zonedToEpoch(eventDateHome, "10:00", tz)) : latestLeaveHome;
  } else {
    // Travel the evening before.
    depart = zonedToEpoch(addDays(eventDateHome, -1), FRIDAY_EVENING_DEPARTURE, tz);
    if (depart > latestLeaveHome) depart = latestLeaveHome;
  }

  let arriveHome: number;
  if (canReturnSameDay) {
    arriveHome = sameDayHome;
  } else {
    const destDate = localDate(E, destination.timezone);
    const returnDate = addDays(destDate, 1);
    arriveHome = zonedToEpoch(returnDate, NEXT_DAY_RETURN_DEPARTURE, destination.timezone) + D * MINUTE;
    concerns.push("Returning the same night isn't realistic without a checked late timetable — plan on an overnight stay.");
  }
  const window: Interval = { start: depart, end: arriveHome };

  // Leave needed for any weekday whose working hours the trip overlaps.
  const leaveDays: { date: string; weekday: Weekday }[] = [];
  for (let d = localDate(window.start, tz); d <= localDate(window.end, tz); d = addDays(d, 1)) {
    const wd = weekdayOfDate(d);
    if (wd === "sat" || wd === "sun") continue;
    const work = { start: zonedToEpoch(d, WORKING_HOURS.start, tz), end: zonedToEpoch(d, WORKING_HOURS.end, tz) };
    if (overlaps(window, work)) leaveDays.push({ date: d, weekday: wd });
  }
  if (leaveDays.length) {
    concerns.push(`Would need time off on ${leaveDays.map((l) => l.weekday.toUpperCase()).join(", ")} — not assumed to be available.`);
  }

  if (D / 60 > prefs.maxTripHours) {
    concerns.push(`About ${(D / 60).toFixed(1)}h door to door each way — longer than your preferred ${prefs.maxTripHours}h.`);
  }
  if (!route.direct && route.note) concerns.push(route.note);

  const calendarVerified = calendar.mode !== "disconnected";
  const conflict = calendarVerified && calendar.busy.some((b) => overlaps(b, window));
  if (conflict) concerns.push("The trip window clashes with an existing commitment.");
  if (!calendarVerified) concerns.push("Calendar not connected — trip dates are unverified.");

  const protectedHit = protectedIntervals.find(
    (i) => (i.category === "personal_time" || i.category === "keep_open_for_friends") && overlaps(i, window),
  );
  const protectedOverlap = protectedHit?.category ?? null;
  if (protectedHit) {
    const label = protectedHit.category === "personal_time" ? "Personal Time" : "time kept open for friends";
    concerns.push(`Overlaps ${label}${mode === "browse" ? " (browsing only — the block stays protected)" : ""}.`);
  }

  const past = window.start <= now + 12 * HOUR;
  if (past) concerns.push("Too close to plan a trip for.");
  const hardBlocked = conflict || past || (mode === "recommend" && protectedOverlap !== null);
  const weekendCompatible = leaveDays.length === 0;

  return {
    route,
    doorToDoorMinutes: D,
    latestLeaveHome,
    dayTrip,
    overnightLikely,
    window,
    leaveDays,
    weekendCompatible,
    conflict,
    protectedOverlap,
    hardBlocked,
    feasible: !hardBlocked,
    concerns,
    assumedEnd,
    calendarVerified,
  };
}

/** Initial trip costs: only the event ticket may be known; transport and accommodation start unknown. */
export function initialTripCosts(event: CuratorEvent, assessment: TripAssessment | null, currency: string): TripCosts {
  const unknown = (c: string): CostItem => ({ amount: null, currency: c, basis: "unknown" });
  return {
    ticket: costFromPrice(event),
    transport: unknown(currency),
    accommodation: assessment && assessment.dayTrip ? { amount: 0, currency, basis: "not_needed" } : unknown(currency),
    other: unknown(currency),
  };
}
