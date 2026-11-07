import { describe, expect, it } from "vitest";
import { buildTaste, tasteMatch } from "../taste";
import { computeWrapped, yearsWithExperiences } from "../wrapped";
import { scoreEvent, type RankContext } from "../ranking";
import type { Category, Experience } from "../types";
import { cal, ev, prefs } from "./helpers";

let n = 0;
function x(over: Partial<Experience> & { date: string }): Experience {
  n++;
  return {
    id: `x${n}`,
    eventId: null,
    title: `Thing ${n}`,
    category: "music",
    tags: [],
    venueName: null,
    neighborhood: "Soho",
    city: "London",
    rating: null,
    cost: null,
    withWhom: null,
    wasNew: null,
    notes: "",
    source: "manual",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const ctx = (experiences: Experience[]): RankContext => ({
  now: Date.parse("2026-10-23T09:00:00Z"),
  prefs: prefs(),
  calendar: cal(),
  protectedIntervals: [],
  saved: new Map(),
  trips: new Map(),
  feedback: [],
  remainingBudget: 1500,
  mode: "recommend",
  experiences,
});

describe("taste profile", () => {
  it("is neutral with no ratings", () => {
    expect(tasteMatch(ev({ start: "2026-10-28T19:00:00Z" }), buildTaste([])).score).toBe(0.5);
  });

  it("raises categories and tags rated highly, with an explanation", () => {
    const exps = [5, 5, 4].map((rating) => x({ date: "2025-03-01", rating, tags: ["jazz"] }));
    const m = tasteMatch(ev({ start: "2026-10-28T19:00:00Z", tags: ["Jazz"] }), buildTaste(exps));
    expect(m.score).toBeGreaterThan(0.6);
    expect(m.reason).toMatch(/3 jazz experiences 4\.7★/);
  });

  it("lowers categories rated poorly, but a single rating has limited pull", () => {
    const one = tasteMatch(ev({ category: "sports", start: "2026-10-28T19:00:00Z" }), buildTaste([x({ date: "2025-01-01", category: "sports", rating: 1 })]));
    const many = tasteMatch(
      ev({ category: "sports", start: "2026-10-28T19:00:00Z" }),
      buildTaste([1, 1, 1, 1, 1, 1].map((rating) => x({ date: "2025-01-01", category: "sports", rating }))),
    );
    expect(one.score).toBeLessThan(0.5);
    expect(many.score).toBeLessThan(one.score);
  });

  it("ignores sample data", () => {
    const t = buildTaste([x({ date: "2025-01-01", rating: 5, source: "sample" })]);
    expect(t.ratedCount).toBe(0);
  });

  it("changes ranking without overriding hard constraints", () => {
    const e = ev({ category: "film", start: "2026-10-28T19:00:00Z" });
    const loved = [5, 5, 5, 5].map((rating) => x({ date: "2025-05-01", category: "film" as Category, rating }));
    const base = scoreEvent(e, ctx([]), new Map());
    const boosted = scoreEvent(e, ctx(loved), new Map());
    expect(boosted.score).toBeGreaterThan(base.score);
    expect(boosted.whyItFits[0]).toMatch(/4 film experiences 5\.0★/);
    const blocked = scoreEvent(e, { ...ctx(loved), calendar: cal([["2026-10-28T18:00:00Z", "2026-10-28T23:00:00Z"]]) }, new Map());
    expect(blocked.exclusions.length).toBeGreaterThan(0);
  });
});

describe("wrapped", () => {
  const exps = [
    x({ date: "2025-02-10", category: "music", rating: 5, withWhom: "friends", cost: { amount: 40, currency: "GBP", basis: "verified" }, wasNew: true }),
    x({ date: "2025-02-20", category: "music", rating: 4, withWhom: "solo", cost: null }),
    x({ date: "2025-06-01", category: "theatre", rating: 3, withWhom: "friends", city: "Paris", cost: { amount: 50, currency: "EUR", basis: "verified" } }),
    x({ date: "2024-12-31", category: "art", rating: 5 }),
  ];

  it("lists years newest first", () => {
    expect(yearsWithExperiences(exps)).toEqual([2025, 2024]);
  });

  it("summarises only the chosen year, without inventing costs", () => {
    const w = computeWrapped(exps, 2025, prefs());
    expect(w.count).toBe(3);
    expect(w.avgRating).toBe(4);
    expect(w.newCount).toBe(1);
    expect(w.categories[0]).toEqual({ category: "music", count: 2, avgRating: 4.5 });
    expect(w.busiestMonth).toEqual({ month: 1, count: 2 });
    expect(w.spent).toBe(40);
    expect(w.unknownCostCount).toBe(2); // one missing, one EUR without a rate
    expect(w.withWhom).toEqual({ solo: 1, friends: 2, new_people: 0, unknown: 0 });
    expect(w.places).toEqual(["Soho", "Paris"]);
    expect(w.topRated[0]!.rating).toBe(5);
    expect(w.persona.title).toBe("The Front-Row Listener");
  });

  it("is gentle for a sparse year", () => {
    expect(computeWrapped(exps, 2024, prefs()).persona.title).toBe("Just getting started");
  });
});
