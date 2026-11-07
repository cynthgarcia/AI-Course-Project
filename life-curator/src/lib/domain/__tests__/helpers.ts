import { DEFAULT_PREFERENCES } from "@/lib/data/defaults";
import type { CalendarSnapshot, CuratorEvent, Preferences } from "../types";

export const prefs = (over: Partial<Preferences> = {}): Preferences => ({ ...DEFAULT_PREFERENCES, ...over });

export const cal = (busy: [string, string][] = [], mode: CalendarSnapshot["mode"] = "demo"): CalendarSnapshot => ({
  mode,
  busy: busy.map(([s, e]) => ({ start: Date.parse(s), end: Date.parse(e) })),
  fetchedAt: null,
});

let n = 0;
export function ev(over: Partial<CuratorEvent> & { start: string }): CuratorEvent {
  n++;
  return {
    id: over.id ?? `e${n}`,
    title: `Event ${n}`,
    description: "",
    category: "music",
    tags: [],
    venue: { name: `Venue ${n}`, address: null, neighborhood: "Soho", city: "London", country: "United Kingdom", area: "soho" },
    end: null,
    timezone: "Europe/London",
    price: { status: "known", min: 20, max: 20, currency: "GBP", includesFees: null },
    officialUrl: null,
    bookingUrl: null,
    organizer: null,
    eligibility: "public",
    dressCode: null,
    accessibility: null,
    verification: { status: "verified", lastVerifiedAt: null, sourceName: "test" },
    isDemo: false,
    socialFit: "either",
    bookingDeadline: null,
    advancePlanning: false,
    destinationId: null,
    occurrenceGroupId: null,
    sourceRecords: [{ sourceId: "test", externalId: over.id ?? `x${n}`, url: null, lastSeenAt: "2026-10-01T00:00:00Z" }],
    ...over,
  };
}
