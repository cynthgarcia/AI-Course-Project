// Core domain types for Your Life Curator.
// Unknown values are represented explicitly (null / "unknown"), never guessed.

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type Category =
  | "music"
  | "theatre"
  | "art"
  | "film"
  | "sports"
  | "literature"
  | "tech"
  | "investing"
  | "social"
  | "creative"
  | "wellness"
  | "faith"
  | "food"
  | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  music: "Music & live performance",
  theatre: "Theatre",
  art: "Art & exhibitions",
  film: "Film",
  sports: "Sports & movement",
  literature: "Literature & ideas",
  tech: "AI & technology",
  investing: "Investing & entrepreneurship",
  social: "Social & galas",
  creative: "Creativity & learning",
  wellness: "Wellness",
  faith: "Faith & community",
  food: "Food & culture",
  other: "Something different",
};

/** London area zones used for approximate travel estimates. */
export type AreaId =
  | "soho"
  | "covent_garden"
  | "fitzrovia"
  | "west_end"
  | "south_bank"
  | "city"
  | "shoreditch"
  | "chelsea"
  | "fulham"
  | "kensington"
  | "camden"
  | "greenwich"
  | "outer_london";

export type PriceStatus = "known" | "free" | "range" | "unknown";

export interface Price {
  status: PriceStatus;
  /** Minimum (or exact) price. null when status is "free" or "unknown". */
  min: number | null;
  max: number | null;
  currency: string;
  /** Whether a quoted price is confirmed to include booking fees. null = not confirmed. */
  includesFees: boolean | null;
}

export type VerificationStatus = "demo" | "verified" | "unverified" | "stale";

export interface Verification {
  status: VerificationStatus;
  lastVerifiedAt: string | null;
  sourceName: string;
}

export type Eligibility = "public" | "members" | "invite_only" | "unknown";
export type SocialFit = "friends" | "solo" | "meet_people" | "either";

export interface Venue {
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string;
  country: string;
  /** London area for travel estimates; null outside London or when unknown. */
  area: AreaId | null;
}

export interface SourceRecord {
  sourceId: string;
  externalId: string | null;
  url: string | null;
  lastSeenAt: string;
}

export interface CuratorEvent {
  id: string;
  title: string;
  description: string;
  category: Category;
  tags: string[];
  venue: Venue;
  /** UTC ISO timestamps. */
  start: string;
  end: string | null;
  timezone: string;
  price: Price;
  officialUrl: string | null;
  bookingUrl: string | null;
  organizer: string | null;
  eligibility: Eligibility;
  dressCode: string | null;
  accessibility: string | null;
  verification: Verification;
  isDemo: boolean;
  socialFit: SocialFit | null;
  /** Booking deadline (UTC ISO) when known. */
  bookingDeadline: string | null;
  /** True if the event is known to need advance planning (e.g. sells out early). */
  advancePlanning: boolean;
  /** Destination id for events outside London. */
  destinationId: string | null;
  /** Groups multiple performances of the same production. */
  occurrenceGroupId: string | null;
  sourceRecords: SourceRecord[];
  /** How to get in when attendance is restricted (e.g. "Buy a table via the charity"). User-entered. */
  accessNote?: string | null;
  /** Added by the user (by hand or from a link) — only visible to them. */
  addedByUser?: boolean;
}

export interface Interval {
  start: number; // epoch ms
  end: number; // epoch ms
}

export type ProtectedCategory = "open_to_suggestions" | "keep_open_for_friends" | "personal_time";

export const PROTECTED_LABELS: Record<ProtectedCategory, string> = {
  open_to_suggestions: "Open to suggestions",
  keep_open_for_friends: "Keep open for friends",
  personal_time: "Personal time",
};

/** A weekly recurring time block in the user's home timezone. */
export interface TimeBlock {
  id: string;
  category: ProtectedCategory;
  weekday: Weekday;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"; may be "24:00"
  label: string | null;
}

export interface CategorizedInterval extends Interval {
  category: ProtectedCategory;
  label: string | null;
}

/** "snapshot" = a read-only copy of the user's real busy times taken at a fixed moment (not live). */
export type CalendarMode = "demo" | "snapshot" | "live" | "disconnected";

export interface CalendarSnapshot {
  mode: CalendarMode;
  /** Busy intervals only — never titles or descriptions. */
  busy: Interval[];
  fetchedAt: string | null;
}

export interface Preferences {
  homeNeighborhood: string;
  homeArea: AreaId;
  officeNeighborhood: string;
  officeArea: AreaId;
  officeDays: Weekday[];
  workEndTime: string; // "HH:mm" — used only as a fallback when no calendar is connected
  timezone: string;
  monthlyBudget: number;
  budgetCurrency: string;
  /** User-entered exchange rates into budget currency, e.g. { EUR: 0.85 }. Never defaulted. */
  fxRates: Record<string, number>;
  countTravelInBudget: boolean;
  planningHorizonDays: number;
  advanceHorizonDays: number;
  prepBufferMinutes: number;
  minimumNoticeHours: number;
  /** Latest comfortable home arrival on a work night, "HH:mm". */
  latestHomeWeeknight: string;
  latestHomeWeekend: string;
  interests: Record<Category, number>; // 0–3
  interestKeywords: string[];
  explorationLevel: number; // 0–3
  diversityLevel: number; // 0–3
  travelEnabled: boolean;
  /** How far ahead to look for trips worth travelling for. */
  travelHorizonDays: number;
  maxTripHours: number; // preferred maximum one-way door-to-door hours
  maxTripBudget: number | null;
  digestEnabled: boolean;
  digestDay: Weekday;
  digestTime: string;
  protectedBlocks: TimeBlock[];
  /** What the user wants more of in life — goal keys (see hobbies.ts) or their own words. */
  goals: string[];
  weeklyFunIntention: boolean;
  monthlyNewIntention: boolean;
}

export type LocalStatus =
  | "interested"
  | "saved"
  | "invited"
  | "planned"
  | "attended"
  | "skipped"
  | "not_for_me";

export const LOCAL_STATUS_LABELS: Record<LocalStatus, string> = {
  interested: "Interested",
  saved: "Saved",
  invited: "Invited friends",
  planned: "Planned",
  attended: "Attended",
  skipped: "Skipped",
  not_for_me: "Not for me",
};

export type TravelStatus =
  | "interested"
  | "researching"
  | "worth_considering"
  | "planned"
  | "attended"
  | "not_for_me";

export const TRAVEL_STATUS_LABELS: Record<TravelStatus, string> = {
  interested: "Interested",
  researching: "Researching",
  worth_considering: "Worth considering",
  planned: "Planned",
  attended: "Attended",
  not_for_me: "Not for me",
};

export type DismissalReason =
  | "not_interested"
  | "too_expensive"
  | "too_far"
  | "bad_timing"
  | "not_my_kind"
  | "already_attended"
  | "not_enough_info"
  | "other";

export const DISMISSAL_LABELS: Record<DismissalReason, string> = {
  not_interested: "Not interested",
  too_expensive: "Too expensive",
  too_far: "Too far away",
  bad_timing: "Bad timing",
  not_my_kind: "Not my kind of event",
  already_attended: "Already attended",
  not_enough_info: "Not enough information",
  other: "Other",
};

export type CostBasis = "verified" | "sample" | "user_estimate" | "not_needed" | "unknown";

export interface CostItem {
  amount: number | null;
  currency: string;
  basis: CostBasis;
}

export interface Reflection {
  /** 1–5 stars. Feeds the taste profile used in ranking. */
  rating?: number | null;
  enjoyed: boolean | null;
  wouldRepeat: boolean | null;
  wasNew: boolean | null;
  wouldRecommend: boolean | null;
  notes: string;
}

export interface SavedEvent {
  eventId: string;
  status: LocalStatus;
  /** The cost the user expects to pay once planned (defaults from the event's known price). */
  plannedCost: CostItem | null;
  /** The cost actually paid, recorded by the user. Supersedes plannedCost. */
  actualCost: CostItem | null;
  dismissalReason: DismissalReason | null;
  budgetOverride: boolean;
  notes: string;
  reflection: Reflection | null;
  attendedConfirmedAt: string | null;
  updatedAt: string;
}

export interface TripCosts {
  ticket: CostItem;
  transport: CostItem;
  accommodation: CostItem;
  other: CostItem;
}

export interface SavedTrip {
  eventId: string;
  status: TravelStatus;
  costs: TripCosts;
  actualCosts: TripCosts | null;
  notes: string;
  budgetOverride: boolean;
  updatedAt: string;
}

export interface FeedbackEntry {
  eventId: string;
  category: Category;
  kind: "dismiss" | "save" | "attended_enjoyed" | "attended_disliked";
  reason: DismissalReason | null;
  at: string;
}

export type WithWhom = "solo" | "friends" | "new_people";

/**
 * Something the user actually went to — from an in-app event they confirmed attending,
 * or added by hand (including from years before they used the app). Powers Wrapped
 * and the taste profile.
 */
export interface Experience {
  id: string;
  /** Linked catalogue event, when the experience came from one. */
  eventId: string | null;
  title: string;
  category: Category;
  tags: string[];
  venueName: string | null;
  neighborhood: string | null;
  city: string | null;
  /** Local date "YYYY-MM-DD". */
  date: string;
  /** 1–5 stars, or null when not rated yet. */
  rating: number | null;
  cost: CostItem | null;
  withWhom: WithWhom | null;
  wasNew: boolean | null;
  notes: string;
  source: "app" | "manual" | "sample";
  createdAt: string;
  updatedAt: string;
}
