// Server-only adapters that fetch public URLs configured by whoever runs the app:
// calendar feeds (iCal) and venue "what's on" pages with schema.org event data.
import { icsToEvents } from "@/lib/sources/ics";
import type { EventSourceAdapter } from "@/lib/sources/types";
import { eventsFromPage, fetchText } from "./importEvent";
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
