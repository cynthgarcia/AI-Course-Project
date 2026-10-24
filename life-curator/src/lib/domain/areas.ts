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

/** Approximate area centres, used to place venues from their coordinates. */
const CENTRES: Record<Exclude<AreaId, "outer_london">, [number, number]> = {
  soho: [51.5136, -0.1365],
  covent_garden: [51.5117, -0.124],
  fitzrovia: [51.52, -0.138],
  west_end: [51.5101, -0.134],
  south_bank: [51.5055, -0.116],
  city: [51.5155, -0.0922],
  shoreditch: [51.5265, -0.078],
  chelsea: [51.4875, -0.1687],
  fulham: [51.4753, -0.2011],
  kensington: [51.499, -0.1938],
  camden: [51.539, -0.1426],
  greenwich: [51.4826, -0.0077],
};

const CHARING_CROSS: [number, number] = [51.5073, -0.1276];

export function distanceKm([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Nearest known area within 2.5 km; elsewhere inside Greater London is "outer_london"; otherwise null. */
export function areaFromCoordinates(lat: number, lon: number): AreaId | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best: { area: AreaId; d: number } | null = null;
  for (const [area, c] of Object.entries(CENTRES) as [AreaId, [number, number]][]) {
    const d = distanceKm([lat, lon], c);
    if (!best || d < best.d) best = { area, d };
  }
  if (best && best.d <= 2.5) return best.area;
  return distanceKm([lat, lon], CHARING_CROSS) <= 25 ? "outer_london" : null;
}
