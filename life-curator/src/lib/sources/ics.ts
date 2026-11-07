// Minimal, strict iCalendar (RFC 5545) reader for public calendar feeds (Luma, Meetup,
// venue calendars). Only timed, single (non-recurring), confirmed events are used —
// anything we can't place precisely in time is skipped rather than guessed.
import { zonedToEpoch } from "@/lib/domain/time";
import type { CuratorEvent } from "@/lib/domain/types";
import { classify, inferTags } from "./classify";
import { destinationForCity, externalEvent, locate, plainText, price, safeUrl } from "./normalize";
import { DESTINATIONS, getDestination } from "@/lib/domain/destinations";

interface Prop {
  value: string;
  params: Record<string, string>;
}

export interface IcsEvent {
  uid: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  url: string | null;
  start: number | null;
  end: number | null;
  status: string | null;
  recurring: boolean;
  geo: [number, number] | null;
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function parseLine(line: string): [string, Prop] | null {
  // NAME;PARAM=value;PARAM="quoted:value":VALUE
  let i = 0;
  let inQuotes = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ":" && !inQuotes) break;
  }
  if (i >= line.length) return null;
  const [name, ...paramParts] = line.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const [k, ...v] = p.split("=");
    if (k) params[k.toUpperCase()] = v.join("=").replace(/^"|"$/g, "");
  }
  return [name!.toUpperCase(), { value: line.slice(i + 1), params }];
}

function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Parses DTSTART/DTEND. Returns null for all-day dates or unknown timezones. */
export function parseIcsTime(p: Prop | undefined, calendarTz: string | null): number | null {
  if (!p || p.params.VALUE === "DATE") return null;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(p.value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (z) return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  const tz = p.params.TZID ?? calendarTz;
  if (!tz || !validTimeZone(tz)) return null;
  return zonedToEpoch(`${y}-${mo}-${d}`, `${h}:${mi}`, tz);
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n|\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const calTz = lines.find((l) => l.startsWith("X-WR-TIMEZONE:"))?.slice(14).trim() ?? null;
  const events: IcsEvent[] = [];
  let cur: Map<string, Prop> | null = null;
  let depth = 0;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = new Map();
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("BEGIN:")) depth++;
    else if (line.startsWith("END:") && line !== "END:VEVENT") depth--;
    else if (line === "END:VEVENT") {
      const geo = cur.get("GEO")?.value.split(";").map(Number);
      events.push({
        uid: cur.get("UID")?.value ?? null,
        summary: cur.has("SUMMARY") ? unescapeText(cur.get("SUMMARY")!.value) : null,
        description: cur.has("DESCRIPTION") ? unescapeText(cur.get("DESCRIPTION")!.value) : null,
        location: cur.has("LOCATION") ? unescapeText(cur.get("LOCATION")!.value) : null,
        url: cur.get("URL")?.value ?? null,
        start: parseIcsTime(cur.get("DTSTART"), calTz),
        end: parseIcsTime(cur.get("DTEND"), calTz),
        status: cur.get("STATUS")?.value.toUpperCase() ?? null,
        recurring: cur.has("RRULE") || cur.has("RECURRENCE-ID"),
        geo: geo && geo.length === 2 && geo.every(Number.isFinite) ? [geo[0]!, geo[1]!] : null,
      });
      cur = null;
      continue;
    } else if (depth === 0) {
      const parsed = parseLine(line);
      if (parsed && !cur.has(parsed[0])) cur.set(parsed[0], parsed[1]);
    }
  }
  return events;
}

/** Turns feed entries into events. `feedName` is shown as the source. */
export function icsToEvents(text: string, feed: { id: string; name: string }, fetchedAt: string, range: { from: number; to: number }): CuratorEvent[] {
  const out: CuratorEvent[] = [];
  for (const e of parseIcs(text)) {
    if (!e.summary || e.start === null || e.recurring || e.status === "CANCELLED") continue;
    if (e.start < range.from || e.start > range.to) continue;
    const location = e.location ?? "";
    // Online-only events have nowhere to go; this app is about getting out.
    if (/^(online|zoom|virtual|google meet|teams)\b/i.test(location.trim()) || /^https?:\/\//i.test(location.trim())) continue;
    // Feeds are London-focused unless the location names one of the European destinations.
    const dest = DESTINATIONS.find((d) => new RegExp(`\\b${d.city}\\b`, "i").test(location));
    const where = locate(dest ? dest.city : "London", e.geo?.[0] ?? null, e.geo?.[1] ?? null);
    const text = `${e.summary} ${e.description ?? ""}`;
    const descUrl = (e.description ?? "").match(/https?:\/\/\S+/)?.[0];
    const url = safeUrl(e.url) ?? safeUrl(descUrl);
    out.push(
      externalEvent({
        id: `${feed.id}-${(e.uid ?? `${e.summary}-${e.start}`).replace(/[^A-Za-z0-9_.@-]/g, "").slice(0, 80)}`,
        title: plainText(e.summary, 200),
        description: plainText(e.description ?? ""),
        category: classify(text),
        tags: inferTags(text),
        venue: {
          name: plainText(location.split(",")[0] ?? "", 200) || "Venue not listed",
          address: plainText(location, 300) || null,
          neighborhood: null,
          city: dest ? dest.city : "London",
          country: dest ? dest.country : "United Kingdom",
          area: dest ? null : where.area,
        },
        start: new Date(e.start).toISOString(),
        end: e.end !== null && e.end > e.start ? new Date(e.end).toISOString() : null,
        timezone: dest ? getDestination(dest.id)!.timezone : "Europe/London",
        price: price(null, null, "GBP"),
        officialUrl: url,
        bookingUrl: url,
        organizer: feed.name,
        eligibility: "public",
        verification: { status: "verified", lastVerifiedAt: fetchedAt, sourceName: feed.name },
        socialFit: null,
        destinationId: dest ? destinationForCity(dest.city) : null,
        sourceRecords: [{ sourceId: feed.id, externalId: e.uid, url, lastSeenAt: fetchedAt }],
      }),
    );
  }
  return out;
}
