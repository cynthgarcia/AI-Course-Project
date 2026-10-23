// Deterministic calendar-fit evaluation. No AI is involved in any of these decisions.
import { estimateTravelMinutes, AREA_LABELS } from "./areas";
import {
  DAY,
  HOUR,
  MINUTE,
  addDays,
  formatTime,
  localDate,
  overlaps,
  parseTime,
  weekdayOfDate,
  zonedParts,
  zonedToEpoch,
} from "./time";
import type {
  AreaId,
  CalendarSnapshot,
  CategorizedInterval,
  Interval,
  Preferences,
  ProtectedCategory,
  TimeBlock,
  Weekday,
} from "./types";

/** Used only when an event publishes no end time; always surfaced as an assumption. */
export const ASSUMED_DURATION_MINUTES = 120;
/** Beyond this many minutes past the latest comfortable home time, a suggestion is rejected. */
export const LATE_FINISH_REJECT_MINUTES = 90;

export type FitStatus = "fits" | "unverified" | "conflict" | "protected" | "too_soon" | "past" | "too_late";

export interface FitResult {
  status: FitStatus;
  /** True when the suggestion must not appear in calendar-compatible recommendations. */
  hardBlocked: boolean;
  reasons: string[];
  warnings: string[];
  origin: "office" | "home" | "unknown";
  travelMinutes: number | null;
  leaveBy: number | null;
  homeArrival: number | null;
  /** Full time commitment including preparation and travel. */
  window: Interval;
  inOpenToSuggestions: boolean;
  protectedOverlap: ProtectedCategory | null;
  assumedEnd: boolean;
}

export interface FitInput {
  start: number;
  end: number | null;
  area: AreaId | null;
  now: number;
  prefs: Preferences;
  calendar: CalendarSnapshot;
  protectedIntervals: CategorizedInterval[];
  /** "browse" is an explicit request to look inside protected windows; it never recategorizes them. */
  mode: "recommend" | "browse";
}

/** Expands weekly recurring blocks into concrete intervals for `days` days from `fromDate`. */
export function expandBlocks(blocks: TimeBlock[], fromDate: string, days: number, tz: string): CategorizedInterval[] {
  const out: CategorizedInterval[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const wd = weekdayOfDate(date);
    for (const b of blocks) {
      if (b.weekday !== wd) continue;
      const start = zonedToEpoch(date, b.startTime, tz);
      const endsNextDay = b.endTime === "24:00" || parseTime(b.endTime) <= parseTime(b.startTime);
      const end = endsNextDay
        ? zonedToEpoch(addDays(date, 1), b.endTime === "24:00" ? "00:00" : b.endTime, tz)
        : zonedToEpoch(date, b.endTime, tz);
      out.push({ start, end, category: b.category, label: b.label });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function originFor(weekday: Weekday, startMinutesLocal: number, prefs: Preferences): "office" | "home" | "unknown" {
  if (weekday === "sat" || weekday === "sun") return "home";
  if (prefs.officeDays.includes(weekday)) return "office";
  // Mon/Fri (or any non-office weekday): location is not assumed.
  return startMinutesLocal >= 21 * 60 ? "home" : "unknown";
}

/** A night followed by a weekday is treated as a work night (Mon/Fri leave is never assumed). */
function isWorkNight(date: string): boolean {
  const next = weekdayOfDate(addDays(date, 1));
  return next !== "sat" && next !== "sun";
}

export function evaluateFit(input: FitInput): FitResult {
  const { start, area, now, prefs, calendar, protectedIntervals, mode } = input;
  const tz = prefs.timezone;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const assumedEnd = input.end === null;
  const end = input.end ?? start + ASSUMED_DURATION_MINUTES * MINUTE;
  if (assumedEnd) warnings.push("No published end time — planning assumes about 2 hours.");

  const date = localDate(start, tz);
  const weekday = weekdayOfDate(date);
  const p = zonedParts(start, tz);
  const origin = originFor(weekday, p.hour * 60 + p.minute, prefs);

  let travelMinutes: number | null = null;
  let travelHome: number | null = null;
  if (area) {
    if (origin === "unknown") {
      // Use the longer of home/office so the estimate stays realistic either way.
      travelMinutes = Math.max(estimateTravelMinutes(prefs.homeArea, area), estimateTravelMinutes(prefs.officeArea, area));
      warnings.push("Your location this day isn't assumed — travel time uses the longer of home or office.");
    } else {
      travelMinutes = estimateTravelMinutes(origin === "office" ? prefs.officeArea : prefs.homeArea, area);
    }
    travelHome = estimateTravelMinutes(area, prefs.homeArea);
  } else {
    warnings.push("Venue area unknown — travel time not estimated.");
  }

  const lead = ((travelMinutes ?? 0) + prefs.prepBufferMinutes) * MINUTE;
  const window: Interval = { start: start - lead, end: end + (travelHome ?? 0) * MINUTE };
  const leaveBy = travelMinutes !== null ? start - (travelMinutes + 5) * MINUTE : null;
  const homeArrival = travelHome !== null ? end + travelHome * MINUTE : null;

  const base = {
    origin,
    travelMinutes,
    leaveBy,
    homeArrival,
    window,
    assumedEnd,
    warnings,
    reasons,
  };

  if (start <= now) {
    reasons.push("This has already started.");
    return { ...base, status: "past", hardBlocked: true, inOpenToSuggestions: false, protectedOverlap: null };
  }
  if (start - now < prefs.minimumNoticeHours * HOUR) {
    reasons.push(`Less than ${prefs.minimumNoticeHours} hours' notice.`);
    return { ...base, status: "too_soon", hardBlocked: true, inOpenToSuggestions: false, protectedOverlap: null };
  }

  // Busy / committed time — never assumed movable.
  let status: FitStatus = calendar.mode === "disconnected" ? "unverified" : "fits";
  const conflict = calendar.mode !== "disconnected" && calendar.busy.some((b) => overlaps(b, window));
  if (conflict) {
    reasons.push("Clashes with an existing commitment once travel and buffers are included.");
    status = "conflict";
  }
  if (!conflict && calendar.mode === "disconnected" && prefs.officeDays.includes(weekday)) {
    // Fallback without a calendar: don't suggest starts before work could realistically end.
    const workEnd = zonedToEpoch(date, prefs.workEndTime, tz);
    if (window.start < workEnd && start > workEnd - 10 * HOUR) {
      reasons.push(`Starts before you could realistically leave work (${prefs.workEndTime} + travel).`);
      status = "conflict";
    }
  }

  // Protected time.
  const eventSpan: Interval = { start, end };
  const protectedHit = protectedIntervals.find(
    (i) => (i.category === "personal_time" || i.category === "keep_open_for_friends") && overlaps(i, eventSpan),
  );
  const protectedOverlap = protectedHit ? protectedHit.category : null;
  if (protectedHit && status !== "conflict") {
    const label = protectedHit.category === "personal_time" ? "Personal Time" : "time kept open for friends";
    if (mode === "recommend") {
      reasons.push(`Falls in your ${label}, which stays protected.`);
      status = "protected";
    } else {
      warnings.push(`You're browsing inside your ${label}. The block stays protected unless you change it.`);
    }
  }

  const inOpenToSuggestions = protectedIntervals.some(
    (i) => i.category === "open_to_suggestions" && i.start <= start && i.end >= end,
  );

  // Late finishes and the journey home.
  if (homeArrival !== null && status !== "conflict" && status !== "protected") {
    const latest = isWorkNight(date) ? prefs.latestHomeWeeknight : prefs.latestHomeWeekend;
    let latestEpoch = zonedToEpoch(date, latest, tz);
    if (parseTime(latest) < 12 * 60) latestEpoch += DAY;
    if (homeArrival > latestEpoch + LATE_FINISH_REJECT_MINUTES * MINUTE) {
      reasons.push(`You'd get home around ${formatTime(homeArrival, tz)} — too late to be realistic.`);
      status = "too_late";
    } else if (homeArrival > latestEpoch) {
      warnings.push(`Late finish: home around ${formatTime(homeArrival, tz)}.`);
    }
  }

  const hardBlocked = status === "conflict" || status === "protected" || status === "too_late";
  return { ...base, status, hardBlocked, inOpenToSuggestions, protectedOverlap };
}

/** Human-readable explanation of why the time works (or not). */
export function describeFit(fit: FitResult, area: AreaId | null, tz: string): string {
  if (fit.hardBlocked) return fit.reasons[0] ?? "Doesn't fit your calendar.";
  const parts: string[] = [];
  if (fit.status === "unverified") parts.push("Calendar not connected, so this time is unverified.");
  else parts.push("Free in your calendar, including travel and a buffer.");
  if (fit.inOpenToSuggestions) parts.push("Sits inside time you marked open to suggestions.");
  if (fit.leaveBy && area) {
    const from = fit.origin === "office" ? "the office" : fit.origin === "home" ? "home" : "home or the office";
    parts.push(`Leave ${from} by about ${formatTime(fit.leaveBy, tz)} for ${AREA_LABELS[area]} (approx.).`);
  }
  return parts.join(" ");
}
