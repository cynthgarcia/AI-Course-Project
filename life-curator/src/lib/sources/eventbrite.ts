// Eventbrite API. Eventbrite no longer offers public event search, so this reads the
// live events of specific organisers the user chooses to follow (by organiser ID).
import type { Category, CuratorEvent } from "@/lib/domain/types";
import { classify, inferTags } from "./classify";
import { externalEvent, locate, plainText, price, safeUrl } from "./normalize";
import type { EventSourceAdapter, SourceRange } from "./types";

interface EbEvent {
  id: string;
  name?: { text?: string };
  description?: { text?: string };
  summary?: string;
  url?: string;
  start?: { utc?: string; timezone?: string };
  end?: { utc?: string };
  is_free?: boolean;
  category_id?: string | null;
  online_event?: boolean;
  status?: string;
  ticket_availability?: { minimum_ticket_price?: { major_value?: string; currency?: string }; maximum_ticket_price?: { major_value?: string; currency?: string } };
  venue?: { name?: string; address?: { localized_address_display?: string; city?: string; country?: string; latitude?: string; longitude?: string } };
  organizer?: { name?: string };
}

// Eventbrite's documented top-level category IDs.
const CATEGORIES: Record<string, Category> = {
  "101": "investing",
  "102": "tech",
  "103": "music",
  "104": "film",
  "105": "theatre",
  "107": "wellness",
  "108": "sports",
  "110": "food",
  "111": "social",
  "113": "social",
  "114": "faith",
  "115": "creative",
  "119": "creative",
};

export function normalizeEventbrite(e: EbEvent, fetchedAt: string): CuratorEvent | null {
  const title = e.name?.text?.trim();
  if (!e.id || !title || !e.start?.utc || Number.isNaN(Date.parse(e.start.utc))) return null;
  if (e.status && e.status !== "live" && e.status !== "started") return null;
  const a = e.venue?.address;
  const lat = a?.latitude ? Number(a.latitude) : null;
  const lon = a?.longitude ? Number(a.longitude) : null;
  const where = locate(a?.city ?? null, lat, lon);
  const text = `${title} ${e.summary ?? ""}`;
  const lo = e.ticket_availability?.minimum_ticket_price;
  const hi = e.ticket_availability?.maximum_ticket_price;
  const url = safeUrl(e.url);
  return externalEvent({
    id: `eb-${e.id}`,
    title: title.slice(0, 200),
    description: plainText(e.description?.text ?? e.summary ?? ""),
    category: (e.category_id && CATEGORIES[e.category_id]) || classify(text),
    tags: inferTags(text),
    venue: {
      name: e.online_event ? "Online" : e.venue?.name ?? "Venue not listed",
      address: a?.localized_address_display ?? null,
      neighborhood: null,
      city: where.isLondon ? "London" : a?.city ?? (e.online_event ? "Online" : "Unknown"),
      country: a?.country ?? "Unknown",
      area: where.area,
    },
    start: new Date(e.start.utc).toISOString(),
    end: e.end?.utc ? new Date(e.end.utc).toISOString() : null,
    timezone: e.start.timezone ?? "Europe/London",
    price: price(lo?.major_value ? Number(lo.major_value) : null, hi?.major_value ? Number(hi.major_value) : null, lo?.currency, e.is_free === true),
    officialUrl: url,
    bookingUrl: url,
    organizer: e.organizer?.name ?? null,
    eligibility: "public",
    verification: { status: "verified", lastVerifiedAt: fetchedAt, sourceName: "Eventbrite" },
    socialFit: null,
    destinationId: where.destinationId,
    sourceRecords: [{ sourceId: "eventbrite", externalId: e.id, url, lastSeenAt: fetchedAt }],
  });
}

export function eventbriteAdapter(token: string, organizerIds: string[], fetchImpl: typeof fetch = fetch): EventSourceAdapter {
  return {
    id: "eventbrite",
    name: "Eventbrite (organisers you follow)",
    kind: "api",
    isDemo: false,
    async fetchEvents(range: SourceRange, now: number) {
      const fetchedAt = new Date(now).toISOString();
      const out: CuratorEvent[] = [];
      for (const id of organizerIds.filter((x) => /^\d{1,20}$/.test(x))) {
        const res = await fetchImpl(`https://www.eventbriteapi.com/v3/organizers/${id}/events/?status=live&order_by=start_asc&expand=venue,ticket_availability,organizer`, {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Eventbrite responded ${res.status}`);
        const body = (await res.json()) as { events?: EbEvent[] };
        for (const e of body.events ?? []) {
          const ev = normalizeEventbrite(e, fetchedAt);
          if (ev && Date.parse(ev.start) >= range.from && Date.parse(ev.start) <= range.to) out.push(ev);
        }
      }
      return out;
    },
  };
}
