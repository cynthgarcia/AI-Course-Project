// Application state and its reducer. Pure, so it can be unit-tested and later
// swapped for server persistence (Supabase) without touching the UI contract.
import { DEFAULT_PREFERENCES } from "@/lib/data/defaults";
import { canTransition, canTransitionTrip } from "@/lib/domain/status";
import type {
  Category,
  CostItem,
  DismissalReason,
  FeedbackEntry,
  LocalStatus,
  Preferences,
  Reflection,
  SavedEvent,
  SavedTrip,
  TravelStatus,
  TripCosts,
} from "@/lib/domain/types";
import { upsertPlan, type PlanRun, type WeeklyPlan } from "@/lib/domain/weeklyPlan";

export const STATE_VERSION = 1;

export interface AppState {
  version: number;
  onboarded: boolean;
  /**
   * "demo" uses the sample calendar; "snapshot" uses a read-only copy of the user's real
   * busy times when one is bundled; "disconnected" means no calendar. Live Google is Phase 3.
   */
  calendarMode: "demo" | "snapshot" | "disconnected";
  prefs: Preferences;
  saved: Record<string, SavedEvent>;
  trips: Record<string, SavedTrip>;
  feedback: FeedbackEntry[];
  plans: WeeklyPlan[];
  runs: PlanRun[];
}

export const INITIAL_STATE: AppState = {
  version: STATE_VERSION,
  onboarded: false,
  calendarMode: "demo",
  prefs: DEFAULT_PREFERENCES,
  saved: {},
  trips: {},
  feedback: [],
  plans: [],
  runs: [],
};

export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "completeOnboarding" }
  | { type: "setPrefs"; prefs: Partial<Preferences> }
  | { type: "setCalendarMode"; mode: AppState["calendarMode"] }
  | { type: "setStatus"; eventId: string; category: Category; status: LocalStatus; plannedCost?: CostItem | null; budgetOverride?: boolean; at: string }
  | { type: "dismiss"; eventId: string; category: Category; reason: DismissalReason | null; at: string }
  | { type: "removeSaved"; eventId: string }
  | { type: "recordActualCost"; eventId: string; cost: CostItem | null; at: string }
  | { type: "setNotes"; eventId: string; notes: string; at: string }
  | { type: "setReflection"; eventId: string; category: Category; reflection: Reflection; at: string }
  | { type: "setTripStatus"; eventId: string; category: Category; status: TravelStatus; initialCosts: TripCosts; budgetOverride?: boolean; at: string }
  | { type: "setTripCosts"; eventId: string; costs: TripCosts; at: string }
  | { type: "setTripActualCosts"; eventId: string; costs: TripCosts | null; at: string }
  | { type: "setTripNotes"; eventId: string; notes: string; at: string }
  | { type: "removeTrip"; eventId: string }
  | { type: "addPlan"; plan: WeeklyPlan; run: PlanRun }
  | { type: "recordFailedRun"; run: PlanRun }
  | { type: "reset" };

function blankSaved(eventId: string, status: LocalStatus, at: string): SavedEvent {
  return {
    eventId,
    status,
    plannedCost: null,
    actualCost: null,
    dismissalReason: null,
    budgetOverride: false,
    notes: "",
    reflection: null,
    attendedConfirmedAt: null,
    updatedAt: at,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "completeOnboarding":
      return { ...state, onboarded: true };
    case "setPrefs":
      return { ...state, prefs: { ...state.prefs, ...action.prefs } };
    case "setCalendarMode":
      return { ...state, calendarMode: action.mode };
    case "setStatus": {
      const current = state.saved[action.eventId];
      if (!canTransition(current?.status ?? null, action.status)) return state;
      const next: SavedEvent = {
        ...(current ?? blankSaved(action.eventId, action.status, action.at)),
        status: action.status,
        updatedAt: action.at,
      };
      if (action.plannedCost !== undefined) next.plannedCost = action.plannedCost;
      if (action.budgetOverride !== undefined) next.budgetOverride = action.budgetOverride;
      if (action.status === "attended") next.attendedConfirmedAt = action.at;
      if (action.status !== "attended") next.attendedConfirmedAt = null;
      const feedback =
        action.status === "saved" || action.status === "interested"
          ? [...state.feedback, { eventId: action.eventId, category: action.category, kind: "save" as const, reason: null, at: action.at }]
          : state.feedback;
      return { ...state, saved: { ...state.saved, [action.eventId]: next }, feedback };
    }
    case "dismiss": {
      const current = state.saved[action.eventId];
      const next: SavedEvent = {
        ...(current ?? blankSaved(action.eventId, "not_for_me", action.at)),
        status: "not_for_me",
        dismissalReason: action.reason,
        updatedAt: action.at,
      };
      return {
        ...state,
        saved: { ...state.saved, [action.eventId]: next },
        feedback: [...state.feedback, { eventId: action.eventId, category: action.category, kind: "dismiss", reason: action.reason, at: action.at }],
      };
    }
    case "removeSaved": {
      const { [action.eventId]: _removed, ...rest } = state.saved;
      return { ...state, saved: rest };
    }
    case "recordActualCost": {
      const current = state.saved[action.eventId];
      if (!current) return state;
      return { ...state, saved: { ...state.saved, [action.eventId]: { ...current, actualCost: action.cost, updatedAt: action.at } } };
    }
    case "setNotes": {
      const current = state.saved[action.eventId];
      if (!current) return state;
      return { ...state, saved: { ...state.saved, [action.eventId]: { ...current, notes: action.notes, updatedAt: action.at } } };
    }
    case "setReflection": {
      const current = state.saved[action.eventId];
      if (!current || current.status !== "attended") return state;
      const kind: FeedbackEntry["kind"] | null =
        action.reflection.enjoyed === true ? "attended_enjoyed" : action.reflection.enjoyed === false ? "attended_disliked" : null;
      const feedback = kind
        ? [...state.feedback.filter((f) => !(f.eventId === action.eventId && f.kind.startsWith("attended"))), { eventId: action.eventId, category: action.category, kind, reason: null, at: action.at }]
        : state.feedback;
      return { ...state, feedback, saved: { ...state.saved, [action.eventId]: { ...current, reflection: action.reflection, updatedAt: action.at } } };
    }
    case "setTripStatus": {
      const current = state.trips[action.eventId];
      if (!canTransitionTrip(current?.status ?? null, action.status)) return state;
      const next: SavedTrip = current
        ? { ...current, status: action.status, updatedAt: action.at }
        : { eventId: action.eventId, status: action.status, costs: action.initialCosts, actualCosts: null, notes: "", budgetOverride: false, updatedAt: action.at };
      if (action.budgetOverride !== undefined) next.budgetOverride = action.budgetOverride;
      const feedback =
        action.status === "not_for_me"
          ? [...state.feedback, { eventId: action.eventId, category: action.category, kind: "dismiss" as const, reason: null, at: action.at }]
          : state.feedback;
      return { ...state, feedback, trips: { ...state.trips, [action.eventId]: next } };
    }
    case "setTripCosts": {
      const current = state.trips[action.eventId];
      if (!current) return state;
      return { ...state, trips: { ...state.trips, [action.eventId]: { ...current, costs: action.costs, updatedAt: action.at } } };
    }
    case "setTripActualCosts": {
      const current = state.trips[action.eventId];
      if (!current) return state;
      return { ...state, trips: { ...state.trips, [action.eventId]: { ...current, actualCosts: action.costs, updatedAt: action.at } } };
    }
    case "setTripNotes": {
      const current = state.trips[action.eventId];
      if (!current) return state;
      return { ...state, trips: { ...state.trips, [action.eventId]: { ...current, notes: action.notes, updatedAt: action.at } } };
    }
    case "removeTrip": {
      const { [action.eventId]: _removed, ...rest } = state.trips;
      return { ...state, trips: rest };
    }
    case "addPlan":
      return { ...state, plans: upsertPlan(state.plans, action.plan), runs: [action.run, ...state.runs].slice(0, 30) };
    case "recordFailedRun":
      return { ...state, runs: [action.run, ...state.runs].slice(0, 30) };
    case "reset":
      return INITIAL_STATE;
  }
}

/** Validates and migrates persisted state; anything unexpected falls back to defaults. */
export function parsePersisted(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<AppState>;
    if (!data || typeof data !== "object" || data.version !== STATE_VERSION) return null;
    return {
      ...INITIAL_STATE,
      ...data,
      prefs: { ...DEFAULT_PREFERENCES, ...(data.prefs ?? {}), interests: { ...DEFAULT_PREFERENCES.interests, ...(data.prefs?.interests ?? {}) } },
    };
  } catch {
    return null;
  }
}
