import { describe, expect, it } from "vitest";
import { icsToEvents, parseIcs } from "@/lib/sources/ics";
import { robotsAllows } from "@/server/robots";
import { parseFeedList, venuePageAdapter, icsFeedAdapter } from "@/server/feedSources";
import { eventsFromPage } from "@/server/importEvent";

const ICS = [
  "BEGIN:VCALENDAR",
  "X-WR-TIMEZONE:Europe/London",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/London",
  "BEGIN:STANDARD",
  "DTSTART:19701025T020000",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "UID:evt-1@lu.ma",
  "SUMMARY:AI Founders Social\\, London",
  "DTSTART;TZID=Europe/London:20261112T183000",
  "DTEND;TZID=Europe/London:20261112T210000",
  "LOCATION:Second Home\\, 68 Hanbury St\\, London",
  "GEO:51.5203;-0.0719",
  "DESCRIPTION:Drinks and demos.\\nRSVP: https://lu.ma/abc123",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-2",
  "SUMMARY:Weekly run club",
  "DTSTART:20261113T070000Z",
  "RRULE:FREQ=WEEKLY",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-3",
  "SUMMARY:All-day fair",
  "DTSTART;VALUE=DATE:20261114",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-4",
  "SUMMARY:Online AMA",
  "DTSTART:20261115T180000Z",
  "LOCATION:https://zoom.us/j/1",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-5",
  "SUMMARY:Design night in Paris",
  "DTSTART;TZID=Europe/Paris:20261121T200000",
  "LOCATION:Le Marais\\, Paris",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:evt-6",
  "SUMMARY:Cancelled thing",
  "DTSTART:20261120T180000Z",
  "STATUS:CANCELLED",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const range = { from: Date.parse("2026-10-24T00:00:00Z"), to: Date.parse("2027-02-01T00:00:00Z") };

describe("iCal feeds", () => {
  it("parses folded lines, escapes and timezones", () => {
    const [first] = parseIcs(ICS.replace("Drinks and demos.", "Drinks and\r\n  demos."));
    expect(first!.summary).toBe("AI Founders Social, London");
    expect(first!.description).toContain("Drinks and demos.");
    expect(new Date(first!.start!).toISOString()).toBe("2026-11-12T18:30:00.000Z");
  });

  it("keeps timed, single, in-person, confirmed events only", () => {
    const events = icsToEvents(ICS, { id: "ics1", name: "Luma: AI London" }, "2026-10-24T10:00:00Z", range);
    expect(events.map((e) => e.title)).toEqual(["AI Founders Social, London", "Design night in Paris"]);
    const [ai, paris] = events;
    expect(ai!.category).toBe("tech");
    expect(ai!.venue.area).toBe("shoreditch");
    expect(ai!.officialUrl).toBe("https://lu.ma/abc123");
    expect(ai!.price.status).toBe("unknown");
    expect(ai!.verification.sourceName).toBe("Luma: AI London");
    expect(paris!.destinationId).toBe("paris");
    expect(paris!.start).toBe("2026-11-21T19:00:00.000Z");
  });

  it("fetches feeds through the safe fetcher", async () => {
    const f = (async () => new Response(ICS, { headers: { "content-type": "text/calendar" } })) as unknown as typeof fetch;
    // Uses real DNS for the host, so point it at a literal public IP.
    const a = icsFeedAdapter({ id: "ics1", name: "Feed", url: "https://93.184.216.34/cal.ics" }, f);
    expect((await a.fetchEvents(range, Date.parse("2026-10-24T10:00:00Z"))).length).toBe(2);
  });
});

describe("robots.txt", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/whats-on\n\nUser-agent: BadBot\nDisallow: /";
  it("applies the most specific matching rule", () => {
    expect(robotsAllows(robots, "/whats-on")).toBe(true);
    expect(robotsAllows(robots, "/private/tickets")).toBe(false);
    expect(robotsAllows(robots, "/private/whats-on/jazz")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /", "/events")).toBe(false);
    expect(robotsAllows("", "/events")).toBe(true);
  });

  it("refuses venue pages that robots.txt disallows", async () => {
    const f = (async (u: URL | string) =>
      String(u).endsWith("/robots.txt")
        ? new Response("User-agent: *\nDisallow: /", { headers: { "content-type": "text/plain" } })
        : new Response("<html></html>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    const a = venuePageAdapter({ id: "page1", name: "A venue", url: "https://93.184.216.34/whats-on" }, f);
    await expect(a.fetchEvents(range, Date.now())).rejects.toThrow(/asks automated tools not to/);
  });
});

describe("venue pages and config", () => {
  it("reads every timed event on a listing page and skips date-only ones", () => {
    const html = `<script type="application/ld+json">[
      {"@type":"TheaterEvent","name":"Hamlet","startDate":"2026-11-20T19:30:00+00:00","location":{"name":"The Old Vic","address":{"addressLocality":"London"}},"offers":{"price":"25","priceCurrency":"GBP"}},
      {"@type":"Event","name":"Season launch","startDate":"2026-12-01"},
      {"@type":"MusicEvent","name":"Late Jazz","startDate":"2026-11-21T22:00:00+00:00","eventStatus":"https://schema.org/EventCancelled"}
    ]</script>`;
    const evs = eventsFromPage(html, "https://venue.example/whats-on", { mode: "source", sourceId: "page1" });
    expect(evs.map((e) => e.title)).toEqual(["Hamlet"]);
    expect(evs[0]!.id).toMatch(/^page1-[0-9a-f]{16}$/);
    expect(evs[0]!.verification.status).toBe("verified");
    expect(evs[0]!.addedByUser).toBe(false);
    expect(evs[0]!.eligibility).toBe("public");
  });

  it("parses feed lists", () => {
    expect(parseFeedList("Luma AI|https://api.lu.ma/ics/get?entity=calendar&id=cal-1\nhttps://www.venue.example/cal.ics", "ics")).toEqual([
      { id: "ics1", name: "Luma AI", url: "https://api.lu.ma/ics/get?entity=calendar&id=cal-1" },
      { id: "ics2", name: "venue.example", url: "https://www.venue.example/cal.ics" },
    ]);
  });
});
