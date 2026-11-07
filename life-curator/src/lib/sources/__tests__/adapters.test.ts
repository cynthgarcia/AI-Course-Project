import { describe, expect, it } from "vitest";
import { areaFromCoordinates } from "@/lib/domain/areas";
import { classify } from "../classify";
import { normalizeEventbrite, eventbriteAdapter } from "../eventbrite";
import { normalizeTicketmaster, ticketmasterAdapter } from "../ticketmaster";
import { plainText } from "../normalize";

const AT = "2026-10-24T10:00:00.000Z";

const tm = {
  id: "G5vYZ9abc",
  name: "London Jazz Orchestra: Ellington Suites",
  url: "https://www.ticketmaster.co.uk/event/abc",
  info: "<b>Doors</b> 7pm",
  dates: { start: { dateTime: "2026-11-05T19:30:00Z" }, timezone: "Europe/London", status: { code: "onsale" } },
  classifications: [{ segment: { name: "Music" }, genre: { name: "Jazz" }, subGenre: { name: "Big Band" } }],
  priceRanges: [{ min: 25, max: 60, currency: "GBP" }],
  _embedded: { venues: [{ name: "Cadogan Hall", city: { name: "London" }, country: { name: "Great Britain" }, location: { latitude: "51.4943", longitude: "-0.1574" } }] },
};

describe("ticketmaster", () => {
  it("normalises a listing with verified source, real links and a price range", () => {
    const e = normalizeTicketmaster(tm, AT)!;
    expect(e.id).toBe("tm-G5vYZ9abc");
    expect(e.category).toBe("music");
    expect(e.tags).toContain("Jazz");
    expect(e.venue.area).toBe("chelsea");
    expect(e.price).toEqual({ status: "range", min: 25, max: 60, currency: "GBP", includesFees: null });
    expect(e.bookingUrl).toBe("https://www.ticketmaster.co.uk/event/abc");
    expect(e.verification).toEqual({ status: "verified", lastVerifiedAt: AT, sourceName: "Ticketmaster" });
    expect(e.description).toBe("Doors 7pm");
    expect(e.isDemo).toBe(false);
  });

  it("uses local date and time in the venue's timezone when there's no UTC time", () => {
    const e = normalizeTicketmaster({ ...tm, dates: { start: { localDate: "2026-07-01", localTime: "20:00:00" }, timezone: "Europe/Paris" } }, AT)!;
    expect(e.start).toBe("2026-07-01T18:00:00.000Z");
  });

  it("skips listings without a time, cancelled ones, and keeps unknown prices unknown", () => {
    expect(normalizeTicketmaster({ ...tm, dates: { start: { localDate: "2026-11-05" } } }, AT)).toBeNull();
    expect(normalizeTicketmaster({ ...tm, dates: { ...tm.dates, status: { code: "cancelled" } } }, AT)).toBeNull();
    expect(normalizeTicketmaster({ ...tm, priceRanges: undefined }, AT)!.price.status).toBe("unknown");
  });

  it("maps European venues to destinations", () => {
    const e = normalizeTicketmaster({ ...tm, _embedded: { venues: [{ name: "Ziggo Dome", city: { name: "Amsterdam" }, country: { name: "Netherlands" }, location: { latitude: "52.31", longitude: "4.94" } }] } }, AT)!;
    expect(e.destinationId).toBe("amsterdam");
    expect(e.venue.area).toBeNull();
  });

  it("calls the API without leaking the key in errors", async () => {
    const calls: string[] = [];
    const ok = ticketmasterAdapter("KEY123", [{ city: "Paris", countryCode: "FR" }], (async (u: string) => {
      calls.push(u);
      return new Response(JSON.stringify({ _embedded: { events: [tm] } }), { status: 200 });
    }) as unknown as typeof fetch);
    const events = await ok.fetchEvents({ from: Date.parse(AT), to: Date.parse(AT) + 9e9 }, Date.parse(AT));
    expect(events).toHaveLength(2);
    expect(calls[0]).toContain("latlong=51.5073");
    expect(calls[1]).toContain("city=Paris");
    const bad = ticketmasterAdapter("KEY123", [], (async () => new Response("no", { status: 401 })) as unknown as typeof fetch);
    await expect(bad.fetchEvents({ from: 0, to: 1 }, 0)).rejects.toThrow(/401/);
    await expect(bad.fetchEvents({ from: 0, to: 1 }, 0)).rejects.not.toThrow(/KEY123/);
  });
});

describe("eventbrite", () => {
  const eb = {
    id: "987",
    name: { text: "Founders & Angels Breakfast" },
    summary: "Early-stage investing chat",
    url: "https://www.eventbrite.co.uk/e/987",
    start: { utc: "2026-11-10T08:00:00Z", timezone: "Europe/London" },
    end: { utc: "2026-11-10T09:30:00Z" },
    category_id: "101",
    status: "live",
    is_free: false,
    ticket_availability: { minimum_ticket_price: { major_value: "15.00", currency: "GBP" } },
    venue: { name: "Soho Works", address: { city: "London", latitude: "51.5140", longitude: "-0.1350", localized_address_display: "Soho, London" } },
  };

  it("normalises organiser events", () => {
    const e = normalizeEventbrite(eb, AT)!;
    expect(e.category).toBe("investing");
    expect(e.venue.area).toBe("soho");
    expect(e.price.min).toBe(15);
    expect(e.verification.sourceName).toBe("Eventbrite");
  });

  it("treats free as free and drafts as skipped", () => {
    expect(normalizeEventbrite({ ...eb, is_free: true }, AT)!.price.status).toBe("free");
    expect(normalizeEventbrite({ ...eb, status: "draft" }, AT)).toBeNull();
  });

  it("only requests numeric organiser IDs", async () => {
    const calls: string[] = [];
    const a = eventbriteAdapter("tok", ["123", "../evil"], (async (u: string) => {
      calls.push(u);
      return new Response(JSON.stringify({ events: [eb] }));
    }) as unknown as typeof fetch);
    await a.fetchEvents({ from: 0, to: Date.parse("2027-01-01") }, Date.parse(AT));
    expect(calls).toEqual(["https://www.eventbriteapi.com/v3/organizers/123/events/?status=live&order_by=start_asc&expand=venue,ticket_availability,organizer"]);
  });
});

describe("helpers", () => {
  it("places coordinates in London areas", () => {
    expect(areaFromCoordinates(51.5136, -0.1365)).toBe("soho");
    expect(areaFromCoordinates(51.42, -0.3)).toBe("outer_london");
    expect(areaFromCoordinates(48.85, 2.35)).toBeNull();
  });

  it("classifies text and strips markup from untrusted descriptions", () => {
    expect(classify("Charity Winter Gala & Auction")).toBe("social");
    expect(classify("Beginners improv workshop")).toBe("creative");
    expect(plainText('<script>alert(1)</script><p>Hi &amp; welcome</p>')).toBe("Hi & welcome");
  });
});
