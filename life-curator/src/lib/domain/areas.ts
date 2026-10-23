// Approximate door-to-door public transport / walking times between London areas.
// These are coarse planning estimates, not live journey data, and the UI labels them so.
import type { AreaId } from "./types";

export const AREA_LABELS: Record<AreaId, string> = {
  soho: "Soho",
  covent_garden: "Covent Garden",
  fitzrovia: "Fitzrovia",
  west_end: "West End",
  south_bank: "South Bank",
  city: "City of London",
  shoreditch: "Shoreditch",
  chelsea: "Chelsea",
  fulham: "Fulham / Parsons Green",
  kensington: "Kensington",
  camden: "Camden",
  greenwich: "Greenwich",
  outer_london: "Outer London",
};

/** Priority neighbourhoods from the user profile; used as a mild ranking boost only. */
export const PRIORITY_AREAS: AreaId[] = [
  "soho",
  "covent_garden",
  "fitzrovia",
  "west_end",
  "south_bank",
  "chelsea",
  "fulham",
];

type Zone = "core" | "inner_west" | "inner_east" | "south_bank" | "north" | "far";

const ZONE: Record<AreaId, Zone> = {
  soho: "core",
  covent_garden: "core",
  fitzrovia: "core",
  west_end: "core",
  south_bank: "south_bank",
  city: "inner_east",
  shoreditch: "inner_east",
  chelsea: "inner_west",
  fulham: "inner_west",
  kensington: "inner_west",
  camden: "north",
  greenwich: "far",
  outer_london: "far",
};

const ZONE_MINUTES: Record<Zone, Record<Zone, number>> = {
  core: { core: 15, inner_west: 30, inner_east: 25, south_bank: 20, north: 20, far: 50 },
  inner_west: { core: 30, inner_west: 20, inner_east: 45, south_bank: 35, north: 40, far: 60 },
  inner_east: { core: 25, inner_west: 45, inner_east: 15, south_bank: 25, north: 30, far: 40 },
  south_bank: { core: 20, inner_west: 35, inner_east: 25, south_bank: 10, north: 35, far: 45 },
  north: { core: 20, inner_west: 40, inner_east: 30, south_bank: 35, north: 15, far: 55 },
  far: { core: 50, inner_west: 60, inner_east: 40, south_bank: 45, north: 55, far: 60 },
};

/** Fulham ↔ Fulham, Soho ↔ Soho etc. are walkable. */
const SAME_AREA_MINUTES = 10;

export function estimateTravelMinutes(from: AreaId, to: AreaId): number {
  if (from === to) return SAME_AREA_MINUTES;
  return ZONE_MINUTES[ZONE[from]][ZONE[to]];
}
