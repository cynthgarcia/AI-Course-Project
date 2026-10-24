// Strict validation of everything clients send. Unknown fields are stripped, sizes are
// bounded, and actions the server owns (plans, resets, sample data) are not accepted.
import { z } from "zod";
import { CATEGORY_LABELS, WEEKDAYS, type Category } from "@/lib/domain/types";
import { AREA_LABELS } from "@/lib/domain/areas";

const categories = Object.keys(CATEGORY_LABELS) as [Category, ...Category[]];
const areas = Object.keys(AREA_LABELS) as [string, ...string[]];
const weekday = z.enum(WEEKDAYS as [string, ...string[]]);
const time = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/);
const iso = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), "Invalid timestamp");
const id = z.string().min(1).max(200);
const text = (max: number) => z.string().max(max);
const currency = z.string().regex(/^[A-Z]{3}$/);

export const costItem = z.object({
  amount: z.number().finite().min(0).max(1_000_000).nullable(),
  currency,
  basis: z.enum(["verified", "sample", "user_estimate", "not_needed", "unknown"]),
});

const tripCosts = z.object({ ticket: costItem, transport: costItem, accommodation: costItem, other: costItem });

const timeBlock = z.object({
  id: text(80),
  category: z.enum(["open_to_suggestions", "keep_open_for_friends", "personal_time"]),
  weekday,
  startTime: time,
  endTime: time,
  label: text(120).nullable(),
});

export const preferencesPatch = z
  .object({
    homeNeighborhood: text(120),
    homeArea: z.enum(areas),
    officeNeighborhood: text(120),
    officeArea: z.enum(areas),
    officeDays: z.array(weekday).max(7),
    workEndTime: time,
    timezone: text(60).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-GB", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }),
    monthlyBudget: z.number().finite().min(0).max(1_000_000),
    budgetCurrency: currency,
    fxRates: z.record(currency, z.number().positive().max(10_000)),
    countTravelInBudget: z.boolean(),
    planningHorizonDays: z.number().int().min(1).max(90),
    advanceHorizonDays: z.number().int().min(1).max(365),
    prepBufferMinutes: z.number().int().min(0).max(240),
    minimumNoticeHours: z.number().min(0).max(168),
    latestHomeWeeknight: time,
    latestHomeWeekend: time,
    interests: z.record(z.enum(categories), z.number().int().min(0).max(3)),
    interestKeywords: z.array(text(40)).max(50),
    explorationLevel: z.number().int().min(0).max(3),
    diversityLevel: z.number().int().min(0).max(3),
    travelEnabled: z.boolean(),
    travelHorizonDays: z.number().int().min(1).max(365),
    maxTripHours: z.number().min(0).max(48),
    maxTripBudget: z.number().min(0).max(1_000_000).nullable(),
    digestEnabled: z.boolean(),
    digestDay: weekday,
    digestTime: time,
    protectedBlocks: z.array(timeBlock).max(60),
    weeklyFunIntention: z.boolean(),
    monthlyNewIntention: z.boolean(),
  })
  .partial()
  .strict();

const rating = z.number().int().min(1).max(5).nullable();

export const experience = z.object({
  id: z.string().uuid(),
  eventId: id.nullable(),
  title: z.string().trim().min(1).max(200),
  category: z.enum(categories),
  tags: z.array(text(40)).max(20),
  venueName: text(200).nullable(),
  neighborhood: text(120).nullable(),
  city: text(120).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(d))),
  rating,
  cost: costItem.nullable(),
  withWhom: z.enum(["solo", "friends", "new_people"]).nullable(),
  wasNew: z.boolean().nullable(),
  notes: text(2000),
  // Clients can't submit sample data to a real account.
  source: z.enum(["app", "manual"]),
  createdAt: iso,
  updatedAt: iso,
});

const reflection = z.object({
  rating: rating.optional(),
  enjoyed: z.boolean().nullable(),
  wouldRepeat: z.boolean().nullable(),
  wasNew: z.boolean().nullable(),
  wouldRecommend: z.boolean().nullable(),
  notes: text(2000),
});

const localStatus = z.enum(["interested", "saved", "invited", "planned", "attended", "skipped", "not_for_me"]);
const travelStatus = z.enum(["interested", "researching", "worth_considering", "planned", "attended", "not_for_me"]);
const dismissal = z.enum(["not_interested", "too_expensive", "too_far", "bad_timing", "not_my_kind", "already_attended", "not_enough_info", "other"]);
const cat = z.enum(categories);

export const clientAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("completeOnboarding") }),
  z.object({ type: z.literal("setPrefs"), prefs: preferencesPatch }),
  z.object({ type: z.literal("setCalendarMode"), mode: z.enum(["demo", "disconnected"]) }),
  z.object({
    type: z.literal("setStatus"),
    eventId: id,
    category: cat,
    status: localStatus,
    plannedCost: costItem.nullable().optional(),
    budgetOverride: z.boolean().optional(),
    experience: experience.optional(),
    at: iso,
  }),
  z.object({ type: z.literal("dismiss"), eventId: id, category: cat, reason: dismissal.nullable(), at: iso }),
  z.object({ type: z.literal("removeSaved"), eventId: id }),
  z.object({ type: z.literal("recordActualCost"), eventId: id, cost: costItem.nullable(), at: iso }),
  z.object({ type: z.literal("setNotes"), eventId: id, notes: text(2000), at: iso }),
  z.object({ type: z.literal("setReflection"), eventId: id, category: cat, reflection, at: iso }),
  z.object({
    type: z.literal("setTripStatus"),
    eventId: id,
    category: cat,
    status: travelStatus,
    initialCosts: tripCosts,
    budgetOverride: z.boolean().optional(),
    experience: experience.optional(),
    at: iso,
  }),
  z.object({ type: z.literal("setTripCosts"), eventId: id, costs: tripCosts, at: iso }),
  z.object({ type: z.literal("setTripActualCosts"), eventId: id, costs: tripCosts.nullable(), at: iso }),
  z.object({ type: z.literal("setTripNotes"), eventId: id, notes: text(4000), at: iso }),
  z.object({ type: z.literal("removeTrip"), eventId: id }),
  z.object({ type: z.literal("addExperience"), experience }),
  z.object({
    type: z.literal("updateExperience"),
    id: z.string().uuid(),
    patch: experience.pick({ title: true, category: true, tags: true, venueName: true, neighborhood: true, city: true, date: true, rating: true, cost: true, withWhom: true, wasNew: true, notes: true }).partial().strict(),
    at: iso,
  }),
  z.object({ type: z.literal("deleteExperience"), id: z.string().uuid() }),
  z.object({ type: z.literal("generatePlan") }),
]);

export type ClientAction = z.infer<typeof clientAction>;

export const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});
