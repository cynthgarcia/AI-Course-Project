// Read-only snapshot of real busy times, bundled into a personal build of the app.
// Holds start/end intervals only — never titles, descriptions, locations or attendees.
import type { CalendarSnapshot } from "@/lib/domain/types";

export interface CalendarSnapshotData {
  fetchedAt: string;
  busy: { start: string; end: string }[];
}

declare global {
  interface Window {
    __LC_CALENDAR_SNAPSHOT__?: unknown;
  }
}

export function parseSnapshot(raw: unknown): CalendarSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const { fetchedAt, busy } = raw as Partial<CalendarSnapshotData>;
  if (typeof fetchedAt !== "string" || Number.isNaN(Date.parse(fetchedAt)) || !Array.isArray(busy)) return null;
  const intervals = busy
    .map((b) => ({ start: Date.parse(b?.start), end: Date.parse(b?.end) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start);
  return { mode: "snapshot", busy: intervals, fetchedAt };
}

export function readEmbeddedSnapshot(): CalendarSnapshot | null {
  if (typeof window === "undefined") return null;
  return parseSnapshot(window.__LC_CALENDAR_SNAPSHOT__);
}
