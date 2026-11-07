import { describe, expect, it } from "vitest";
import { checkProposal, costFromPrice, describePrice, summarizeMonth, toBudgetAmount, tripTotal } from "../budget";
import type { CostItem, SavedEvent, SavedTrip, TripCosts } from "../types";
import { ev, prefs } from "./helpers";

const P = prefs();
const saved = (eventId: string, status: SavedEvent["status"], extra: Partial<SavedEvent> = {}): SavedEvent => ({
  eventId,
  status,
  plannedCost: null,
  actualCost: null,
  dismissalReason: null,
  budgetOverride: false,
  notes: "",
  reflection: null,
  attendedConfirmedAt: null,
  updatedAt: "2026-10-01T00:00:00Z",
  ...extra,
});
const gbp = (amount: number | null, basis: CostItem["basis"] = "user_estimate"): CostItem => ({ amount, currency: "GBP", basis });

const a = ev({ id: "a", start: "2026-11-03T19:00:00Z", price: { status: "known", min: 40, max: 40, currency: "GBP", includesFees: null } });
const b = ev({ id: "b", start: "2026-11-05T19:00:00Z", price: { status: "unknown", min: null, max: null, currency: "GBP", includesFees: null } });
const c = ev({ id: "c", start: "2026-11-07T19:00:00Z", price: { status: "free", min: null, max: null, currency: "GBP", includesFees: null } });
const d = ev({ id: "d", start: "2026-12-07T19:00:00Z" });
const events = new Map([a, b, c, d].map((e) => [e.id, e]));

describe("budget", () => {
  it("never treats an unknown price as free or zero", () => {
    expect(describePrice(b)).toBe("Price not verified");
    expect(costFromPrice(b).amount).toBeNull();
    const s = summarizeMonth("2026-11", events, [saved("b", "planned")], [], P);
    expect(s.unknownCommittedCount).toBe(1);
    expect(s.committed).toBe(0);
  });

  it("keeps free activities eligible and priced at zero", () => {
    expect(describePrice(c)).toBe("Free");
    expect(costFromPrice(c).amount).toBe(0);
  });

  it("keeps estimated (considering), planned and actual spending distinct", () => {
    const s = summarizeMonth("2026-11", events, [saved("a", "saved"), saved("c", "planned")], [], P);
    expect(s.considering).toBe(40);
    expect(s.committed).toBe(0);
    expect(s.actual).toBe(0);
    expect(s.remaining).toBe(1500);
  });

  it("does not double-count as an event moves saved → planned → attended", () => {
    const planned = summarizeMonth("2026-11", events, [saved("a", "planned")], [], P);
    expect(planned.committed).toBe(40);
    expect(planned.remaining).toBe(1460);
    const attended = summarizeMonth("2026-11", events, [saved("a", "attended", { actualCost: gbp(52, "verified") })], [], P);
    expect(attended.actual).toBe(52);
    expect(attended.committed).toBe(0);
    expect(attended.remaining).toBe(1448);
  });

  it("only counts activities in the selected month", () => {
    const s = summarizeMonth("2026-11", events, [saved("a", "planned"), saved("d", "planned")], [], P);
    expect(s.committed).toBe(40);
  });

  it("warns when a proposal exceeds the remaining budget, and handles unknown amounts", () => {
    const s = summarizeMonth("2026-11", events, [saved("a", "planned", { plannedCost: gbp(1450) })], [], P);
    expect(s.remaining).toBe(50);
    expect(checkProposal(s, 80)).toEqual({ kind: "over", overBy: 30, remainingAfter: -30 });
    expect(checkProposal(s, 20).kind).toBe("ok");
    expect(checkProposal(s, null).kind).toBe("unknown");
  });

  it("converts foreign currency only with a user-entered rate", () => {
    const eur: CostItem = { amount: 100, currency: "EUR", basis: "sample" };
    expect(toBudgetAmount(eur, P)).toBeNull();
    expect(toBudgetAmount(eur, prefs({ fxRates: { EUR: 0.85 } }))).toBe(85);
  });

  it("shows trip components separately and never invents a total", () => {
    const costs: TripCosts = { ticket: gbp(60, "verified"), transport: gbp(180), accommodation: gbp(null, "unknown"), other: gbp(0) };
    const t = tripTotal(costs, P);
    expect(t.known).toBe(240);
    expect(t.total).toBeNull();
    expect(t.missing).toEqual(["accommodation"]);
    const full = tripTotal({ ...costs, accommodation: gbp(150) }, P);
    expect(full.total).toBe(390);
    expect(full.countedInBudget).toBe(390);
    const excl = tripTotal({ ...costs, accommodation: gbp(150) }, prefs({ countTravelInBudget: false }));
    expect(excl.countedInBudget).toBe(60);
    expect(excl.total).toBe(390);
  });

  it("counts planned trips against the month transparently", () => {
    const trip: SavedTrip = {
      eventId: "a",
      status: "planned",
      costs: { ticket: gbp(40), transport: gbp(120), accommodation: gbp(null, "unknown"), other: gbp(0) },
      actualCosts: null,
      notes: "",
      budgetOverride: false,
      updatedAt: "",
    };
    const s = summarizeMonth("2026-11", events, [], [trip], P);
    expect(s.committed).toBe(160);
    expect(s.unknownCommittedCount).toBe(1);
    const researching = summarizeMonth("2026-11", events, [], [{ ...trip, status: "researching" }], P);
    expect(researching.committed).toBe(0);
    expect(researching.considering).toBe(160);
  });
});
