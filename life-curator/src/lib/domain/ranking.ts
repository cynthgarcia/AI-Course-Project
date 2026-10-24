// Deterministic recommendation ranking. Hard constraints are applied as filters
// before scoring, so nothing (including any future AI layer) can score its way past them.
import { PRIORITY_AREAS } from "./areas";
import { evaluateFit, type FitResult } from "./availability";
import { costFromPrice, toBudgetAmount } from "./budget";
import { getDestination } from "./destinations";
import { DAY, localDate, weekdayOfDate } from "./time";
import { buildTaste, tasteMatch, type TasteProfile } from "./taste";
import { assessTrip, type TripAssessment } from "./trip";
import {
  CATEGORY_LABELS,
  type CalendarSnapshot,
  type CategorizedInterval,
  type Category,
  type CuratorEvent,
  type Experience,
  type FeedbackEntry,
  type Preferences,
  type SavedEvent,
  type SavedTrip,
} from "./types";

export const SHORTLIST_LIMIT = 6;

export interface RankContext {
  now: number;
  prefs: Preferences;
  calendar: CalendarSnapshot;
  protectedIntervals: CategorizedInterval[];
  saved: Map<string, SavedEvent>;
  trips: Map<string, SavedTrip>;
  feedback: FeedbackEntry[];
  /** Remaining monthly budget in budget currency (for budget fit). */
  remainingBudget: number;
  mode: "recommend" | "browse";
  /** What the user actually went to, with ratings (drives the taste profile). */
  experiences?: Experience[];
  /** Precomputed taste profile; built from `experiences` when absent. */
  taste?: TasteProfile;
}

export interface ScoreBreakdown {
  interest: number;
  calendar: number;
  date: number;
  novelty: number;
  reliability: number;
  budget: number;
  social: number;
  feedback: number;
  taste: number;
  urgency: number;
  location: number;
}

export interface Recommendation {
  event: CuratorEvent;
  isLondon: boolean;
  fit: FitResult | null;
  trip: TripAssessment | null;
  score: number;
  breakdown: ScoreBreakdown;
  whyItFits: string[];
  isNew: boolean;
  newReason: string | null;
  /** Reasons the event is excluded from calendar-compatible recommendations (empty = eligible). */
  exclusions: string[];
}

const WEIGHTS: ScoreBreakdown = {
  interest: 30,
  calendar: 15,
  date: 12,
  novelty: 8,
  reliability: 6,
  budget: 10,
  social: 4,
  feedback: 10,
  taste: 12,
  urgency: 5,
  location: 3,
};

export function isLondonEvent(e: CuratorEvent): boolean {
  return e.destinationId === null && e.venue.city.toLowerCase() === "london";
}

function keywordMatches(e: CuratorEvent, keywords: string[]): string[] {
  const hay = `${e.title} ${e.tags.join(" ")} ${e.description}`.toLowerCase();
  return keywords.filter((k) => k.trim() && hay.includes(k.toLowerCase().trim()));
}

export function interestScore(e: CuratorEvent, prefs: Preferences): { score: number; matched: string[] } {
  const matched = keywordMatches(e, prefs.interestKeywords);
  const base = (prefs.interests[e.category] ?? 0) / 3;
  return { score: Math.min(1, base + Math.min(0.3, matched.length * 0.1)), matched };
}

function attendedCategories(
  saved: Map<string, SavedEvent>,
  trips: Map<string, SavedTrip>,
  events: Map<string, CuratorEvent>,
  experiences: Experience[],
): Set<Category> {
  const cats = new Set<Category>(experiences.filter((x) => x.source !== "sample").map((x) => x.category));
  for (const s of saved.values()) if (s.status === "attended") { const ev = events.get(s.eventId); if (ev) cats.add(ev.category); }
  for (const t of trips.values()) if (t.status === "attended") { const ev = events.get(t.eventId); if (ev) cats.add(ev.category); }
  return cats;
}

/** Recent feedback nudges a category; a single dismissal never rules a category out. */
export function feedbackScore(e: CuratorEvent, feedback: FeedbackEntry[], now: number): number {
  let s = 0.5;
  for (const f of feedback) {
    if (f.category !== e.category || now - Date.parse(f.at) > 90 * DAY) continue;
    if (f.kind === "dismiss") s -= f.reason === "not_my_kind" || f.reason === "not_interested" ? 0.12 : 0.04;
    if (f.kind === "save") s += 0.05;
    if (f.kind === "attended_enjoyed") s += 0.15;
    if (f.kind === "attended_disliked") s -= 0.15;
  }
  return Math.max(0.1, Math.min(1, s));
}

function dateScore(daysAhead: number, e: CuratorEvent, prefs: Preferences): number {
  if (daysAhead < 0) return 0;
  if (daysAhead <= prefs.planningHorizonDays) return daysAhead < 1 ? 0.7 : 1;
  if (daysAhead <= prefs.advanceHorizonDays) return e.advancePlanning ? 0.6 : 0.15;
  return e.advancePlanning ? 0.3 : 0;
}

function urgencyScore(e: CuratorEvent, now: number): number {
  if (e.bookingDeadline) {
    const days = (Date.parse(e.bookingDeadline) - now) / DAY;
    if (days < 0) return 0;
    if (days <= 7) return 1;
    if (days <= 14) return 0.6;
  }
  return e.advancePlanning ? 0.4 : 0;
}

const RELIABILITY = { verified: 1, unverified: 0.6, stale: 0.4, demo: 0.5 } as const;

export function scoreEvent(e: CuratorEvent, ctx: RankContext, events: Map<string, CuratorEvent>): Recommendation {
  const { prefs, now } = ctx;
  const start = Date.parse(e.start);
  const london = isLondonEvent(e);
  const exclusions: string[] = [];

  let fit: FitResult | null = null;
  let trip: TripAssessment | null = null;
  if (london) {
    fit = evaluateFit({
      start,
      end: e.end ? Date.parse(e.end) : null,
      area: e.venue.area,
      now,
      prefs,
      calendar: ctx.calendar,
      protectedIntervals: ctx.protectedIntervals,
      mode: ctx.mode,
    });
    if (fit.hardBlocked || fit.status === "past" || fit.status === "too_soon") exclusions.push(...fit.reasons);
  } else {
    const dest = getDestination(e.destinationId);
    if (dest) {
      trip = assessTrip({ event: e, destination: dest, prefs, calendar: ctx.calendar, protectedIntervals: ctx.protectedIntervals, now, mode: ctx.mode });
      if (trip.hardBlocked) exclusions.push(...trip.concerns.slice(-1));
    } else {
      exclusions.push("Destination not recognised, so trip feasibility can't be assessed.");
    }
    if (!prefs.travelEnabled) exclusions.push("European travel suggestions are turned off in Settings.");
  }

  const s = ctx.saved.get(e.id);
  if (s && (s.status === "not_for_me" || s.status === "skipped")) exclusions.push("You marked this as not for you.");
  if (ctx.trips.get(e.id)?.status === "not_for_me") exclusions.push("You marked this trip as not for you.");
  if (e.eligibility === "invite_only" || e.eligibility === "members") exclusions.push("Attendance is restricted — eligibility not established.");

  const daysAhead = (start - now) / DAY;
  const horizon = london ? prefs.advanceHorizonDays : prefs.travelHorizonDays;
  if (daysAhead > horizon) exclusions.push("Beyond your planning horizon.");

  const interest = interestScore(e, prefs);
  if (!london && interest.score < 0.6) exclusions.push("Not a strong enough interest match to travel for.");

  const attendedCats = attendedCategories(ctx.saved, ctx.trips, events, ctx.experiences ?? []);
  const taste = tasteMatch(e, ctx.taste ?? buildTaste(ctx.experiences ?? []));
  const isNew = !attendedCats.has(e.category) && (prefs.interests[e.category] ?? 0) <= 1;
  const newReason = isNew ? `You haven't logged a ${CATEGORY_LABELS[e.category].toLowerCase()} experience yet, and it isn't one of your usual picks.` : null;

  const cost = toBudgetAmount(costFromPrice(e), prefs);
  const budget =
    e.price.status === "free" ? 1 : cost === null ? 0.6 : ctx.remainingBudget <= 0 ? 0.1 : cost > ctx.remainingBudget ? 0.1 : 1 - 0.5 * (cost / ctx.remainingBudget);

  let calendar = 0.5;
  if (fit) calendar = fit.hardBlocked ? 0 : (fit.status === "fits" ? 1 : 0.6) * (fit.warnings.some((w) => w.startsWith("Late finish")) ? 0.7 : 1) + (fit.inOpenToSuggestions ? 0.2 : 0);
  if (trip) calendar = trip.hardBlocked ? 0 : trip.weekendCompatible ? (trip.calendarVerified ? 1 : 0.6) : 0.3;

  const breakdown: ScoreBreakdown = {
    interest: interest.score,
    calendar: Math.min(1, calendar),
    date: dateScore(daysAhead, e, prefs),
    novelty: isNew ? prefs.explorationLevel / 3 : 0,
    reliability: RELIABILITY[e.verification.status],
    budget,
    social: e.socialFit === null ? 0.5 : e.socialFit === "either" || e.socialFit === "meet_people" ? 0.8 : 0.7,
    feedback: feedbackScore(e, ctx.feedback, now),
    taste: taste.score,
    urgency: urgencyScore(e, now),
    location: london && e.venue.area && PRIORITY_AREAS.includes(e.venue.area) ? 1 : 0,
  };
  const score = (Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]).reduce((acc, k) => acc + WEIGHTS[k] * breakdown[k], 0);

  return {
    event: e,
    isLondon: london,
    fit,
    trip,
    score: Math.round(score * 10) / 10,
    breakdown,
    whyItFits: [...(taste.reason ? [taste.reason] : []), ...explain(e, prefs, interest.matched, trip)],
    isNew,
    newReason,
    exclusions,
  };
}

function explain(e: CuratorEvent, prefs: Preferences, matched: string[], trip: TripAssessment | null): string[] {
  const out: string[] = [];
  const w = prefs.interests[e.category] ?? 0;
  if (w >= 2) out.push(`${CATEGORY_LABELS[e.category]} is one of your core interests.`);
  else if (w === 1) out.push(`An occasional interest of yours: ${CATEGORY_LABELS[e.category].toLowerCase()}.`);
  if (matched.length) out.push(`Mentions ${matched.slice(0, 3).join(", ")} — on your list.`);
  if (e.tags.includes("one-off")) out.push("A one-off rather than a regular listing.");
  if (!isLondonEvent(e) && e.tags.includes("hard-to-replicate")) out.push("Hard to replicate in London.");
  if (trip?.weekendCompatible) out.push("Looks doable within a weekend, by reference journey times.");
  if (e.socialFit === "meet_people") out.push("Meeting people tends to happen naturally here.");
  if (e.socialFit === "friends") out.push("Best enjoyed with friends.");
  if (e.socialFit === "solo") out.push("Works well solo.");
  if (e.price.status === "free") out.push("Free to attend.");
  return out;
}

export function rankAll(events: CuratorEvent[], ctx: RankContext): Recommendation[] {
  const map = new Map(events.map((e) => [e.id, e]));
  const withTaste = { ...ctx, taste: ctx.taste ?? buildTaste(ctx.experiences ?? []) };
  return events.map((e) => scoreEvent(e, withTaste, map)).sort((a, b) => b.score - a.score);
}

/**
 * Picks a diverse shortlist from eligible recommendations: penalises repeating a
 * category or evening, so good variety wins when it exists.
 */
export function selectShortlist(recs: Recommendation[], prefs: Preferences, limit = SHORTLIST_LIMIT): Recommendation[] {
  const pool = recs.filter((r) => r.exclusions.length === 0);
  const chosen: Recommendation[] = [];
  const catCount = new Map<Category, number>();
  const dateCount = new Map<string, number>();
  while (chosen.length < limit && pool.length) {
    let bestIdx = 0;
    let best = -Infinity;
    pool.forEach((r, i) => {
      const date = localDate(Date.parse(r.event.start), prefs.timezone);
      const adj = r.score - (catCount.get(r.event.category) ?? 0) * 6 * prefs.diversityLevel - (dateCount.get(date) ?? 0) * 12;
      if (adj > best) {
        best = adj;
        bestIdx = i;
      }
    });
    const [pick] = pool.splice(bestIdx, 1);
    if (!pick) break;
    chosen.push(pick);
    catCount.set(pick.event.category, (catCount.get(pick.event.category) ?? 0) + 1);
    const d = localDate(Date.parse(pick.event.start), prefs.timezone);
    dateCount.set(d, (dateCount.get(d) ?? 0) + 1);
  }
  return chosen;
}

/** Fewer suggestions when the week is busy — never fill free time for its own sake. */
export function weeklyCapacity(freeEvenings: number): number {
  if (freeEvenings <= 1) return 2;
  if (freeEvenings <= 3) return 4;
  return SHORTLIST_LIMIT;
}

export function isWeekend(e: CuratorEvent, tz: string): boolean {
  const wd = weekdayOfDate(localDate(Date.parse(e.start), tz));
  return wd === "sat" || wd === "sun";
}
