import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractEventLinks, lumaCityAdapter, venueCrawlAdapter } from "@/server/feedSources";
import { buildCatalogue } from "@/server/events";
import { resetDbForTests } from "@/server/db";
import { configuredSources } from "@/server/sources";
import { demoSources } from "@/lib/sources/demo";
import type { EventSourceAdapter } from "@/lib/sources/types";

const range = { from: Date.parse("2026-10-24T00:00:00Z"), to: Date.parse("2027-02-01T00:00:00Z") };
const html = (body: string) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
const ld = (o: object) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

describe("finding event pages on a listing", () => {
  it("keeps same-site event links and skips everything else", () => {
    const page = `
      <a href="/whats-on/mahler-5">Mahler</a>
      <a href="/whats-on/mahler-5#tickets">dup</a>
      <a href="https://www.venue.example/events/jazz-night">Jazz</a>
      <a href="https://elsewhere.example/events/x">other site</a>
      <a href="/whats-on">self</a>
      <a href="/whats-on?page=2">next page</a>
      <a href="/basket">basket</a>
      <a href="/about-us">about</a>
      <a href="/images/poster.jpg">img</a>`;
    expect(extractEventLinks(page, "https://www.venue.example/whats-on", 10)).toEqual([
      "https://www.venue.example/whats-on/mahler-5",
      "https://www.venue.example/events/jazz-night",
    ]);
  });
});

describe("reading a venue", () => {
  const ip = "https://93.184.216.34";
  const pages: Record<string, Response | (() => Response)> = {};
  const fetchImpl = (async (u: URL | string) => {
    const path = new URL(String(u)).pathname;
    const r = pages[path];
    return r ? (typeof r === "function" ? r() : r.clone()) : new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
  }) as unknown as typeof fetch;

  it("collects events from event pages, honouring robots.txt per page", async () => {
    pages["/robots.txt"] = new Response("User-agent: *\nDisallow: /whats-on/private", { headers: { "content-type": "text/plain" } });
    pages["/whats-on"] = html(`<a href="/whats-on/quartet">Q</a><a href="/whats-on/private/gala">G</a><a href="/whats-on/date-only">D</a>`);
    pages["/whats-on/quartet"] = html(ld({ "@type": "MusicEvent", name: "Dawn Quartet", startDate: "2026-11-20T19:30:00+00:00", location: { name: "Hall", address: { addressLocality: "London" } } }));
    pages["/whats-on/private/gala"] = html(ld({ "@type": "Event", name: "Secret Gala", startDate: "2026-11-21T19:30:00+00:00" }));
    pages["/whats-on/date-only"] = html(ld({ "@type": "Event", name: "Season", startDate: "2026-12-01" }));
    const a = venueCrawlAdapter({ id: "venue1", name: "Test Hall", url: `${ip}/whats-on` }, { delayMs: 0, fetchImpl });
    const events = await a.fetchEvents(range, Date.parse("2026-10-24T10:00:00Z"));
    expect(events.map((e) => e.title)).toEqual(["Dawn Quartet"]);
    expect(events[0]!.verification).toMatchObject({ status: "verified", sourceName: "Test Hall" });
    expect(a.backgroundOnly).toBe(true);
  });

  it("stops when the whole site is off-limits", async () => {
    pages["/robots.txt"] = new Response("User-agent: *\nDisallow: /", { headers: { "content-type": "text/plain" } });
    const a = venueCrawlAdapter({ id: "venue1", name: "Test Hall", url: `${ip}/whats-on` }, { delayMs: 0, fetchImpl });
    await expect(a.fetchEvents(range, Date.now())).rejects.toThrow(/asks automated tools/);
  });
});

describe("Luma city feed", () => {
  it("finds the city feed from the public page", async () => {
    const calls: string[] = [];
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:a1", "SUMMARY:AI Builders Drinks", "DTSTART:20261112T183000Z", "LOCATION:Shoreditch\\, London", "DESCRIPTION:https://lu.ma/xyz", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const fetchImpl = (async (u: URL | string) => {
      calls.push(String(u));
      return String(u).includes("/ics/get")
        ? new Response(ics, { headers: { "content-type": "text/calendar" } })
        : html(`<script>{"place":{"api_id":"discplace-AbC123"}}</script>`);
    }) as unknown as typeof fetch;
    const publicDns = (async () => [{ address: "93.184.216.34", family: 4 }]) as never;
    const a = lumaCityAdapter("london", "Luma — London", fetchImpl, publicDns);
    const events = await a.fetchEvents(range, Date.parse("2026-10-24T10:00:00Z"));
    expect(calls[0]).toBe("https://lu.ma/london");
    expect(calls[1]).toBe("https://api.lu.ma/ics/get?entity=discover&id=discplace-AbC123");
    expect(events.map((e) => e.title)).toEqual(["AI Builders Drinks"]);
  });
});

describe("sample events as a fallback", () => {
  beforeAll(() => {
    process.env.DATA_DIR = "memory://";
  });
  afterAll(resetDbForTests);

  const real: EventSourceAdapter = {
    id: "real-test",
    name: "Real",
    kind: "api",
    isDemo: false,
    async fetchEvents() {
      const [one] = await demoSources[0]!.fetchEvents(range, Date.parse("2026-10-24T10:00:00Z"));
      return [{ ...one!, id: "real-1", isDemo: false, verification: { status: "verified", lastVerifiedAt: null, sourceName: "Real" } }];
    },
  };

  it("hides sample events once any real events exist", async () => {
    const now = Date.parse("2026-10-24T10:00:00Z");
    const withReal = await buildCatalogue([real, ...demoSources], now);
    expect(withReal.events.every((e) => !e.isDemo)).toBe(true);
    const onlyDemo = await buildCatalogue([...demoSources], now);
    expect(onlyDemo.events.length).toBeGreaterThan(5);
  });

  it("includes built-in discovery unless turned off", () => {
    expect(configuredSources({ CURATED_SOURCES: "1" } as unknown as NodeJS.ProcessEnv).sources.some((s) => s.id === "luma-london")).toBe(true);
    expect(configuredSources({ CURATED_SOURCES: "0" } as unknown as NodeJS.ProcessEnv).sources.some((s) => s.id.startsWith("venue"))).toBe(false);
  });
});
