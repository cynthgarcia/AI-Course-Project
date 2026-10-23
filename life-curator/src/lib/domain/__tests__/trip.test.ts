import { describe, expect, it } from "vitest";
import { getDestination } from "../destinations";
import { assessTrip, initialTripCosts } from "../trip";
import { cal, ev, prefs } from "./helpers";

const NOW = Date.parse("2026-10-23T09:00:00Z");
const base = { prefs: prefs(), calendar: cal(), protectedIntervals: [], now: NOW, mode: "recommend" as const };

function eventIn(dest: string, start: string, end: string | null) {
  const d = getDestination(dest)!;
  return { destination: d, event: ev({ start, end, destinationId: dest, timezone: d.timezone, venue: { name: "V", address: null, neighborhood: null, city: d.city, country: d.country, area: null } }) };
}

describe("trip feasibility", () => {
  it("Saturday evening in Paris: overnight, weekend-compatible, by rail", () => {
    // Sat 7 Nov 2026, 20:00–23:00 Paris time.
    const a = assessTrip({ ...base, ...eventIn("paris", "2026-11-07T19:00:00Z", "2026-11-07T22:00:00Z") });
    expect(a.route.mode).toBe("rail");
    expect(a.overnightLikely).toBe(true);
    expect(a.weekendCompatible).toBe(true);
    expect(a.leaveDays).toEqual([]);
    expect(a.feasible).toBe(true);
  });

  it("includes travel time in the trip window", () => {
    const { event, destination } = eventIn("paris", "2026-11-07T19:00:00Z", "2026-11-07T22:00:00Z");
    const a = assessTrip({ ...base, event, destination });
    expect(a.window.start).toBeLessThanOrEqual(Date.parse(event.start) - a.doorToDoorMinutes * 60_000);
    expect(a.window.end).toBeGreaterThan(Date.parse(event.end!) + a.doorToDoorMinutes * 60_000);
  });

  it("flags Friday leave for a Friday-evening event rather than assuming it", () => {
    const a = assessTrip({ ...base, ...eventIn("amsterdam", "2026-11-20T18:30:00Z", "2026-11-20T22:00:00Z") });
    expect(a.leaveDays.map((d) => d.weekday)).toContain("fri");
    expect(a.weekendCompatible).toBe(false);
    expect(a.concerns.join(" ")).toMatch(/not assumed to be available/);
  });

  it("flags Monday leave when a Sunday-evening event pushes the return into Monday", () => {
    const a = assessTrip({ ...base, ...eventIn("vienna", "2026-11-29T18:30:00Z", "2026-11-29T20:30:00Z") });
    expect(a.leaveDays.map((d) => d.weekday)).toContain("mon");
    expect(a.weekendCompatible).toBe(false);
  });

  it("rejects a trip whose window clashes with a commitment", () => {
    const a = assessTrip({ ...base, calendar: cal([["2026-11-08T12:00:00Z", "2026-11-08T14:00:00Z"]]), ...eventIn("paris", "2026-11-07T19:00:00Z", "2026-11-07T22:00:00Z") });
    expect(a.conflict).toBe(true);
    expect(a.feasible).toBe(false);
  });

  it("respects protected time across the whole trip", () => {
    const protectedIntervals = [{ start: Date.parse("2026-11-08T10:00:00Z"), end: Date.parse("2026-11-08T12:00:00Z"), category: "personal_time" as const, label: null }];
    const a = assessTrip({ ...base, protectedIntervals, ...eventIn("paris", "2026-11-07T19:00:00Z", "2026-11-07T22:00:00Z") });
    expect(a.protectedOverlap).toBe("personal_time");
    expect(a.hardBlocked).toBe(true);
    const browse = assessTrip({ ...base, mode: "browse", protectedIntervals, ...eventIn("paris", "2026-11-07T19:00:00Z", "2026-11-07T22:00:00Z") });
    expect(browse.hardBlocked).toBe(false);
  });

  it("starts transport and accommodation as unknown — no invented prices", () => {
    const { event, destination } = eventIn("paris", "2026-11-07T19:00:00Z", "2026-11-07T22:00:00Z");
    const a = assessTrip({ ...base, event, destination });
    const costs = initialTripCosts(event, a, "GBP");
    expect(costs.transport.amount).toBeNull();
    expect(costs.accommodation.amount).toBeNull();
  });

  it("allows a Brussels day trip for an afternoon event", () => {
    const a = assessTrip({ ...base, ...eventIn("brussels", "2026-11-07T13:00:00Z", "2026-11-07T15:00:00Z") });
    expect(a.dayTrip).toBe(true);
    expect(a.overnightLikely).toBe(false);
  });
});
