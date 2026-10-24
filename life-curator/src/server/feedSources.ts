// Server-only adapters that fetch public URLs configured by whoever runs the app:
// calendar feeds (iCal) and venue "what's on" pages with schema.org event data.
import { icsToEvents } from "@/lib/sources/ics";
import type { EventSourceAdapter } from "@/lib/sources/types";
import { eventsFromPage, fetchText, type FetchTextOptions } from "./importEvent";
import { robotsAllows } from "./robots";

export interface FeedConfig {
  id: string;
  name: string;
  url: string;
}

/** Parses "Name|https://…" entries separated by commas or new lines. */
export function parseFeedList(raw: string | undefined, prefix: string): FeedConfig[] {
  return (raw ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((entry, i) => {
      const [name, url] = entry.includes("|") ? (entry.split("|", 2) as [string, string]) : [new URL(entry).hostname.replace(/^www\./, ""), entry];
      return { id: `${prefix}${i + 1}`, name: name.trim().slice(0, 80), url: url.trim() };
    });
}

export function icsFeedAdapter(feed: FeedConfig, fetchImpl?: typeof fetch): EventSourceAdapter {
  return {
    id: feed.id,
    name: feed.name,
    kind: "ics",
    isDemo: false,
    async fetchEvents(range, now) {
      const res = await fetchText(feed.url, { accept: /calendar|text\/plain|octet-stream/i, acceptHeader: "text/calendar", fetchImpl });
      if (res.status >= 400 || !res.text.includes("BEGIN:VCALENDAR")) throw new Error(`${feed.name} feed unavailable`);
      return icsToEvents(res.text, feed, new Date(now).toISOString(), range);
    },
  };
}

export function venuePageAdapter(feed: FeedConfig, fetchImpl?: typeof fetch): EventSourceAdapter {
  return {
    id: feed.id,
    name: feed.name,
    kind: "venue_calendar",
    isDemo: false,
    async fetchEvents(range, now) {
      const url = new URL(feed.url);
      const robots = await fetchText(`${url.origin}/robots.txt`, { accept: /.*/, acceptHeader: "text/plain", fetchImpl });
      if (robots.status >= 500) throw new Error("robots.txt unavailable");
      if (robots.status < 400 && !robotsAllows(robots.text, url.pathname + url.search)) throw new Error(`${feed.name} asks automated tools not to read this page`);
      const page = await fetchText(feed.url, { fetchImpl });
      if (page.status >= 400) throw new Error(`${feed.name} returned ${page.status}`);
      return eventsFromPage(page.text, page.url, { now, mode: "source", sourceId: feed.id })
        .filter((e) => Date.parse(e.start) >= range.from && Date.parse(e.start) <= range.to)
        .map((e) => ({ ...e, verification: { ...e.verification, sourceName: feed.name } }));
    },
  };
}

const DETAIL_PATH = /\/(events?|whats-?on|performances?|concerts?|exhibitions?|productions?|shows?|talks?|films?|tickets?|calendar|programme)\//i;
const SKIP_PATH = /\.(jpe?g|png|gif|svg|webp|pdf|ics|css|js|xml)$|\/(login|account|basket|cart|checkout|search|membership|donate|shop|press)(\/|$)/i;

/** Same-site links that look like individual event pages, in page order. */
export function extractEventLinks(html: string, pageUrl: string, limit: number): string[] {
  const base = new URL(pageUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"'#]+)["']/gi)) {
    let u: URL;
    try {
      u = new URL(m[1]!, base);
    } catch {
      continue;
    }
    if (u.host !== base.host || (u.protocol !== "https:" && u.protocol !== "http:")) continue;
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    if (!path || path === basePath || SKIP_PATH.test(path) || /[?&](page|sort|filter|date)=/i.test(u.search)) continue;
    const deeper = basePath && path.startsWith(`${basePath}/`);
    if (!deeper && !DETAIL_PATH.test(`${path}/`)) continue;
    // Listing-style pages one level down (e.g. /whats-on/music) are fine too; event pages usually sit deeper.
    const key = u.origin + path;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u.toString().replace(/^http:/, "https:"));
    if (out.length >= limit) break;
  }
  return out;
}

async function robotsFor(origin: string, fetchImpl?: typeof fetch): Promise<(path: string) => boolean> {
  const res = await fetchText(`${origin}/robots.txt`, { accept: /.*/, acceptHeader: "text/plain", fetchImpl });
  if (res.status >= 500) throw new Error("robots.txt unavailable");
  if (res.status >= 400) return () => true;
  return (path) => robotsAllows(res.text, path);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CrawlOptions {
  maxPages?: number;
  delayMs?: number;
  budgetMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Reads a venue's "What's on" page and up to `maxPages` of its event pages, one at a time,
 * respecting robots.txt, and collects the schema.org events they publish. Runs in the
 * background once a day.
 */
export function venueCrawlAdapter(feed: FeedConfig, opts: CrawlOptions = {}): EventSourceAdapter {
  const { maxPages = 20, delayMs = 750, budgetMs = 40_000, fetchImpl } = opts;
  return {
    id: feed.id,
    name: feed.name,
    kind: "venue_calendar",
    isDemo: false,
    refreshHours: 20,
    backgroundOnly: true,
    async fetchEvents(range, now) {
      const started = Date.now();
      const listing = new URL(feed.url);
      const allowed = await robotsFor(listing.origin, fetchImpl);
      if (!allowed(listing.pathname + listing.search)) throw new Error(`${feed.name} asks automated tools not to read its listings`);
      const page = await fetchText(feed.url, { fetchImpl });
      if (page.status >= 400) throw new Error(`${feed.name} returned ${page.status}`);
      const found = new Map<string, import("@/lib/domain/types").CuratorEvent>();
      const add = (html: string, url: string) => {
        for (const e of eventsFromPage(html, url, { now, mode: "source", sourceId: feed.id })) {
          if (Date.parse(e.start) < range.from || Date.parse(e.start) > range.to) continue;
          found.set(e.id, { ...e, verification: { ...e.verification, sourceName: feed.name } });
        }
      };
      add(page.text, page.url);
      for (const link of extractEventLinks(page.text, page.url, maxPages)) {
        if (Date.now() - started > budgetMs) break;
        const u = new URL(link);
        if (!allowed(u.pathname + u.search)) continue;
        await sleep(delayMs);
        try {
          const detail = await fetchText(link, { fetchImpl });
          if (detail.status < 400) add(detail.text, detail.url);
        } catch {
          // One unreadable page doesn't stop the rest.
        }
      }
      return [...found.values()];
    },
  };
}

/**
 * Luma's public city feed (every public event Luma lists for a city), found from the
 * city's public page so nobody has to look up feed links. Luma offers these iCal
 * subscriptions for calendar apps.
 */
export function lumaCityAdapter(slug: string, name: string, fetchImpl?: typeof fetch, resolve?: FetchTextOptions["resolve"]): EventSourceAdapter {
  let feedUrl: string | null = null;
  return {
    id: `luma-${slug}`,
    name,
    kind: "ics",
    isDemo: false,
    refreshHours: 6,
    async fetchEvents(range, now) {
      if (!feedUrl) {
        const page = await fetchText(`https://lu.ma/${slug}`, { fetchImpl, resolve });
        const id = page.text.match(/discplace-[A-Za-z0-9]+/)?.[0];
        if (!id) throw new Error(`${name}: city feed not found`);
        feedUrl = `https://api.lu.ma/ics/get?entity=discover&id=${id}`;
      }
      const res = await fetchText(feedUrl, { accept: /calendar|text\/plain|octet-stream/i, acceptHeader: "text/calendar", fetchImpl, resolve });
      if (res.status >= 400 || !res.text.includes("BEGIN:VCALENDAR")) {
        feedUrl = null; // look it up again next time
        throw new Error(`${name} feed unavailable`);
      }
      return icsToEvents(res.text, { id: `luma-${slug}`, name }, new Date(now).toISOString(), range);
    },
  };
}
