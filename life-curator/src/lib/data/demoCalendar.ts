// SAMPLE calendar: free/busy intervals only (no titles), generated relative to now.
// Used when Google Calendar is not connected and the user chooses demo calendar mode.
import { addDays, localDate, startOfWeek, weekdayOfDate, zonedToEpoch } from "@/lib/domain/time";
import type { CalendarSnapshot, Interval } from "@/lib/domain/types";

const TZ = "Europe/London";

export function demoCalendar(now: number, weeks = 8): CalendarSnapshot {
  const weekStart = startOfWeek(localDate(now, TZ));
  const busy: Interval[] = [];
  const block = (date: string, from: string, to: string) =>
    busy.push({ start: zonedToEpoch(date, from, TZ), end: zonedToEpoch(date, to, TZ) });

  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(weekStart, i);
    const wd = weekdayOfDate(date);
    if (wd === "tue" || wd === "wed" || wd === "thu") block(date, "09:00", "18:00");
    if (wd === "mon" || wd === "fri") block(date, "09:00", "17:30");
  }
  // A few one-off commitments.
  block(addDays(weekStart, 7 + 2), "19:00", "22:00"); // week 1 Wednesday evening
  block(addDays(weekStart, 7 + 6), "13:00", "15:00"); // week 1 Sunday lunch
  block(addDays(weekStart, 14 + 3), "18:00", "21:00"); // week 2 Thursday evening
  block(addDays(weekStart, 28 + 5), "12:00", "16:00"); // week 4 Saturday afternoon

  return { mode: "demo", busy: busy.sort((a, b) => a.start - b.start), fetchedAt: new Date(now).toISOString() };
}

export const DISCONNECTED_CALENDAR: CalendarSnapshot = { mode: "disconnected", busy: [], fetchedAt: null };
