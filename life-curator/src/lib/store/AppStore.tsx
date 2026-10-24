"use client";

// Client store. Two modes:
// - "server" (the real app): state lives in the database behind /api. Changes apply
//   instantly in the browser, then the server re-runs the same reducer and returns the
//   authoritative state.
// - "local" (static previews with no backend): state lives in this browser's localStorage.
// Derived data (events, fit, budget, ranking) is recomputed from inputs rather than stored.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { readEmbeddedSnapshot } from "@/lib/data/calendarSnapshot";
import { demoCalendar, DISCONNECTED_CALENDAR } from "@/lib/data/demoCalendar";
import { expandBlocks } from "@/lib/domain/availability";
import { summarizeMonth, type BudgetSummary } from "@/lib/domain/budget";
import { rankAll, type RankContext, type Recommendation } from "@/lib/domain/ranking";
import { DAY, addDays, localDate } from "@/lib/domain/time";
import type { CalendarSnapshot, CategorizedInterval, CuratorEvent } from "@/lib/domain/types";
import { collectEvents } from "@/lib/sources";
import type { SourceRunResult } from "@/lib/sources/types";
import { hobbyTasteEntries, type UserHobby } from "@/lib/domain/hobbies";
import { generateWeeklyPlan } from "@/lib/domain/weeklyPlan";
import { INITIAL_STATE, parsePersisted, reducer, type Action, type AppState } from "./state";

declare global {
  interface Window {
    /** Set by static preview builds that have no backend. */
    __LC_STATIC__?: boolean;
    /** Optional first-run data for a personal static preview (applied once, on a fresh browser). */
    __LC_SEED__?: { goals?: string[]; hobbies?: UserHobby[] };
  }
}

export type StoreMode = "server" | "local";

export interface SourceStatus {
  id: string;
  name: string;
  configured: boolean;
  note: string;
}

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
  mode: StoreMode;
  state: AppState;
  dispatch: (a: Action) => void;
  /** Builds this week's plan (on the server in server mode). */
  generatePlan: () => Promise<{ ok: boolean; count: number }>;
  /** Signed-in account (server mode only). */
  email: string | null;
  /** Last save problem, shown to the user; cleared on the next successful save. */
  syncError: string | null;
  ready: boolean;
  loadError: string | null;
  storageAvailable: boolean;
  /** A bundled read-only copy of the user's real busy times, when this build has one. */
  snapshot: CalendarSnapshot | null;
  /** Which event sources the server has configured (server mode only). */
  sources: SourceStatus[];
  derived: Derived | null;
}

const Ctx = createContext<Store | null>(null);

async function postActions(actions: unknown[]): Promise<AppState> {
  // keepalive lets the save finish even if the user navigates away straight after.
  const payload = JSON.stringify(actions.length === 1 ? actions[0] : { actions });
  const res = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: payload.length < 60_000 });
  if (res.status === 401) {
    window.location.assign("/login");
    throw new Error("Signed out");
  }
  const body = (await res.json().catch(() => ({}))) as { state?: AppState; error?: string };
  if (!res.ok || !body.state) throw new Error(body.error ?? "Couldn't save that change.");
  return body.state;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, localDispatch] = useReducer(reducer, INITIAL_STATE);
  const [mode] = useState<StoreMode>(() => (typeof window !== "undefined" && window.__LC_STATIC__ ? "local" : "server"));
  const [email, setEmail] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const outbox = useRef<Action[]>([]);
  const inFlight = useRef<Promise<void> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [now, setNow] = useState<number | null>(null);
  const [catalogueEvents, setEvents] = useState<CuratorEvent[] | null>(null);
  const [sourceRuns, setSourceRuns] = useState<SourceRunResult[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [snapshot] = useState<CalendarSnapshot | null>(() => readEmbeddedSnapshot());

  const reloadFromServer = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!res.ok) throw new Error("load failed");
    const body = (await res.json()) as { email: string; state: AppState };
    setEmail(body.email);
    localDispatch({ type: "hydrate", state: body.state });
  }, []);

  // Hydrate once, on the client.
  useEffect(() => {
    if (mode === "server") {
      reloadFromServer()
        .then(() => setHydrated(true))
        .catch(() => setLoadError("Your data couldn't be loaded."));
    } else {
      try {
        const restored = parsePersisted(window.localStorage.getItem(STORAGE_KEY));
        if (restored) localDispatch({ type: "hydrate", state: restored });
        // Applied once per browser, and never over hobbies or goals the user already has.
        const fresh = !restored || (Object.keys(restored.hobbies).length === 0 && !restored.prefs.goals?.length);
        if (window.__LC_SEED__ && fresh && !window.localStorage.getItem(`${STORAGE_KEY}:seeded`)) {
          window.localStorage.setItem(`${STORAGE_KEY}:seeded`, "1");
          const seed = window.__LC_SEED__;
          if (seed.goals?.length) localDispatch({ type: "setPrefs", prefs: { goals: seed.goals } });
          for (const hobby of seed.hobbies ?? []) localDispatch({ type: "addHobby", hobby });
        }
      } catch {
        setStorageAvailable(false);
      }
      setHydrated(true);
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [mode, reloadFromServer]);

  // Changes made together (same tick) are sent together, in order, as one request.
  const flush = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      while (outbox.current.length) {
        const batch = outbox.current.splice(0, 50);
        try {
          const serverState = await postActions(batch);
          // Only adopt the server's copy once no newer local changes are waiting.
          if (!outbox.current.length) localDispatch({ type: "hydrate", state: serverState });
          setSyncError(null);
        } catch (e) {
          outbox.current = [];
          setSyncError((e as Error).message);
          await reloadFromServer().catch(() => undefined);
        }
      }
    })().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }, [reloadFromServer]);

  const dispatch = useCallback(
    (action: Action) => {
      localDispatch(action);
      if (mode !== "server" || action.type === "hydrate" || action.type === "reset") return;
      const first = outbox.current.length === 0 && !inFlight.current;
      outbox.current.push(action);
      if (first) queueMicrotask(() => void flush());
    },
    [mode, flush],
  );

  // Warn before closing the tab while changes are still being saved.
  useEffect(() => {
    if (mode !== "server") return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (outbox.current.length || inFlight.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [mode]);

  useEffect(() => {
    if (!hydrated || mode !== "local") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setStorageAvailable(false);
    }
  }, [state, hydrated, mode]);

  // Load events once a clock is available (refresh hourly is plenty).
  const loadHour = now === null ? null : Math.floor(now / 3_600_000);
  useEffect(() => {
    if (loadHour === null) return;
    const t = loadHour * 3_600_000;
    const load =
      mode === "server"
        ? fetch("/api/events").then(async (r) => {
            if (!r.ok) throw new Error("events");
            return (await r.json()) as { events: CuratorEvent[]; runs: SourceRunResult[]; sources?: SourceStatus[] };
          })
        : collectEvents({ from: t - 14 * DAY, to: t + 120 * DAY }, t);
    load
      .then(({ events, runs, ...rest }) => {
        if ("sources" in rest && Array.isArray(rest.sources)) setSources(rest.sources);
        setEvents(events);
        setSourceRuns(runs);
        // Only an error when every source actually failed (not when one is still loading).
        setLoadError(runs.length > 0 && events.length === 0 && runs.every((r) => !r.ok && r.error) ? "No event sources could be loaded." : null);
      })
      .catch(() => setLoadError("Events could not be loaded."));
  }, [loadHour, mode]);

  const derived = useMemo<Derived | null>(() => {
    if (now === null || catalogueEvents === null) return null;
    const { prefs } = state;
    // The shared catalogue plus events this user added themselves.
    const events = [...catalogueEvents, ...Object.values(state.customEvents)].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const calendar =
      state.calendarMode === "demo"
        ? demoCalendar(now)
        : state.calendarMode === "snapshot" && snapshot
          ? snapshot
          : DISCONNECTED_CALENDAR;
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
      experiences: [...Object.values(state.experiences), ...hobbyTasteEntries(Object.values(state.hobbies))],
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
  }, [now, catalogueEvents, sourceRuns, state, snapshot]);

  const generatePlan = useCallback(async () => {
    if (mode === "server") {
      try {
        await flush();
        const next = await postActions([{ type: "generatePlan" }]);
        localDispatch({ type: "hydrate", state: next });
        const run = next.runs[0];
        return { ok: run?.outcome === "generated", count: run?.itemCount ?? 0 };
      } catch (e) {
        setSyncError((e as Error).message);
        return { ok: false, count: 0 };
      }
    }
    if (!derived) return { ok: false, count: 0 };
    const at = new Date().toISOString();
    try {
      const plan = generateWeeklyPlan(derived.events, derived.rankContext);
      localDispatch({ type: "addPlan", plan, run: { at, weekStart: plan.weekStart, trigger: "manual", outcome: "generated", itemCount: plan.items.length, error: null } });
      return { ok: true, count: plan.items.length };
    } catch {
      localDispatch({ type: "recordFailedRun", run: { at, weekStart: localDate(Date.now(), state.prefs.timezone), trigger: "manual", outcome: "failed", itemCount: 0, error: "Plan generation failed." } });
      return { ok: false, count: 0 };
    }
  }, [mode, derived, state.prefs.timezone, flush]);

  const value = useMemo<Store>(
    () => ({ mode, state, dispatch, generatePlan, email, syncError, ready: hydrated && derived !== null, loadError, storageAvailable, snapshot, sources, derived }),
    [mode, state, dispatch, generatePlan, email, syncError, hydrated, derived, loadError, storageAvailable, snapshot, sources],
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
