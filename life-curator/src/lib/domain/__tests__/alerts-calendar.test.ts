import { describe, expect, it } from "vitest";
import { followMatch, pickAlerts } from "../alerts";
import { rankAll, type RankContext } from "../ranking";
import { eventToIcs, googleCalendarUrl } from "@/lib/ui/calendarLinks";
import { cal, ev, prefs } from "./helpers";

const NOW = Date.parse("2026-11-07T12:00:00Z");

describe("add to calendar links", () => {
  const e = ev({ title: "Jazz, Late; Live", start: "2026-11-20T20:00:00Z", end: "2026-11-20T22:00:00Z", officialUrl: "https://venue.example/jazz", timezone: "Europe/London" });

  it("pre-fills Google Calendar with exact UTC times", () => {
    const u = new URL(googleCalendarUrl(e));
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261120T200000Z/20261120T220000Z");
    expect(u.searchParams.get("details")).toContain("https://venue.example/jazz");
  });

  it("writes a valid, escaped .ics file and notes an assumed end", () => {
    const ics = eventToIcs({ ...e, end: null, description: "x".repeat(200) }, NOW);
    expect(ics).toContain(String.raw`SUMMARY:Jazz\, Late\; Live`);
    expect(ics).toContain("DTSTART:20261120T200000Z");
    expect(ics).toContain("DTEND:20261120T220000Z");
    expect(ics).toMatch(/about 2 hours assumed/);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe("alerts", () => {
  it("matches followed names as whole phrases, ignoring case and accents", () => {
    const e = ev({ title: "Kurt Elling Quartet", start: "2026-11-20T20:00:00Z", venue: { name: "Ronnie Scott's", address: null, neighborhood: "Soho", city: "London", country: "UK", area: "soho" } });
    expect(followMatch(e, ["kurt elling"])).toBe("kurt elling");
    expect(followMatch(e, ["Ronnie Scott's"])).toBe("Ronnie Scott's");
    expect(followMatch(e, ["Elli"])).toBeNull();
    expect(followMatch(ev({ title: "Bizet: Carmen at the Opéra", start: "2026-11-20T20:00:00Z" }), ["opera"])).toBe("opera");
  });

  const ctx = (over: Partial<RankContext> = {}): RankContext => ({
    now: NOW,
    prefs: prefs({ follows: ["Kurt Elling"] }),
    calendar: cal(),
    protectedIntervals: [],
    saved: new Map(),
    trips: new Map(),
    feedback: [],
    remainingBudget: 1500,
    mode: "recommend",
    ...over,
  });

  it("alerts for follows (even with a clash, said honestly) but never for sample events", () => {
    const real = ev({ id: "k1", title: "Kurt Elling Quartet", start: "2026-11-20T20:00:00Z" });
    const sample = ev({ id: "k2", title: "Kurt Elling (sample)", start: "2026-11-21T20:00:00Z", isDemo: true });
    const busy = cal([["2026-11-20T18:00:00Z", "2026-11-20T23:00:00Z"]]);
    const picks = pickAlerts(rankAll([real, sample], ctx({ calendar: busy })), ctx().prefs, NOW, new Map(), new Set());
    expect(picks.map((p) => p.eventId)).toEqual(["k1"]);
    expect(picks[0]!.reason).toMatch(/clashes with your calendar/);
  });

  it("skips already-alerted, dismissed and too-soon events, and respects the off switch", () => {
    const a = ev({ id: "a", title: "Kurt Elling", start: "2026-11-20T20:00:00Z" });
    const b = ev({ id: "b", title: "Kurt Elling again", start: "2026-11-22T20:00:00Z" });
    const c = ev({ id: "c", title: "Kurt Elling tonight", start: "2026-11-07T19:00:00Z" });
    const recs = rankAll([a, b, c], ctx());
    expect(pickAlerts(recs, ctx().prefs, NOW, new Map([["b", "not_for_me"]]), new Set(["a"]))).toEqual([]);
    expect(pickAlerts(recs, { ...ctx().prefs, alertsEnabled: false }, NOW, new Map(), new Set())).toEqual([]);
  });

  it("adds at most two strong matches that fit the calendar", () => {
    const strong = [1, 2, 3].map((i) => ev({ id: `s${i}`, title: `Late jazz set ${i}`, tags: ["jazz"], category: "music", start: `2026-11-${10 + i}T20:00:00Z` }));
    const picks = pickAlerts(rankAll(strong, ctx()), ctx().prefs, NOW, new Map(), new Set());
    expect(picks.filter((p) => p.kind === "strong")).toHaveLength(2);
    expect(pickAlerts(rankAll(strong, ctx()), { ...ctx().prefs, alertStrongMatches: false }, NOW, new Map(), new Set())).toEqual([]);
  });
});
