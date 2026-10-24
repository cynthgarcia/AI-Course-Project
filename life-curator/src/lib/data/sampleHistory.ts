// SAMPLE history for static previews only — fictional, marked source "sample", never
// used for learning, and the server refuses to store it.
import type { Category, Experience, WithWhom } from "@/lib/domain/types";

type Row = [string, string, Category, number | null, string, WithWhom | null, number | null, boolean, string[]];

const ROWS: Row[] = [
  ["2025-01-18", "Late-night jazz trio", "music", 5, "Soho", "friends", 25, false, ["jazz", "live music"]],
  ["2025-02-07", "Chamber orchestra by candlelight", "music", 4, "Covent Garden", "solo", 38, false, ["classical", "orchestra"]],
  ["2025-02-22", "Pottery wheel taster", "creative", 5, "Fulham", "friends", 45, true, ["pottery", "beginner-friendly"]],
  ["2025-03-13", "AI founders meetup", "tech", 4, "Fitzrovia", "new_people", 0, false, ["AI", "founder"]],
  ["2025-04-05", "Padel social mixer", "sports", 3, "Chelsea", "new_people", 22, true, ["padel", "social sport"]],
  ["2025-05-17", "Revival musical, West End", "theatre", 5, "West End", "friends", 85, false, ["musical theatre"]],
  ["2025-06-14", "Photography gallery opening", "art", 4, "South Bank", "solo", 0, false, ["photography", "opening"]],
  ["2025-07-04", "Weekend in Lisbon: fado night", "food", 5, "Lisbon", "friends", 60, true, ["fado", "music"]],
  ["2025-09-20", "Poetry open evening", "literature", 3, "Covent Garden", "solo", 8, false, ["poetry"]],
  ["2025-10-11", "Angel investing 101", "investing", 4, "Soho", "new_people", 15, true, ["angel", "education"]],
  ["2025-11-29", "Charity winter gala", "social", 4, "Mayfair", "friends", 95, false, ["gala", "charity"]],
  ["2025-12-13", "Choral carols & mass", "faith", 5, "West End", null, 0, false, ["choral", "community"]],
  ["2026-01-24", "Symphony: Mahler's Fifth", "music", 5, "South Bank", "solo", 55, false, ["classical", "orchestra"]],
  ["2026-03-08", "Reformer Pilates intro", "sports", 2, "Fulham", "solo", 28, true, ["pilates"]],
  ["2026-04-18", "Improv acting taster", "creative", 4, "Covent Garden", "new_people", 25, true, ["acting", "improv"]],
  ["2026-06-06", "Jazz & soul supper club", "music", 4, "Soho", "friends", 35, false, ["jazz", "dinner"]],
];

const CITIES = new Set(["Lisbon"]);

export function sampleHistory(): Experience[] {
  return ROWS.map(([date, title, category, rating, place, withWhom, cost, wasNew, tags], i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    eventId: null,
    title: `${title} (sample)`,
    category,
    tags,
    venueName: null,
    neighborhood: CITIES.has(place) ? null : place,
    city: CITIES.has(place) ? place : "London",
    date,
    rating,
    cost: cost === null ? null : { amount: cost, currency: "GBP", basis: "sample" },
    withWhom,
    wasNew,
    notes: "",
    source: "sample",
    createdAt: `${date}T22:00:00.000Z`,
    updatedAt: `${date}T22:00:00.000Z`,
  }));
}
