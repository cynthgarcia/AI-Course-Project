// Shared helpers for turning external records into CuratorEvents.
import { areaFromCoordinates } from "@/lib/domain/areas";
import { canonicalUrl } from "@/lib/domain/dedupe";
import { DESTINATIONS } from "@/lib/domain/destinations";
import type { AreaId, CuratorEvent, Price } from "@/lib/domain/types";

/** Only http(s) URLs survive; anything else becomes null. */
export function safeUrl(url: unknown): string | null {
  return typeof url === "string" && url.length < 2000 && canonicalUrl(url) ? url : null;
}

/** Plain text only: strips tags and collapses whitespace from untrusted descriptions. */
export function plainText(html: unknown, max = 1200): string {
  if (typeof html !== "string") return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function destinationForCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const c = city.trim().toLowerCase();
  return DESTINATIONS.find((d) => d.city.toLowerCase() === c)?.id ?? null;
}

export function locate(city: string | null, lat: number | null, lon: number | null): { area: AreaId | null; isLondon: boolean; destinationId: string | null } {
  const area = lat !== null && lon !== null ? areaFromCoordinates(lat, lon) : null;
  const isLondon = area !== null || (city ?? "").trim().toLowerCase() === "london";
  return { area, isLondon, destinationId: isLondon ? null : destinationForCity(city) };
}

export function price(min: number | null | undefined, max: number | null | undefined, currency: string | null | undefined, free = false): Price {
  const cur = typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? currency : "GBP";
  if (free) return { status: "free", min: null, max: null, currency: cur, includesFees: null };
  const lo = typeof min === "number" && Number.isFinite(min) && min >= 0 ? min : null;
  const hi = typeof max === "number" && Number.isFinite(max) && max >= 0 ? max : lo;
  if (lo === null) return { status: "unknown", min: null, max: null, currency: cur, includesFees: null };
  return { status: hi !== null && hi > lo ? "range" : "known", min: lo, max: hi, currency: cur, includesFees: null };
}

/** Fills the fields every external event shares. */
export function externalEvent(e: Omit<CuratorEvent, "isDemo" | "occurrenceGroupId" | "advancePlanning" | "bookingDeadline" | "dressCode" | "accessibility"> & Partial<CuratorEvent>): CuratorEvent {
  return {
    dressCode: null,
    accessibility: null,
    bookingDeadline: null,
    advancePlanning: false,
    occurrenceGroupId: null,
    isDemo: false,
    ...e,
  };
}
