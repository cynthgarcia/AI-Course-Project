import { describe, expect, it } from "vitest";
import { INITIAL_STATE, parsePersisted, reducer } from "../state";
import { scoreEvent, type RankContext } from "@/lib/domain/ranking";
import { cal, ev } from "@/lib/domain/__tests__/helpers";

const at = "2026-10-23T10:00:00Z";

describe("state reducer", () => {
  it("rejects jumping to attended without planning, and allows it after", () => {
    let s = reducer(INITIAL_STATE, { type: "setStatus", eventId: "e", category: "music", status: "attended", at });
    expect(s.saved.e).toBeUndefined();
    s = reducer(s, { type: "setStatus", eventId: "e", category: "music", status: "planned", at });
    s = reducer(s, { type: "setStatus", eventId: "e", category: "music", status: "attended", at });
    expect(s.saved.e!.status).toBe("attended");
    expect(s.saved.e!.attendedConfirmedAt).toBe(at);
  });

  it("records actual cost alongside the planned cost without replacing it", () => {
    let s = reducer(INITIAL_STATE, { type: "setStatus", eventId: "e", category: "music", status: "planned", plannedCost: { amount: 30, currency: "GBP", basis: "user_estimate" }, at });
    s = reducer(s, { type: "recordActualCost", eventId: "e", cost: { amount: 34, currency: "GBP", basis: "verified" }, at });
    expect(s.saved.e!.plannedCost!.amount).toBe(30);
    expect(s.saved.e!.actualCost!.amount).toBe(34);
  });

  it("saving a trip never marks it planned or booked", () => {
    const costs = { ticket: { amount: null, currency: "EUR", basis: "unknown" as const }, transport: { amount: null, currency: "GBP", basis: "unknown" as const }, accommodation: { amount: null, currency: "GBP", basis: "unknown" as const }, other: { amount: null, currency: "GBP", basis: "unknown" as const } };
    const s = reducer(INITIAL_STATE, { type: "setTripStatus", eventId: "t", category: "music", status: "interested", initialCosts: costs, at });
    expect(s.trips.t!.status).toBe("interested");
    expect(reducer(INITIAL_STATE, { type: "setTripStatus", eventId: "t", category: "music", status: "planned", initialCosts: costs, at }).trips.t).toBeUndefined();
  });

  it("settings changes affect recommendations", () => {
    const e = ev({ category: "sports", start: "2026-10-28T19:00:00Z" });
    const ctx = (prefs = INITIAL_STATE.prefs): RankContext => ({ now: Date.parse(at), prefs, calendar: cal(), protectedIntervals: [], saved: new Map(), trips: new Map(), feedback: [], remainingBudget: 1500, mode: "recommend" });
    const before = scoreEvent(e, ctx(), new Map()).score;
    const s = reducer(INITIAL_STATE, { type: "setPrefs", prefs: { interests: { ...INITIAL_STATE.prefs.interests, sports: 0 } } });
    expect(scoreEvent(e, ctx(s.prefs), new Map()).score).toBeLessThan(before);
  });

  it("ignores corrupt or foreign persisted data", () => {
    expect(parsePersisted("not json")).toBeNull();
    expect(parsePersisted(JSON.stringify({ version: 99 }))).toBeNull();
    expect(parsePersisted(JSON.stringify({ version: 1, onboarded: true }))!.prefs.monthlyBudget).toBe(1500);
  });
});

describe("experiences", () => {
  const exp = (id: string, eventId: string | null = null) => ({
    id, eventId, title: "Jazz", category: "music" as const, tags: [], venueName: null, neighborhood: null, city: "London",
    date: "2026-10-20", rating: null, cost: null, withWhom: null, wasNew: null, notes: "", source: "manual" as const, createdAt: at, updatedAt: at,
  });

  it("adds a history entry when attendance is confirmed, once", () => {
    let s = reducer(INITIAL_STATE, { type: "setStatus", eventId: "e", category: "music", status: "planned", at });
    s = reducer(s, { type: "setStatus", eventId: "e", category: "music", status: "attended", experience: exp("x1", "e"), at });
    expect(Object.values(s.experiences)).toHaveLength(1);
    expect(s.experiences.x1!.source).toBe("app");
    s = reducer(s, { type: "setReflection", eventId: "e", category: "music", reflection: { rating: 4, enjoyed: true, wouldRepeat: null, wasNew: true, wouldRecommend: null, notes: "" }, at });
    expect(s.experiences.x1!.rating).toBe(4);
    expect(s.experiences.x1!.wasNew).toBe(true);
    s = reducer(s, { type: "recordActualCost", eventId: "e", cost: { amount: 22, currency: "GBP", basis: "verified" }, at });
    expect(s.experiences.x1!.cost!.amount).toBe(22);
    // Correcting a mistaken confirmation removes the app-created entry.
    s = reducer(s, { type: "setStatus", eventId: "e", category: "music", status: "planned", at });
    expect(Object.values(s.experiences)).toHaveLength(0);
  });

  it("supports manual history with validated ratings", () => {
    let s = reducer(INITIAL_STATE, { type: "addExperience", experience: { ...exp("m1"), rating: 7 } });
    expect(s.experiences.m1!.rating).toBeNull();
    s = reducer(s, { type: "updateExperience", id: "m1", patch: { rating: 5 }, at });
    expect(s.experiences.m1!.rating).toBe(5);
    s = reducer(s, { type: "updateExperience", id: "m1", patch: { rating: 2.5 }, at });
    expect(s.experiences.m1!.rating).toBeNull();
    s = reducer(s, { type: "deleteExperience", id: "m1" });
    expect(s.experiences).toEqual({});
  });
});
