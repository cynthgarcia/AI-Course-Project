// SAMPLE DATA ONLY. Every event, venue and price here is fictional and exists to
// demonstrate the app. Dates are generated relative to "now" so the demo stays usable.
// Sample events have no official or booking links, so no booking action is ever shown.
import { MINUTE, addDays, localDate, startOfWeek, zonedToEpoch } from "@/lib/domain/time";
import type { AreaId, Category, CuratorEvent, Eligibility, PriceStatus, SocialFit, Weekday } from "@/lib/domain/types";
import type { EventSourceAdapter, SourceRange } from "./types";

interface DemoDef {
  key: string;
  week: number;
  weekday: Weekday;
  time: string;
  minutes: number | null;
  title: string;
  category: Category;
  tags: string[];
  venue: string;
  neighborhood: string;
  area?: AreaId;
  destinationId?: string;
  city?: string;
  country?: string;
  tz?: string;
  description: string;
  price: { status: PriceStatus; min?: number; max?: number; currency?: string };
  social?: SocialFit;
  eligibility?: Eligibility;
  dressCode?: string;
  advance?: boolean;
  deadlineDaysBefore?: number;
  group?: string;
  /** Simulates the same event arriving from a second feed (for deduplication). */
  duplicateFromSecondFeed?: boolean;
}

const WEEKDAY_INDEX: Record<Weekday, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

export const DEMO_DEFS: DemoDef[] = [
  { key: "jazz-trio", week: 1, weekday: "tue", time: "19:30", minutes: 120, title: "Late-Night Jazz Trio Session", category: "music", tags: ["jazz", "live music", "intimate venue"], venue: "The Lantern Room", neighborhood: "Soho", area: "soho", description: "A piano trio playing standards and originals in a low-lit basement room. Two sets with a short interval.", price: { status: "known", min: 18 }, social: "either", duplicateFromSecondFeed: true },
  { key: "chamber-mozart-1", week: 1, weekday: "wed", time: "19:00", minutes: 120, title: "Chamber Orchestra: Mozart by Candlelight", category: "music", tags: ["classical", "orchestra", "candlelight"], venue: "St Aldric's Hall", neighborhood: "Covent Garden", area: "covent_garden", description: "A string chamber orchestra performs Eine kleine Nachtmusik and a Mozart divertimento by candlelight.", price: { status: "range", min: 25, max: 55 }, social: "friends", advance: true, group: "chamber-mozart" },
  { key: "chamber-mozart-2", week: 2, weekday: "sat", time: "19:30", minutes: 120, title: "Chamber Orchestra: Mozart by Candlelight", category: "music", tags: ["classical", "orchestra", "candlelight"], venue: "St Aldric's Hall", neighborhood: "Covent Garden", area: "covent_garden", description: "A string chamber orchestra performs Eine kleine Nachtmusik and a Mozart divertimento by candlelight.", price: { status: "range", min: 25, max: 55 }, social: "friends", advance: true, group: "chamber-mozart" },
  { key: "ai-meetup", week: 1, weekday: "thu", time: "18:30", minutes: 120, title: "AI Product Builders Meetup: Agents in Production", category: "tech", tags: ["AI", "product", "meetup", "demos"], venue: "Foundry Loft", neighborhood: "Fitzrovia", area: "fitzrovia", description: "Three short talks from teams shipping AI agents, followed by live demos and drinks.", price: { status: "free" }, social: "meet_people" },
  { key: "pottery", week: 1, weekday: "sat", time: "11:00", minutes: 120, title: "Beginner Pottery Wheel Taster", category: "creative", tags: ["pottery", "beginner-friendly", "hands-on"], venue: "Riverside Clay Studio", neighborhood: "Fulham", area: "fulham", description: "Learn to centre and throw a simple bowl on the wheel. All materials and firing included.", price: { status: "known", min: 45 }, social: "either" },
  { key: "padel", week: 1, weekday: "sat", time: "14:30", minutes: 90, title: "Social Padel Mixer (Beginners Welcome)", category: "sports", tags: ["padel", "social sport", "beginner-friendly"], venue: "Kings Road Padel Club", neighborhood: "Chelsea", area: "chelsea", description: "Rotating doubles games matched by level, with coaching tips between rounds.", price: { status: "known", min: 22 }, social: "meet_people" },
  { key: "pilates", week: 1, weekday: "sun", time: "10:00", minutes: 60, title: "Reformer Pilates Intro Class", category: "sports", tags: ["pilates", "beginner-friendly"], venue: "Parsons Studio", neighborhood: "Parsons Green", area: "fulham", description: "A small-group introduction to reformer Pilates for first-timers.", price: { status: "known", min: 28 }, social: "solo" },
  { key: "poetry", week: 1, weekday: "sun", time: "15:00", minutes: 120, title: "Poetry & Prose Open Evening", category: "literature", tags: ["poetry", "readings", "open mic"], venue: "The Quill Bookshop", neighborhood: "Covent Garden", area: "covent_garden", description: "Featured readers followed by an open floor. Come to listen or bring something to read.", price: { status: "known", min: 8 }, social: "either" },
  { key: "author-talk", week: 1, weekday: "wed", time: "18:30", minutes: 90, title: "Author Talk: Writing About Cities", category: "literature", tags: ["author talk", "books", "ideas"], venue: "Marlowe Library Rooms", neighborhood: "Fitzrovia", area: "fitzrovia", description: "A novelist and an urban historian discuss how cities shape stories. Signing afterwards.", price: { status: "known", min: 12 }, social: "solo" },
  { key: "lunch-recital", week: 1, weekday: "wed", time: "12:30", minutes: 50, title: "Lunchtime Organ Recital", category: "music", tags: ["classical", "free"], venue: "St Aldric's Hall", neighborhood: "Covent Garden", area: "covent_garden", description: "A short midday recital of Bach and Buxtehude.", price: { status: "free" }, social: "solo" },
  { key: "musical", week: 1, weekday: "fri", time: "19:30", minutes: 165, title: "West End Revival: A Musical in Two Acts", category: "theatre", tags: ["musical theatre", "West End"], venue: "The Regent Playhouse", neighborhood: "West End", area: "west_end", description: "A celebrated golden-age musical returns in a new staging with a full orchestra.", price: { status: "range", min: 35, max: 120 }, social: "friends", advance: true },
  { key: "jazz-supper", week: 0, weekday: "sat", time: "19:30", minutes: 150, title: "Jazz & Soul Supper Club", category: "music", tags: ["jazz", "dinner", "live music"], venue: "The Lantern Room", neighborhood: "Soho", area: "soho", description: "Three-course supper with a soul-jazz quartet.", price: { status: "known", min: 35 }, social: "friends" },
  { key: "angel-101", week: 2, weekday: "tue", time: "18:30", minutes: 120, title: "Angel Investing 101: How Early-Stage Deals Work", category: "investing", tags: ["angel", "investing", "education", "founder"], venue: "Greek Street Rooms", neighborhood: "Soho", area: "soho", description: "An educational session on how angel rounds, valuations and dilution work, with a Q&A. No investment products are sold.", price: { status: "known", min: 15 }, social: "meet_people" },
  { key: "founders-fireside", week: 2, weekday: "tue", time: "19:00", minutes: 120, title: "Founders' Fireside: Bootstrapping vs Raising", category: "investing", tags: ["founder", "startups", "entrepreneurship"], venue: "Old Street Works", neighborhood: "Shoreditch", area: "shoreditch", description: "Two founders compare building with and without venture funding.", price: { status: "unknown" }, social: "meet_people" },
  { key: "gallery-late", week: 2, weekday: "wed", time: "18:00", minutes: 180, title: "Gallery Late: Contemporary Photography Opening", category: "art", tags: ["photography", "opening", "exhibition"], venue: "Bankside Gallery Two", neighborhood: "South Bank", area: "south_bank", description: "Opening night of a group show of contemporary documentary photography.", price: { status: "free" }, social: "either" },
  { key: "film-70mm", week: 2, weekday: "thu", time: "19:00", minutes: 160, title: "Film Club: 70mm Classic Screening", category: "film", tags: ["cinema", "70mm", "special screening"], venue: "The Kinema", neighborhood: "Soho", area: "soho", description: "A rare 70mm projection of an epic classic, introduced by a film historian.", price: { status: "known", min: 16 }, social: "either" },
  { key: "life-drawing", week: 2, weekday: "sat", time: "10:30", minutes: 180, title: "Life Drawing for Total Beginners", category: "creative", tags: ["drawing", "painting", "beginner-friendly"], venue: "Charlotte Street Atelier", neighborhood: "Fitzrovia", area: "fitzrovia", description: "A guided class covering proportion and gesture. Materials provided.", price: { status: "known", min: 30 }, social: "solo" },
  { key: "winter-gala", week: 2, weekday: "sat", time: "19:30", minutes: 240, title: "Charity Winter Gala Reception", category: "social", tags: ["gala", "charity", "reception"], venue: "The Albemarle Rooms", neighborhood: "Mayfair", area: "west_end", description: "A fundraising reception with a string quartet and silent auction. Tickets are on general sale.", price: { status: "known", min: 95 }, social: "friends", eligibility: "public", dressCode: "Black tie optional", advance: true, deadlineDaysBefore: 7 },
  { key: "choral-mass", week: 2, weekday: "sun", time: "11:00", minutes: 75, title: "Sunday Choral Mass & Organ Voluntary", category: "faith", tags: ["catholic", "choral", "community"], venue: "St Aldric's Church", neighborhood: "West End", area: "west_end", description: "Sung Mass with a full choir, open to all, followed by coffee in the hall.", price: { status: "free" }, social: "either" },
  { key: "volleyball", week: 2, weekday: "sun", time: "14:00", minutes: 120, title: "Volleyball Social: Indoor Drop-in", category: "sports", tags: ["volleyball", "social sport"], venue: "Eastside Sports Hall", neighborhood: "Shoreditch", area: "shoreditch", description: "Mixed-ability indoor games; teams formed on the night.", price: { status: "known", min: 10 }, social: "meet_people" },
  { key: "mindfulness", week: 3, weekday: "wed", time: "19:30", minutes: 90, title: "Mindfulness & Reflection Evening", category: "wellness", tags: ["mindfulness", "reflection"], venue: "Chelsea Quiet House", neighborhood: "Chelsea", area: "chelsea", description: "A guided evening of meditation, journalling and quiet reflection.", price: { status: "known", min: 15 }, social: "solo" },
  { key: "improv", week: 3, weekday: "thu", time: "18:45", minutes: 150, title: "Improv Acting Taster", category: "creative", tags: ["acting", "improv", "beginner-friendly"], venue: "Neal's Yard Studio", neighborhood: "Covent Garden", area: "covent_garden", description: "Games and scenes for complete beginners. Nobody performs alone.", price: { status: "known", min: 25 }, social: "meet_people" },
  { key: "watercolours", week: 1, weekday: "thu", time: "19:00", minutes: 120, title: "Wine & Watercolours", category: "creative", tags: ["painting", "watercolour", "social"], venue: "Dean Street Studio", neighborhood: "Soho", area: "soho", description: "A relaxed guided watercolour session with a glass of wine.", price: { status: "known", min: 38 }, social: "friends" },
  { key: "mahler", week: 4, weekday: "sat", time: "19:00", minutes: 110, title: "Symphony Gala: Mahler's Fifth", category: "music", tags: ["classical", "orchestra", "symphony"], venue: "Riverside Concert Hall", neighborhood: "South Bank", area: "south_bank", description: "A full symphony orchestra performs Mahler's Symphony No. 5.", price: { status: "range", min: 40, max: 90 }, social: "either", advance: true, deadlineDaysBefore: 14 },
  { key: "lit-fest", week: 5, weekday: "sat", time: "13:00", minutes: 300, title: "Winter Literary Festival — Day Pass", category: "literature", tags: ["literary festival", "author talk", "books"], venue: "Riverside Concert Hall", neighborhood: "South Bank", area: "south_bank", description: "A day of author conversations, panels and readings.", price: { status: "known", min: 30 }, social: "either", advance: true },
  { key: "private-dinner", week: 2, weekday: "fri", time: "19:00", minutes: 180, title: "Founders' Private Supper", category: "social", tags: ["dinner", "founder", "networking"], venue: "A members' club", neighborhood: "Soho", area: "soho", description: "An invitation-only dinner. Eligibility is not established.", price: { status: "unknown" }, social: "meet_people", eligibility: "invite_only" },

  // Europe — travel-worthy candidates.
  { key: "paris-baroque", week: 2, weekday: "sat", time: "20:00", minutes: 180, title: "Baroque Opera Night in a Historic Theatre", category: "music", tags: ["classical", "opera", "one-off", "hard-to-replicate"], venue: "Théâtre des Lumières", neighborhood: "9th arrondissement", destinationId: "paris", city: "Paris", country: "France", tz: "Europe/Paris", description: "A rarely staged baroque opera with period instruments in a restored 18th-century theatre.", price: { status: "range", min: 60, max: 140, currency: "EUR" }, social: "either", advance: true },
  { key: "berlin-ai", week: 3, weekday: "sun", time: "11:00", minutes: 420, title: "AI Founders Summit — Sunday Programme", category: "tech", tags: ["AI", "founder", "conference", "hard-to-replicate"], venue: "Spree Halle", neighborhood: "Friedrichshain", destinationId: "berlin", city: "Berlin", country: "Germany", tz: "Europe/Berlin", description: "A day of talks and founder office hours on building AI companies in Europe.", price: { status: "known", min: 150, currency: "EUR" }, social: "meet_people", advance: true, deadlineDaysBefore: 10 },
  { key: "amsterdam-jazz", week: 4, weekday: "fri", time: "19:30", minutes: 210, title: "Jazz Festival Weekend: Late Sets", category: "music", tags: ["jazz", "festival", "one-off"], venue: "Havenhuis", neighborhood: "Noord", destinationId: "amsterdam", city: "Amsterdam", country: "Netherlands", tz: "Europe/Amsterdam", description: "Opening night of a waterside jazz weekend with late sets across three stages.", price: { status: "known", min: 45, currency: "EUR" }, social: "friends" },
  { key: "milan-design", week: 3, weekday: "sat", time: "18:00", minutes: 240, title: "Design Week Opening Night & Studio Tours", category: "art", tags: ["design", "exhibition", "one-off", "hard-to-replicate"], venue: "Fondazione Corte", neighborhood: "Brera", destinationId: "milan", city: "Milan", country: "Italy", tz: "Europe/Rome", description: "Open studios and an opening reception across Brera's design houses.", price: { status: "unknown", currency: "EUR" }, social: "either" },
  { key: "lisbon-fado", week: 5, weekday: "sat", time: "20:00", minutes: 150, title: "Fado & Food Evening in Alfama", category: "food", tags: ["fado", "music", "food", "hard-to-replicate"], venue: "Casa do Miradouro", neighborhood: "Alfama", destinationId: "lisbon", city: "Lisbon", country: "Portugal", tz: "Europe/Lisbon", description: "A long dinner punctuated by fado sets from three singers.", price: { status: "known", min: 55, currency: "EUR" }, social: "friends" },
  { key: "vienna-bruckner", week: 6, weekday: "sat", time: "19:30", minutes: 100, title: "Philharmonic Evening: Bruckner's Seventh", category: "music", tags: ["classical", "orchestra", "symphony", "hard-to-replicate"], venue: "Musikhalle am Ring", neighborhood: "Innere Stadt", destinationId: "vienna", city: "Vienna", country: "Austria", tz: "Europe/Vienna", description: "Bruckner's Symphony No. 7 in a golden-era concert hall.", price: { status: "range", min: 50, max: 180, currency: "EUR" }, social: "either", advance: true, deadlineDaysBefore: 21 },
  { key: "antwerp-rubens", week: 2, weekday: "thu", time: "19:00", minutes: 150, title: "Late Opening: Rubens & the Flemish Masters", category: "art", tags: ["exhibition", "old masters", "hard-to-replicate"], venue: "Stadsmuseum", neighborhood: "Centrum", destinationId: "antwerp", city: "Antwerp", country: "Belgium", tz: "Europe/Brussels", description: "An evening viewing of a major Flemish Baroque exhibition.", price: { status: "known", min: 25, currency: "EUR" }, social: "solo" },
];

function materialize(def: DemoDef, weekStart: string, sourceId: string, now: number): CuratorEvent {
  const date = addDays(weekStart, def.week * 7 + WEEKDAY_INDEX[def.weekday]);
  const tz = def.tz ?? "Europe/London";
  const start = zonedToEpoch(date, def.time, tz);
  const end = def.minutes === null ? null : start + def.minutes * MINUTE;
  const currency = def.price.currency ?? "GBP";
  return {
    id: `demo-${def.key}`,
    title: def.title,
    description: def.description,
    category: def.category,
    tags: def.tags,
    venue: {
      name: def.venue,
      address: null,
      neighborhood: def.neighborhood,
      city: def.city ?? "London",
      country: def.country ?? "United Kingdom",
      area: def.area ?? null,
    },
    start: new Date(start).toISOString(),
    end: end === null ? null : new Date(end).toISOString(),
    timezone: tz,
    price: {
      status: def.price.status,
      min: def.price.min ?? null,
      max: def.price.max ?? def.price.min ?? null,
      currency,
      includesFees: null,
    },
    officialUrl: null,
    bookingUrl: null,
    organizer: null,
    eligibility: def.eligibility ?? "public",
    dressCode: def.dressCode ?? null,
    accessibility: null,
    verification: { status: "demo", lastVerifiedAt: null, sourceName: "Sample data (fictional)" },
    isDemo: true,
    socialFit: def.social ?? null,
    bookingDeadline: def.deadlineDaysBefore ? new Date(start - def.deadlineDaysBefore * 86_400_000).toISOString() : null,
    advancePlanning: def.advance ?? false,
    destinationId: def.destinationId ?? null,
    occurrenceGroupId: def.group ?? null,
    sourceRecords: [{ sourceId, externalId: def.key, url: null, lastSeenAt: new Date(now).toISOString() }],
  };
}

function demoAdapter(id: string, name: string, pick: (d: DemoDef) => boolean): EventSourceAdapter {
  return {
    id,
    name,
    kind: "demo",
    isDemo: true,
    async fetchEvents(range: SourceRange, now: number) {
      const weekStart = startOfWeek(localDate(now, "Europe/London"));
      return DEMO_DEFS.filter(pick)
        .map((d) => materialize(d, weekStart, id, now))
        .filter((e) => {
          const t = Date.parse(e.start);
          return t >= range.from && t <= range.to;
        });
    },
  };
}

export const demoSources: EventSourceAdapter[] = [
  demoAdapter("demo-primary", "Sample feed A (fictional)", () => true),
  demoAdapter("demo-secondary", "Sample feed B (fictional)", (d) => d.duplicateFromSecondFeed === true),
];
