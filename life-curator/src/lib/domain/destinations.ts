// Reference routes from London. Durations are typical scheduled journey times for
// planning only — they are NOT live timetables or fares, and the UI says so.
// No fares or hotel prices are stored here: those must come from current research.

export type TravelMode = "rail" | "air";

export interface RouteRef {
  mode: TravelMode;
  from: string;
  to: string;
  /** Typical in-vehicle time in minutes. */
  typicalMinutes: number;
  direct: boolean;
  note: string | null;
}

export interface Destination {
  id: string;
  city: string;
  country: string;
  timezone: string;
  routes: RouteRef[];
  researchLinks: { label: string; url: string }[];
}

const LONDON_AIRPORTS = "a London airport (Heathrow, Gatwick, City, Stansted or Luton — check which serve this route)";

function air(to: string, typicalMinutes: number): RouteRef {
  return { mode: "air", from: LONDON_AIRPORTS, to, typicalMinutes, direct: true, note: null };
}

const RAIL_RESEARCH = { label: "Eurostar (official)", url: "https://www.eurostar.com/" };
const FLIGHT_RESEARCH = { label: "Google Flights", url: "https://www.google.com/travel/flights" };
const HOTEL_RESEARCH = { label: "Google Hotels", url: "https://www.google.com/travel/hotels" };

export const DESTINATIONS: Destination[] = [
  {
    id: "paris",
    city: "Paris",
    country: "France",
    timezone: "Europe/Paris",
    routes: [
      { mode: "rail", from: "London St Pancras International", to: "Paris Gare du Nord", typicalMinutes: 140, direct: true, note: null },
    ],
    researchLinks: [RAIL_RESEARCH, HOTEL_RESEARCH],
  },
  {
    id: "brussels",
    city: "Brussels",
    country: "Belgium",
    timezone: "Europe/Brussels",
    routes: [
      { mode: "rail", from: "London St Pancras International", to: "Brussels-Midi", typicalMinutes: 120, direct: true, note: null },
    ],
    researchLinks: [RAIL_RESEARCH, HOTEL_RESEARCH],
  },
  {
    id: "antwerp",
    city: "Antwerp",
    country: "Belgium",
    timezone: "Europe/Brussels",
    routes: [
      { mode: "rail", from: "London St Pancras International", to: "Antwerpen-Centraal", typicalMinutes: 185, direct: false, note: "Typically a change at Brussels." },
    ],
    researchLinks: [RAIL_RESEARCH, HOTEL_RESEARCH],
  },
  {
    id: "amsterdam",
    city: "Amsterdam",
    country: "Netherlands",
    timezone: "Europe/Amsterdam",
    routes: [
      { mode: "rail", from: "London St Pancras International", to: "Amsterdam Centraal", typicalMinutes: 240, direct: true, note: null },
      air("Amsterdam Schiphol", 75),
    ],
    researchLinks: [RAIL_RESEARCH, FLIGHT_RESEARCH, HOTEL_RESEARCH],
  },
  { id: "berlin", city: "Berlin", country: "Germany", timezone: "Europe/Berlin", routes: [air("Berlin Brandenburg", 110)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "copenhagen", city: "Copenhagen", country: "Denmark", timezone: "Europe/Copenhagen", routes: [air("Copenhagen Airport", 115)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "lisbon", city: "Lisbon", country: "Portugal", timezone: "Europe/Lisbon", routes: [air("Lisbon Humberto Delgado", 165)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "porto", city: "Porto", country: "Portugal", timezone: "Europe/Lisbon", routes: [air("Porto Francisco Sá Carneiro", 140)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "madrid", city: "Madrid", country: "Spain", timezone: "Europe/Madrid", routes: [air("Madrid-Barajas", 140)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "barcelona", city: "Barcelona", country: "Spain", timezone: "Europe/Madrid", routes: [air("Barcelona-El Prat", 130)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "milan", city: "Milan", country: "Italy", timezone: "Europe/Rome", routes: [air("Milan Linate or Malpensa", 115)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "rome", city: "Rome", country: "Italy", timezone: "Europe/Rome", routes: [air("Rome Fiumicino", 155)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "vienna", city: "Vienna", country: "Austria", timezone: "Europe/Vienna", routes: [air("Vienna International", 135)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "prague", city: "Prague", country: "Czechia", timezone: "Europe/Prague", routes: [air("Prague Václav Havel", 115)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
  { id: "munich", city: "Munich", country: "Germany", timezone: "Europe/Berlin", routes: [air("Munich Airport", 110)], researchLinks: [FLIGHT_RESEARCH, HOTEL_RESEARCH] },
];

export function getDestination(id: string | null): Destination | null {
  return DESTINATIONS.find((d) => d.id === id) ?? null;
}

/** Planning allowances around the journey itself (door → terminal, check-in, terminal → venue). */
export const TRANSFER_ALLOWANCES: Record<TravelMode, { beforeDeparture: number; afterArrival: number }> = {
  rail: { beforeDeparture: 90, afterArrival: 25 },
  air: { beforeDeparture: 165, afterArrival: 55 },
};
