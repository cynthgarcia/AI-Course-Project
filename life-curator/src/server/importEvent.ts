// "Add from a link": fetches ONE page the user pasted and reads the schema.org Event data
// that many event sites publish for search engines. User-initiated, single page, no crawling.
// Guards against server-side request forgery: https only, public IPs only (checked on
// every redirect), short timeout and size cap.
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

export async function fetchPage(raw: string, fetchImpl: typeof fetch = fetch, resolve: typeof lookup = lookup): Promise<{ url: string; html: string }> {
  let url = await assertPublicUrl(raw, resolve);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "YourLifeCurator/1.0 (single page, user-requested)" },
    }).catch(() => {
      throw new ImportError("That page couldn't be reached.");
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString(), resolve);
      continue;
    }
    if (!res.ok) throw new ImportError(`That page returned an error (${res.status}).`);
    if (!/html/i.test(res.headers.get("content-type") ?? "")) throw new ImportError("That link isn't a web page.");
    const reader = res.body?.getReader();
    if (!reader) throw new ImportError("That page was empty.");
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
    return { url: url.toString(), html: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
  throw new ImportError("That link redirected too many times.");
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

/** Builds a draft event from the page's structured data; the user reviews it before saving. */
export function parseEventPage(html: string, pageUrl: string, now = Date.now()): CuratorEvent {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1] ?? "");
  let ev: Json | null = null;
  for (const b of blocks) {
    try {
      for (const node of walk(JSON.parse(b.trim()))) if (isEventType(node["@type"])) { ev = node; break; }
    } catch {
      // ignore malformed blocks
    }
    if (ev) break;
  }
  if (!ev) throw new ImportError("This page doesn't publish event details in a way apps can read. Add it by hand instead.");

  const name = plainText(str(ev.name), 200);
  const start = str(ev.startDate);
  if (!name || !start || Number.isNaN(Date.parse(start))) throw new ImportError("The page is missing the event's name or start time. Add it by hand instead.");
  const loc = (Array.isArray(ev.location) ? ev.location[0] : ev.location) as Json | undefined;
  const addr = (loc?.address ?? {}) as Json | string;
  const address = typeof addr === "string" ? addr : [str(addr.streetAddress), str(addr.addressLocality), str(addr.postalCode)].filter(Boolean).join(", ") || null;
  const city = typeof addr === "string" ? null : str(addr.addressLocality);
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
  const official = safeUrl(str(ev.url) ?? pageUrl) ?? pageUrl;
  const organizer = ev.organizer && typeof ev.organizer === "object" ? str((ev.organizer as Json).name) : null;
  const text = `${name} ${description}`;
  const startIso = new Date(start).toISOString();
  return {
    id: `user-${crypto.randomUUID()}`,
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
    end: str(ev.endDate) && !Number.isNaN(Date.parse(str(ev.endDate)!)) ? new Date(str(ev.endDate)!).toISOString() : null,
    // schema.org dates carry an offset, so the instant is exact; display uses the destination's zone when known.
    timezone: getDestination(where.destinationId)?.timezone ?? "Europe/London",
    price: prices.length ? price(Math.min(...prices), highs.length ? Math.max(...highs) : null, currency, Math.max(...prices) === 0) : price(null, null, currency),
    officialUrl: official,
    bookingUrl: safeUrl(str(offers[0]?.url)) ?? official,
    organizer,
    eligibility: "unknown",
    dressCode: null,
    accessibility: null,
    verification: { status: "unverified", lastVerifiedAt: new Date(now).toISOString(), sourceName: `Imported from ${host}` },
    isDemo: false,
    socialFit: null,
    bookingDeadline: null,
    advancePlanning: false,
    destinationId: where.destinationId,
    occurrenceGroupId: null,
    sourceRecords: [{ sourceId: "user-import", externalId: null, url: official, lastSeenAt: new Date(now).toISOString() }],
    accessNote: null,
    addedByUser: true,
  };
}
