// Ticketmaster Discovery API (official, free key: developer.ticketmaster.com).
// Reads public event listings only. Ticket availability is never claimed — the event
// page on Ticketmaster is the source of truth.
import { zonedToEpoch } from "@/lib/domain/time";
import type { Category, CuratorEvent } from "@/lib/domain/types";
import { classify, inferTags } from "./classify";
import { externalEvent, locate, plainText, price, safeUrl } from "./normalize";
import type { EventSourceAdapter, SourceRange } from "./types";

const BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

interface TmEvent {
  id: string;
  name: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string }; end?: { dateTime?: string }; timezone?: string; status?: { code?: string } };
  classifications?: { segment?: { name?: string }; genre?: { name?: string }; subGenre?: { name?: string } }[];
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  promoter?: { name?: string };
  accessibility?: { info?: string };
  _embedded?: {
    venues?: { name?: string; address?: { line1?: string }; city?: { name?: string }; country?: { name?: string }; location?: { latitude?: string; longitude?: string }; timezone?: string }[];
  };
}

const SEGMENTS: Record<string, Category> = { Music: "music", Sports: "sports", Film: "film" };

function category(e: TmEvent): Category {
  const c = e.classifications?.[0];
  const seg = c?.segment?.name ?? "";
  const genre = `${c?.genre?.name ?? ""} ${c?.subGenre?.name ?? ""}`;
  if (seg === "Arts & Theatre") {
    if (/fine art|visual/i.test(genre)) return "art";
    if (/comedy/i.test(genre)) return "theatre";
    return "theatre";
  }
  return SEGMENTS[seg] ?? classify(`${e.name} ${genre}`);
}

export function normalizeTicketmaster(e: TmEvent, fetchedAt: string): CuratorEvent | null {
  const v0 = e._embedded?.venues?.[0];
  const tz = e.dates?.timezone ?? v0?.timezone ?? null;
  const ds = e.dates?.start;
  // Prefer the exact UTC time; otherwise convert the local date and time in the venue's timezone.
  const start =
    ds?.dateTime ??
    (ds?.localDate && ds.localTime && tz ? new Date(zonedToEpoch(ds.localDate, ds.localTime.slice(0, 5), tz)).toISOString() : undefined);
  if (!e.id || !e.name || !start || Number.isNaN(Date.parse(start))) return null; // no time = can't schedule honestly
  if (e.dates?.status?.code === "cancelled" || e.dates?.status?.code === "postponed") return null;
  const v = e._embedded?.venues?.[0];
  const lat = v?.location?.latitude ? Number(v.location.latitude) : null;
  const lon = v?.location?.longitude ? Number(v.location.longitude) : null;
  const where = locate(v?.city?.name ?? null, lat, lon);
  const pr = e.priceRanges?.[0];
  const c = e.classifications?.[0];
  const url = safeUrl(e.url);
  return externalEvent({
    id: `tm-${e.id}`,
    title: e.name.slice(0, 200),
    description: plainText([e.info, e.pleaseNote].filter(Boolean).join("\n\n")),
    category: category(e),
    tags: inferTags(`${e.name} ${c?.genre?.name ?? ""} ${c?.subGenre?.name ?? ""}`, [c?.genre?.name ?? "", c?.subGenre?.name ?? ""].filter((t) => t && t !== "Undefined")),
    venue: {
      name: v?.name ?? "Venue not listed",
      address: v?.address?.line1 ?? null,
      neighborhood: null,
      city: where.isLondon ? "London" : v?.city?.name ?? "Unknown",
      country: v?.country?.name ?? "Unknown",
      area: where.area,
    },
    start: new Date(start).toISOString(),
    end: e.dates?.end?.dateTime ? new Date(e.dates.end.dateTime).toISOString() : null,
    timezone: tz ?? "Europe/London",
    price: price(pr?.min, pr?.max, pr?.currency),
    officialUrl: url,
    bookingUrl: url,
    organizer: e.promoter?.name ?? null,
    eligibility: "public",
    accessibility: e.accessibility?.info ? plainText(e.accessibility.info, 400) : null,
    verification: { status: "verified", lastVerifiedAt: fetchedAt, sourceName: "Ticketmaster" },
    socialFit: null,
    destinationId: where.destinationId,
    sourceRecords: [{ sourceId: "ticketmaster", externalId: e.id, url, lastSeenAt: fetchedAt }],
  });
}

type Fetch = typeof fetch;

export function ticketmasterAdapter(apiKey: string, cities: { city: string; countryCode: string }[] = [], fetchImpl: Fetch = fetch): EventSourceAdapter {
  const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    id: "ticketmaster",
    name: "Ticketmaster",
    kind: "api",
    isDemo: false,
    async fetchEvents(range: SourceRange, now: number) {
      const fetchedAt = new Date(now).toISOString();
      const queries = [
        { latlong: "51.5073,-0.1276", radius: "15", unit: "miles" },
        ...cities.map((c) => ({ city: c.city, countryCode: c.countryCode })),
      ];
      const out: CuratorEvent[] = [];
      for (const q of queries) {
        const params = new URLSearchParams({ apikey: apiKey, size: "100", sort: "date,asc", startDateTime: iso(Math.max(range.from, now)), endDateTime: iso(range.to), ...q });
        const res = await fetchImpl(`${BASE}?${params}`, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`Ticketmaster responded ${res.status}`); // status only, never the key
        const body = (await res.json()) as { _embedded?: { events?: TmEvent[] } };
        for (const e of body._embedded?.events ?? []) {
          const ev = normalizeTicketmaster(e, fetchedAt);
          if (ev) out.push(ev);
        }
      }
      return out;
    },
  };
}
