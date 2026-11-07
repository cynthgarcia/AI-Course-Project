import { describe, expect, it } from "vitest";
import { rankAll, scoreEvent, selectShortlist, SHORTLIST_LIMIT, type RankContext } from "../ranking";
import { generateWeeklyPlan } from "../weeklyPlan";
import { getDestination } from "../destinations";
import type { Category, SavedEvent } from "../types";
import { cal, ev, prefs } from "./helpers";

const NOW = Date.parse("2026-10-23T09:00:00Z");
const ctx = (over: Partial<RankContext> = {}): RankContext => ({
  now: NOW,
  prefs: prefs(),
  calendar: cal(),
  protectedIntervals: [],
  saved: new Map(),
  trips: new Map(),
  feedback: [],
  remainingBudget: 1500,
  mode: "recommend",
  ...over,
});

// Saturday 31 Oct 2026, 10:00–17:00 London, one per hour, varied categories.
const cats: Category[] = ["music", "music", "music", "music", "music", "music", "theatre", "tech", "creative", "literature"];
const many = cats.map((category, i) =>
  ev({ id: `m${i}`, category, start: new Date(Date.parse("2026-10-27T19:00:00Z") + i * 86_400_000 * 0.5).toISOString(), end: null }),
);

describe("ranking and shortlist", () => {
  it("never returns more than six recommendations", () => {
    const ranked = rankAll(many, ctx());
    expect(selectShortlist(ranked, prefs()).length).toBeLessThanOrEqual(SHORTLIST_LIMIT);
  });

  it("is diverse when good options exist", () => {
    const shortlist = selectShortlist(rankAll(many, ctx()), prefs());
    const distinct = new Set(shortlist.map((r) => r.event.category));
    expect(distinct.size).toBeGreaterThanOrEqual(4);
  });

  it("excludes hard-constraint violations regardless of score", () => {
    const e = ev({ id: "x", start: "2026-10-27T19:00:00Z", end: "2026-10-27T21:00:00Z", tags: ["jazz", "classical", "orchestra"] });
    const busy = ctx({ calendar: cal([["2026-10-27T18:00:00Z", "2026-10-27T22:00:00Z"]]) });
    const rec = scoreEvent(e, busy, new Map([[e.id, e]]));
    expect(rec.exclusions.length).toBeGreaterThan(0);
    expect(selectShortlist([rec], prefs())).toEqual([]);
  });

  it("excludes restricted-eligibility events from recommendations", () => {
    const e = ev({ id: "inv", start: "2026-10-28T19:00:00Z", eligibility: "invite_only" });
    expect(scoreEvent(e, ctx(), new Map()).exclusions.join(" ")).toMatch(/eligibility/);
  });

  it("lets feedback influence ranking without banning a whole category", () => {
    const e1 = ev({ id: "f1", category: "sports", start: "2026-10-28T19:00:00Z" });
    const before = scoreEvent(e1, ctx(), new Map()).score;
    const feedback = [{ eventId: "other", category: "sports" as const, kind: "dismiss" as const, reason: "not_my_kind" as const, at: "2026-10-20T00:00:00Z" }];
    const after = scoreEvent(e1, ctx({ feedback }), new Map());
    expect(after.score).toBeLessThan(before);
    expect(after.exclusions).toEqual([]);
  });

  it("respects explicit 'not for me' on an event", () => {
    const e = ev({ id: "nfm", start: "2026-10-28T19:00:00Z" });
    const saved = new Map<string, SavedEvent>([["nfm", { eventId: "nfm", status: "not_for_me", plannedCost: null, actualCost: null, dismissalReason: "other", budgetOverride: false, notes: "", reflection: null, attendedConfirmedAt: null, updatedAt: "" }]]);
    expect(scoreEvent(e, ctx({ saved }), new Map()).exclusions.length).toBeGreaterThan(0);
  });

  it("only labels novelty when justified by history and interests", () => {
    const usual = scoreEvent(ev({ category: "music", start: "2026-10-28T19:00:00Z" }), ctx(), new Map());
    expect(usual.isNew).toBe(false);
    const fresh = scoreEvent(ev({ category: "food", start: "2026-10-28T19:00:00Z" }), ctx(), new Map());
    expect(fresh.isNew).toBe(true);
    expect(fresh.newReason).toBeTruthy();
  });

  it("suggests European travel only for strong interest matches and feasible trips", () => {
    const d = getDestination("paris")!;
    const venue = { name: "V", address: null, neighborhood: null, city: "Paris", country: "France", area: null };
    const paris = ev({ start: "2026-11-07T19:00:00Z", end: "2026-11-07T22:00:00Z", destinationId: "paris", timezone: d.timezone, venue, category: "music" });
    expect(scoreEvent(paris, ctx(), new Map()).exclusions).toEqual([]);
    const weak = { ...paris, category: "food" as const };
    expect(scoreEvent(weak, ctx(), new Map()).exclusions.join(" ")).toMatch(/interest match/);
    const off = scoreEvent(paris, ctx({ prefs: prefs({ travelEnabled: false }) }), new Map());
    expect(off.exclusions.length).toBeGreaterThan(0);
  });

  it("keeps source links on recommendations", () => {
    const e = ev({ start: "2026-10-28T19:00:00Z", officialUrl: "https://example.org/event" });
    expect(scoreEvent(e, ctx(), new Map()).event.officialUrl).toBe("https://example.org/event");
  });
});

describe("weekly plan", () => {
  it("an empty set of events produces an empty plan rather than filler", () => {
    const plan = generateWeeklyPlan([], ctx());
    expect(plan.items).toEqual([]);
    expect(plan.note).toMatch(/Nothing strong/);
  });

  it("is deterministic and keyed by week", () => {
    const a = generateWeeklyPlan(many, ctx());
    const b = generateWeeklyPlan(many, ctx());
    expect(a).toEqual(b);
    expect(a.weekStart).toBe("2026-10-19");
    expect(a.items.length).toBeLessThanOrEqual(SHORTLIST_LIMIT);
  });

  it("suggests fewer activities when the week is busy", () => {
    const busyWeek = cal([["2026-10-23T09:00:00Z", "2026-10-30T23:00:00Z"]]);
    const plan = generateWeeklyPlan(many, ctx({ calendar: busyWeek }));
    expect(plan.items.filter((i) => i.kind === "local").length).toBeLessThanOrEqual(2);
  });
});
