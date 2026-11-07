// Budget arithmetic. Each activity contributes exactly one figure to the monthly
// totals (actual if recorded, otherwise planned), so status changes never double-count.
import type { CostItem, CuratorEvent, Preferences, SavedEvent, SavedTrip, TripCosts } from "./types";
import { localDate } from "./time";

export function costFromPrice(event: CuratorEvent): CostItem {
  const { price, isDemo, verification } = event;
  const basis = isDemo ? "sample" : verification.status === "verified" ? "verified" : "unknown";
  if (price.status === "free") return { amount: 0, currency: price.currency, basis: isDemo ? "sample" : basis };
  if (price.status === "unknown" || price.min === null) return { amount: null, currency: price.currency, basis: "unknown" };
  return { amount: price.min, currency: price.currency, basis };
}

/** Converts into the budget currency using only user-entered rates. null = cannot be determined. */
export function toBudgetAmount(cost: CostItem | null, prefs: Preferences): number | null {
  if (!cost || cost.amount === null) return null;
  if (cost.currency === prefs.budgetCurrency) return cost.amount;
  const rate = prefs.fxRates[cost.currency];
  return rate && rate > 0 ? round2(cost.amount * rate) : null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface TripTotal {
  known: number;
  /** Components whose cost is unknown or can't be converted. */
  missing: (keyof TripCosts)[];
  /** Subset of `missing` whose amount is known but has no exchange rate set. */
  unconverted: (keyof TripCosts)[];
  /** Only set when every component is known. */
  total: number | null;
  /** Components counted against the monthly activity budget. */
  countedInBudget: number;
  countedMissing: (keyof TripCosts)[];
}

export const TRIP_COMPONENTS: (keyof TripCosts)[] = ["ticket", "transport", "accommodation", "other"];

export function tripTotal(costs: TripCosts, prefs: Preferences): TripTotal {
  let known = 0;
  let counted = 0;
  const missing: (keyof TripCosts)[] = [];
  const countedMissing: (keyof TripCosts)[] = [];
  const unconverted: (keyof TripCosts)[] = [];
  for (const k of TRIP_COMPONENTS) {
    const counts = k === "ticket" || k === "other" || prefs.countTravelInBudget;
    const v = toBudgetAmount(costs[k], prefs);
    if (v === null) {
      missing.push(k);
      if (costs[k].amount !== null) unconverted.push(k);
      if (counts) countedMissing.push(k);
    } else {
      known += v;
      if (counts) counted += v;
    }
  }
  return {
    known: round2(known),
    missing,
    unconverted,
    total: missing.length === 0 ? round2(known) : null,
    countedInBudget: round2(counted),
    countedMissing,
  };
}

export interface BudgetSummary {
  month: string; // "YYYY-MM"
  ceiling: number;
  currency: string;
  actual: number;
  committed: number;
  remaining: number;
  /** Planned items whose cost is unknown — the remaining figure may be too high. */
  unknownCommittedCount: number;
  /** Known estimates for things only saved/interested — shown, never deducted. */
  considering: number;
  committedIncludesEstimates: boolean;
  lines: BudgetLine[];
}

export interface BudgetLine {
  eventId: string;
  kind: "event" | "trip";
  bucket: "actual" | "committed" | "considering";
  amount: number | null;
  estimated: boolean;
}

const COMMITTED_LOCAL = new Set(["planned", "attended"]);
const CONSIDERING_LOCAL = new Set(["interested", "saved", "invited"]);
const COMMITTED_TRIP = new Set(["planned", "attended"]);
const CONSIDERING_TRIP = new Set(["interested", "researching", "worth_considering"]);

export function monthOf(event: CuratorEvent, tz: string): string {
  return localDate(Date.parse(event.start), tz).slice(0, 7);
}

export function summarizeMonth(
  month: string,
  events: Map<string, CuratorEvent>,
  saved: SavedEvent[],
  trips: SavedTrip[],
  prefs: Preferences,
): BudgetSummary {
  const lines: BudgetLine[] = [];
  let estimated = false;

  for (const s of saved) {
    const ev = events.get(s.eventId);
    if (!ev || monthOf(ev, prefs.timezone) !== month) continue;
    if (s.actualCost && s.actualCost.amount !== null) {
      lines.push({ eventId: s.eventId, kind: "event", bucket: "actual", amount: toBudgetAmount(s.actualCost, prefs), estimated: false });
    } else if (COMMITTED_LOCAL.has(s.status)) {
      const cost = s.plannedCost ?? costFromPrice(ev);
      const amt = toBudgetAmount(cost, prefs);
      if (cost.basis !== "verified") estimated = true;
      lines.push({ eventId: s.eventId, kind: "event", bucket: "committed", amount: amt, estimated: cost.basis !== "verified" });
    } else if (CONSIDERING_LOCAL.has(s.status)) {
      lines.push({ eventId: s.eventId, kind: "event", bucket: "considering", amount: toBudgetAmount(s.plannedCost ?? costFromPrice(ev), prefs), estimated: true });
    }
  }

  for (const t of trips) {
    const ev = events.get(t.eventId);
    if (!ev || monthOf(ev, prefs.timezone) !== month) continue;
    if (t.actualCosts) {
      const tt = tripTotal(t.actualCosts, prefs);
      lines.push({ eventId: t.eventId, kind: "trip", bucket: "actual", amount: tt.countedMissing.length ? null : tt.countedInBudget, estimated: false });
    } else if (COMMITTED_TRIP.has(t.status)) {
      const tt = tripTotal(t.costs, prefs);
      estimated = true;
      // Partial knowledge: count what is known and flag the rest as unknown.
      lines.push({ eventId: t.eventId, kind: "trip", bucket: "committed", amount: tt.countedInBudget, estimated: true });
      if (tt.countedMissing.length) lines.push({ eventId: t.eventId, kind: "trip", bucket: "committed", amount: null, estimated: true });
    } else if (CONSIDERING_TRIP.has(t.status)) {
      lines.push({ eventId: t.eventId, kind: "trip", bucket: "considering", amount: tripTotal(t.costs, prefs).countedInBudget, estimated: true });
    }
  }

  const sum = (bucket: BudgetLine["bucket"]) =>
    round2(lines.filter((l) => l.bucket === bucket).reduce((acc, l) => acc + (l.amount ?? 0), 0));
  const actual = sum("actual");
  const committed = sum("committed");
  return {
    month,
    ceiling: prefs.monthlyBudget,
    currency: prefs.budgetCurrency,
    actual,
    committed,
    remaining: round2(prefs.monthlyBudget - actual - committed),
    unknownCommittedCount: lines.filter((l) => l.bucket !== "considering" && l.amount === null).length,
    considering: sum("considering"),
    committedIncludesEstimates: estimated,
    lines,
  };
}

export type BudgetCheck =
  | { kind: "ok"; remainingAfter: number }
  | { kind: "over"; overBy: number; remainingAfter: number }
  | { kind: "unknown" };

/** Checks a proposed extra spend against what's left. The user may override an "over" result. */
export function checkProposal(summary: BudgetSummary, amount: number | null): BudgetCheck {
  if (amount === null) return { kind: "unknown" };
  const remainingAfter = round2(summary.remaining - amount);
  return remainingAfter < 0 ? { kind: "over", overBy: round2(-remainingAfter), remainingAfter } : { kind: "ok", remainingAfter };
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Never returns "Free" for an unknown price. */
export function describePrice(event: CuratorEvent): string {
  const { price } = event;
  if (price.status === "free") return "Free";
  if (price.status === "unknown" || price.min === null) return "Price not verified";
  const fees = price.includesFees === true ? " incl. fees" : "";
  if (price.status === "range" && price.max !== null && price.max !== price.min)
    return `${formatMoney(price.min, price.currency)}–${formatMoney(price.max, price.currency)}${fees}`;
  return `${formatMoney(price.min, price.currency)}${fees}`;
}
