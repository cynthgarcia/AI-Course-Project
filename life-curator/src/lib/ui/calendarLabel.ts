import type { CalendarSnapshot } from "@/lib/domain/types";

export function calendarLabel(mode: string, snapshot: CalendarSnapshot | null): string {
  if (mode === "demo") return "the calendar is a sample calendar";
  if (mode === "snapshot" && snapshot?.fetchedAt)
    return `the calendar is a read-only copy of your Google Calendar busy times from ${new Date(snapshot.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} (not live)`;
  return "no calendar is connected";
}
