// Which event sources are live, from server configuration. Keys never leave the server.
import { demoSources } from "@/lib/sources/demo";
import { eventbriteAdapter } from "@/lib/sources/eventbrite";
import { ticketmasterAdapter } from "@/lib/sources/ticketmaster";
import type { EventSourceAdapter } from "@/lib/sources/types";
import { CURATED_VENUES } from "./curatedSources";
import { scoutAdapter } from "./scout";
import { icsFeedAdapter, lumaCityAdapter, parseFeedList, venueCrawlAdapter, venuePageAdapter } from "./feedSources";

const COUNTRY: Record<string, string> = {
  paris: "FR", brussels: "BE", antwerp: "BE", amsterdam: "NL", berlin: "DE", munich: "DE", copenhagen: "DK",
  lisbon: "PT", porto: "PT", madrid: "ES", barcelona: "ES", milan: "IT", rome: "IT", vienna: "AT", prague: "CZ",
};

export interface SourceStatus {
  id: string;
  name: string;
  configured: boolean;
  note: string;
}

export function configuredSources(env: NodeJS.ProcessEnv = process.env): { sources: EventSourceAdapter[]; status: SourceStatus[] } {
  const sources: EventSourceAdapter[] = [];
  const tmKey = env.TICKETMASTER_API_KEY?.trim();
  if (tmKey) {
    const cities = env.TICKETMASTER_EUROPE === "0" ? [] : Object.entries(COUNTRY).map(([id, countryCode]) => ({ city: id[0]!.toUpperCase() + id.slice(1), countryCode }));
    sources.push(ticketmasterAdapter(tmKey, cities));
  }
  const ebToken = env.EVENTBRITE_TOKEN?.trim();
  const ebOrgs = (env.EVENTBRITE_ORGANIZER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ebToken && ebOrgs.length) sources.push(eventbriteAdapter(ebToken, ebOrgs));

  let feeds: ReturnType<typeof parseFeedList> = [];
  let pages: ReturnType<typeof parseFeedList> = [];
  try {
    feeds = parseFeedList(env.EVENT_ICS_FEEDS, "ics");
    pages = parseFeedList(env.EVENT_PAGES, "page");
  } catch {
    // A malformed entry disables that list rather than the whole app.
  }
  sources.push(...feeds.map((f) => icsFeedAdapter(f)), ...pages.map((p) => venuePageAdapter(p)));

  // Built-in discovery: Luma's London feed and a curated list of London venues. On by default.
  const curated = env.CURATED_SOURCES !== "0";
  if (curated) sources.push(lumaCityAdapter("london", "Luma — London"), ...CURATED_VENUES.map((v, i) => venueCrawlAdapter({ id: `venue${i + 1}`, name: v.name, url: v.url })));

  // AI scout: costs a little per run (Anthropic API), so it is off until explicitly enabled.
  const scoutOn = env.SCOUT_ENABLED === "1" && !!env.ANTHROPIC_API_KEY?.trim();
  if (scoutOn) sources.push(scoutAdapter({ apiKey: env.ANTHROPIC_API_KEY!.trim(), brief: env.SCOUT_BRIEF?.trim() || undefined }));

  // Sample events stay available as a fallback; the catalogue hides them once real events exist.
  const demo = env.DEMO_EVENTS !== "0";
  if (demo) sources.push(...demoSources);

  return {
    sources,
    status: [
      { id: "ticketmaster", name: "Ticketmaster", configured: !!tmKey, note: tmKey ? "London plus European destinations" : "Add TICKETMASTER_API_KEY (free from developer.ticketmaster.com)" },
      {
        id: "eventbrite",
        name: "Eventbrite",
        configured: !!(ebToken && ebOrgs.length),
        note: ebToken && ebOrgs.length ? `${ebOrgs.length} organiser${ebOrgs.length === 1 ? "" : "s"} followed` : "Add EVENTBRITE_TOKEN and EVENTBRITE_ORGANIZER_IDS (Eventbrite has no public search)",
      },
      {
        id: "ics",
        name: "Calendar feeds (Luma, Meetup, venues)",
        configured: feeds.length > 0,
        note: feeds.length ? feeds.map((f) => f.name).join(", ") : "Add EVENT_ICS_FEEDS (Name|https://… iCal links)",
      },
      {
        id: "pages",
        name: "Venue \u201cWhat\u2019s on\u201d pages",
        configured: pages.length > 0,
        note: pages.length ? `${pages.map((p) => p.name).join(", ")} (robots.txt respected)` : "Add EVENT_PAGES (Name|https://… pages with event data)",
      },
      {
        id: "curated",
        name: "Built-in London discovery",
        configured: curated,
        note: curated ? `Luma London plus ${CURATED_VENUES.length} venues picked for your interests, read daily (robots.txt respected)` : "Off (CURATED_SOURCES=0)",
      },
      {
        id: "scout",
        name: "AI scout (web search)",
        configured: scoutOn,
        note: scoutOn
          ? "Searches the web twice a week; keeps only events confirmed by the organiser's own page"
          : "Off — set ANTHROPIC_API_KEY and SCOUT_ENABLED=1 (small API cost per run)",
      },
      { id: "demo", name: "Sample events (fictional)", configured: demo, note: demo ? "Only shown while no real events have loaded" : "Off" },
    ],
  };
}
