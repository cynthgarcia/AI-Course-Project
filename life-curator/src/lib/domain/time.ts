// Timezone-safe date utilities built on Intl (no hand-rolled DST tables).
import type { Weekday } from "./types";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  weekday: Weekday;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

const WEEKDAY_FROM_SHORT: Record<string, Weekday> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

export function zonedParts(epochMs: number, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(new Date(epochMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: WEEKDAY_FROM_SHORT[get("weekday")] ?? "mon",
  };
}

/** Offset of `tz` from UTC at the given instant, in minutes (London summer = +60). */
export function tzOffsetMinutes(epochMs: number, tz: string): number {
  const p = zonedParts(epochMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const truncated = Math.floor(epochMs / MINUTE) * MINUTE;
  return Math.round((asUtc - truncated) / MINUTE);
}

/** "YYYY-MM-DD" date string of an instant in a timezone. */
export function localDate(epochMs: number, tz: string): string {
  const p = zonedParts(epochMs, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parses "HH:mm" (allowing "24:00") into minutes after midnight. */
export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Converts a wall-clock time in `tz` to an epoch instant. Handles DST:
 * ambiguous times resolve to the earlier offset; non-existent times
 * (spring-forward gap) shift forward by the gap.
 */
export function zonedToEpoch(date: string, time: string, tz: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const minutes = parseTime(time);
  const guess = Date.UTC(y ?? 1970, (mo ?? 1) - 1, d ?? 1, 0, minutes);
  // Offsets either side of a possible transition give every candidate instant.
  const candidates = [...new Set([tzOffsetMinutes(guess - DAY / 2, tz), tzOffsetMinutes(guess + DAY / 2, tz)])].map(
    (o) => guess - o * MINUTE,
  );
  const wall = minutes % (24 * 60);
  const valid = candidates.filter((t) => {
    const p = zonedParts(t, tz);
    return p.hour * 60 + p.minute === wall;
  });
  return valid.length ? Math.min(...valid) : Math.max(...candidates);
}

/** Adds whole calendar days to a "YYYY-MM-DD" string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function weekdayOfDate(date: string): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  const idx = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay(); // 0 = Sun
  return (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[idx]!;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const order: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  return addDays(date, -order.indexOf(weekdayOfDate(date)));
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

const displayCache = new Map<string, Intl.DateTimeFormat>();
function display(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = tz + JSON.stringify(opts);
  let f = displayCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts });
    displayCache.set(key, f);
  }
  return f;
}

export function formatDay(epochMs: number, tz: string): string {
  return display(tz, { weekday: "long", day: "numeric", month: "long" }).format(epochMs);
}

export function formatShortDay(epochMs: number, tz: string): string {
  return display(tz, { weekday: "short", day: "numeric", month: "short" }).format(epochMs);
}

export function formatTime(epochMs: number, tz: string): string {
  return display(tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(epochMs);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
