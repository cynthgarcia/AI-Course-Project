"use client";

// Client store. Phase 1 persists to this browser's localStorage only; Phase 2 moves
// user data to Supabase with row-level security. Derived data (events, fit, budget)
// is recomputed from inputs rather than stored.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { demoCalendar, DISCONNECTED_CALENDAR } from "@/lib/data/demoCalendar";
import { expandBlocks } from "@/lib/domain/availability";
import { summarizeMonth, type BudgetSummary } from "@/lib/domain/budget";
import { rankAll, type RankContext, type Recommendation } from "@/lib/domain/ranking";
import { DAY, addDays, localDate } from "@/lib/domain/time";
import type { CalendarSnapshot, CategorizedInterval, CuratorEvent } from "@/lib/domain/types";
import { collectEvents } from "@/lib/sources";
import type { SourceRunResult } from "@/lib/sources/types";
import { INITIAL_STATE, parsePersisted, reducer, type Action, type AppState } from "./state";

const STORAGE_KEY = "life-curator:v1";

export interface Derived {
  now: number;
  events: CuratorEvent[];
  eventMap: Map<string, CuratorEvent>;
  sourceRuns: SourceRunResult[];
  calendar: CalendarSnapshot;
  protectedIntervals: CategorizedInterval[];
  budget: BudgetSummary;
  /** Next month's summary, so upcoming planned costs are visible early. */
  nextBudget: BudgetSummary;
  /** Budget summary for the month an event falls in ("YYYY-MM"). */
  budgetForMonth: (month: string) => BudgetSummary;
  recommend: Recommendation[];
  browse: Recommendation[];
  rankContext: RankContext;
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  ready: boolean;
  loadError: string | null;
  storageAvailable: boolean;
  derived: Derived | null;
}

const Ctx = createContext<Store | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [now, setNow] = useState<number | null>(null);
  const [events, setEvents] = useState<CuratorEvent[] | null>(null);
  const [sourceRuns, setSourceRuns] = useState<SourceRunResult[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Hydrate from storage once, on the client.
  useEffect(() => {
    try {
      const restored = parsePersisted(window.localStorage.getItem(STORAGE_KEY));
      if (restored) dispatch({ type: "hydrate", state: restored });
    } catch {
      setStorageAvailable(false);
    }
    setHydrated(true);
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setStorageAvailable(false);
    }
  }, [state, hydrated]);

  // Load events once a clock is available (refresh hourly is plenty for sample data).
  const loadHour = now === null ? null : Math.floor(now / 3_600_000);
  useEffect(() => {
    if (loadHour === null) return;
    const t = loadHour * 3_600_000;
    collectEvents({ from: t - 14 * DAY, to: t + 120 * DAY }, t)
      .then(({ events, runs }) => {
        setEvents(events);
        setSourceRuns(runs);
        setLoadError(runs.every((r) => !r.ok) ? "No event sources could be loaded." : null);
      })
      .catch(() => setLoadError("Events could not be loaded."));
  }, [loadHour]);

  const derived = useMemo<Derived | null>(() => {
    if (now === null || events === null) return null;
    const { prefs } = state;
    const calendar = state.calendarMode === "demo" ? demoCalendar(now) : DISCONNECTED_CALENDAR;
    const today = localDate(now, prefs.timezone);
    const protectedIntervals = expandBlocks(prefs.protectedBlocks, addDays(today, -1), 130, prefs.timezone);
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const budgetForMonth = (month: string) => summarizeMonth(month, eventMap, Object.values(state.saved), Object.values(state.trips), prefs);
    const budget = budgetForMonth(today.slice(0, 7));
    const nextBudget = budgetForMonth(addDays(`${today.slice(0, 7)}-28`, 7).slice(0, 7));
    const rankContext: RankContext = {
      now,
      prefs,
      calendar,
      protectedIntervals,
      saved: new Map(Object.entries(state.saved)),
      trips: new Map(Object.entries(state.trips)),
      feedback: state.feedback,
      remainingBudget: budget.remaining,
      mode: "recommend",
    };
    return {
      now,
      events,
      eventMap,
      sourceRuns,
      calendar,
      protectedIntervals,
      budget,
      nextBudget,
      budgetForMonth,
      recommend: rankAll(events, rankContext),
      browse: rankAll(events, { ...rankContext, mode: "browse" }),
      rankContext,
    };
  }, [now, events, sourceRuns, state]);

  const value = useMemo<Store>(
    () => ({ state, dispatch, ready: hydrated && derived !== null, loadError, storageAvailable, derived }),
    [state, hydrated, derived, loadError, storageAvailable],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside AppStoreProvider");
  return s;
}

/** Convenience: current ISO timestamp for actions. */
export function useStamp(): () => string {
  return useCallback(() => new Date().toISOString(), []);
}

export function exportState(state: AppState): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), app: "your-life-curator", data: state }, null, 2);
}

export function clearStoredState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing persisted to clear.
  }
}
