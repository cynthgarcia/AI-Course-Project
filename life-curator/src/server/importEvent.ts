// "Add from a link": fetches ONE page the user pasted and reads the schema.org Event data
// that many event sites publish for search engines. User-initiated, single page, no crawling.
// Guards against server-side request forgery: https only, public IPs only (checked on
// every redirect), short timeout and size cap.
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { classify, inferTags } from "@/lib/sources/classify";
import { locate, plainText, price, safeUrl } from "@/lib/sources/normalize";
import { getDestination } from "@/lib/domain/destinations";
import type { CuratorEvent } from "@/lib/domain/types";

export class ImportError extends Error {}

const BLOCKED_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/i, "Instagram doesn't allow apps to read posts. Add the details by hand instead."],
  [/(^|\.)facebook\.com$/i, "Facebook pages need a login, so they can't be read. Add the details by hand instead."],
];

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("ff");
}

export async function assertPublicUrl(raw: string, resolve: typeof lookup = lookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError("That doesn't look like a web address.");
  }
  if (url.protocol !== "https:") throw new ImportError("Only https:// links can be imported.");
  if (url.username || url.password || (url.port && url.port !== "443")) throw new ImportError("That link can't be imported.");
  for (const [re, msg] of BLOCKED_HOSTS) if (re.test(url.hostname)) throw new ImportError(msg);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await resolve(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new ImportError("That website couldn't be found.");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new ImportError("That link can't be imported.");
  return url;
}

const MAX_BYTES = 1_500_000;

export interface FetchTextOptions {
  accept?: RegExp;
  fetchImpl?: typeof fetch;
  resolve?: typeof lookup;
  /** Sent as the Accept header. */
  acceptHeader?: string;
}

/** Fetches one public https resource with SSRF protection on every redirect hop. */
export async function fetchText(raw: string, opts: FetchTextOptions = {}): Promise<{ url: string; text: string; status: number }> {
  const { accept = /html/i, fetchImpl = fetch, resolve = lookup, acceptHeader = "text/html,application/xhtml+xml" } = opts;
  let url = await assertPublicUrl(raw, resolve);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: { accept: acceptHeader, "user-agent": "YourLifeCurator/1.0 (+event discovery; respects robots.txt)" },
    }).catch(() => {
      throw new ImportError("That page couldn't be reached.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString(), resolve);
      continue;
    }
    if (!res.ok) return { url: url.toString(), text: "", status: res.status };
    if (!accept.test(res.headers.get("content-type") ?? "")) throw new ImportError("That link isn't the expected kind of page.");
    const reader = res.body?.getReader();
    if (!reader) return { url: url.toString(), text: "", status: res.status };
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return { url: url.toString(), text: new TextDecoder().decode(Buffer.concat(chunks)), status: res.status };
  }
  throw new ImportError("That link redirected too many times.");
}

export async function fetchPage(raw: string, fetchImpl: typeof fetch = fetch, resolve: typeof lookup = lookup): Promise<{ url: string; html: string }> {
  const res = await fetchText(raw, { fetchImpl, resolve });
  if (res.status >= 400) throw new ImportError(`That page returned an error (${res.status}).`);
  if (!res.text) throw new ImportError("That page was empty.");
  return { url: res.url, html: res.text };
}

type Json = Record<string, unknown>;

function* walk(node: unknown): Generator<Json> {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (node && typeof node === "object") {
    const o = node as Json;
    yield o;
    if (o["@graph"]) yield* walk(o["@graph"]);
  }
}

const isEventType = (t: unknown) => (Array.isArray(t) ? t : [t]).some((x) => typeof x === "string" && /Event$/.test(x));
const str = (v: unknown) => (typeof v === "string" ? v : null);

function jsonLdEvents(html: string): Json[] {
  const out: Json[] = [];
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      for (const node of walk(JSON.parse((m[1] ?? "").trim()))) if (isEventType(node["@type"])) out.push(node);
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

export interface PageEventOptions {
  now?: number;
  /** "draft" = user import (unverified, private); "source" = a configured publisher page. */
  mode?: "draft" | "source";
  sourceId?: string;
}

/** Converts one schema.org Event node; null when it lacks a name or start time. */
export function eventFromJsonLd(ev: Json, pageUrl: string, opts: PageEventOptions = {}): CuratorEvent | null {
  const now = opts.now ?? Date.now();
  const mode = opts.mode ?? "draft";
  const name = plainText(str(ev.name), 200);
  const start = str(ev.startDate);
  // Date-only start times can't be scheduled honestly.
  if (!name || !start || !/T\d{2}:\d{2}/.test(start) || Number.isNaN(Date.parse(start))) return null;
  if (/Cancelled|Postponed/i.test(str(ev.eventStatus) ?? "")) return null;
  const loc = (Array.isArray(ev.location) ? ev.location[0] : ev.location) as Json | undefined;
  const addr = (loc?.address ?? {}) as Json | string;
  const address = typeof addr === "string" ? addr : [str(addr.streetAddress), str(addr.addressLocality), str(addr.postalCode)].filter(Boolean).join(", ") || null;
  const city = typeof addr === "string" ? (/london/i.test(addr) ? "London" : null) : str(addr.addressLocality);
  const geo = (loc?.geo ?? {}) as Json;
  const lat = geo.latitude !== undefined ? Number(geo.latitude) : null;
  const lon = geo.longitude !== undefined ? Number(geo.longitude) : null;
  const where = locate(city, lat, lon);
  const offers = (Array.isArray(ev.offers) ? ev.offers : ev.offers ? [ev.offers] : []) as Json[];
  const prices = offers.map((o) => Number(o.price ?? o.lowPrice)).filter((n) => Number.isFinite(n));
  const highs = offers.map((o) => Number(o.highPrice ?? o.price)).filter((n) => Number.isFinite(n));
  const currency = offers.map((o) => str(o.priceCurrency)).find(Boolean) ?? "GBP";
  const description = plainText(str(ev.description));
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  const official = safeUrl(str(ev.url) ? new URL(str(ev.url)!, pageUrl).toString() : pageUrl) ?? pageUrl;
  const organizer = ev.organizer && typeof ev.organizer === "object" ? str((ev.organizer as Json).name) : null;
  const text = `${name} ${description}`;
  const startIso = new Date(start).toISOString();
  const endRaw = str(ev.endDate);
  const id = mode === "draft" ? `user-${crypto.randomUUID()}` : `${opts.sourceId ?? "page"}-${createHash("sha1").update(`${official}|${startIso}|${name}`).digest("hex").slice(0, 16)}`;
  return {
    id,
    title: name,
    description,
    category: classify(text),
    tags: inferTags(text),
    venue: {
      name: plainText(str(loc?.name), 200) || "Venue not listed",
      address,
      neighborhood: null,
      city: where.isLondon ? "London" : city ?? "Unknown",
      country: typeof addr === "string" ? "Unknown" : str(addr.addressCountry) ?? "Unknown",
      area: where.area,
    },
    start: startIso,
    end: endRaw && /T\d{2}:\d{2}/.test(endRaw) && !Number.isNaN(Date.parse(endRaw)) ? new Date(endRaw).toISOString() : null,
    // schema.org dates carry an offset, so the instant is exact; display uses the destination's zone when known.
    timezone: getDestination(where.destinationId)?.timezone ?? "Europe/London",
    price: prices.length ? price(Math.min(...prices), highs.length ? Math.max(...highs) : null, currency, Math.max(...prices) === 0) : price(null, null, currency),
    officialUrl: official,
    bookingUrl: safeUrl(str(offers[0]?.url)) ?? official,
    organizer,
    eligibility: mode === "draft" ? "unknown" : "public",
    dressCode: null,
    accessibility: null,
    verification:
      mode === "draft"
        ? { status: "unverified", lastVerifiedAt: new Date(now).toISOString(), sourceName: `Imported from ${host}` }
        : { status: "verified", lastVerifiedAt: new Date(now).toISOString(), sourceName: host },
    isDemo: false,
    socialFit: null,
    bookingDeadline: null,
    advancePlanning: false,
    destinationId: where.destinationId,
    occurrenceGroupId: null,
    sourceRecords: [{ sourceId: mode === "draft" ? "user-import" : opts.sourceId ?? "page", externalId: null, url: official, lastSeenAt: new Date(now).toISOString() }],
    accessNote: null,
    addedByUser: mode === "draft",
  };
}

/** Every timed event on a page (used by configured venue pages). */
export function eventsFromPage(html: string, pageUrl: string, opts: PageEventOptions = {}): CuratorEvent[] {
  return jsonLdEvents(html)
    .map((n) => eventFromJsonLd(n, pageUrl, opts))
    .filter((e): e is CuratorEvent => e !== null);
}

/** Builds a draft event from the page's structured data; the user reviews it before saving. */
export function parseEventPage(html: string, pageUrl: string, now = Date.now()): CuratorEvent {
  const nodes = jsonLdEvents(html);
  if (!nodes.length) throw new ImportError("This page doesn't publish event details in a way apps can read. Add it by hand instead.");
  const ev = nodes.map((n) => eventFromJsonLd(n, pageUrl, { now })).find((e): e is CuratorEvent => e !== null);
  if (!ev) throw new ImportError("The page is missing the event's name or start time. Add it by hand instead.");
  return ev;
}
