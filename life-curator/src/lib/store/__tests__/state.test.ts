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
