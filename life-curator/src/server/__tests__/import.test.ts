import { describe, expect, it } from "vitest";
import { assertPublicUrl, fetchPage, isPrivateAddress, parseEventPage } from "@/server/importEvent";

const publicDns = (async () => [{ address: "93.184.216.34", family: 4 }]) as never;
const privateDns = (async () => [{ address: "10.0.0.5", family: 4 }]) as never;

const page = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"MusicEvent","name":"Basement Jazz &amp; Soul","startDate":"2026-11-14T21:00:00+00:00","endDate":"2026-11-15T01:00:00+00:00","description":"<p>Late set</p>","location":{"@type":"Place","name":"The Vault","address":{"streetAddress":"1 Greek St","addressLocality":"London","addressCountry":"GB"},"geo":{"latitude":51.514,"longitude":-0.131}},"offers":[{"price":"18.50","priceCurrency":"GBP","url":"https://tickets.example/jazz"}]}]}</script></head></html>`;

describe("link import", () => {
  it("reads schema.org event data into a reviewable draft", () => {
    const e = parseEventPage(page, "https://www.example.com/e/1");
    expect(e.title).toBe("Basement Jazz & Soul");
    expect(e.start).toBe("2026-11-14T21:00:00.000Z");
    expect(e.venue.area).toBe("soho");
    expect(e.price.min).toBe(18.5);
    expect(e.bookingUrl).toBe("https://tickets.example/jazz");
    expect(e.verification).toMatchObject({ status: "unverified", sourceName: "Imported from example.com" });
    expect(e.eligibility).toBe("unknown");
    expect(e.addedByUser).toBe(true);
  });

  it("explains when a page has no readable event", () => {
    expect(() => parseEventPage("<html>nothing</html>", "https://x.example")).toThrow(/add it by hand/i);
  });

  it("blocks private networks, non-https and Instagram", async () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    await expect(assertPublicUrl("http://example.com", publicDns)).rejects.toThrow(/https/);
    await expect(assertPublicUrl("https://internal.example", privateDns)).rejects.toThrow(/can't be imported/);
    await expect(assertPublicUrl("https://169.254.169.254/latest", publicDns)).rejects.toThrow(/can't be imported/);
    await expect(assertPublicUrl("https://www.instagram.com/p/abc", publicDns)).rejects.toThrow(/Instagram/);
    await expect(assertPublicUrl("https://example.com:8443/", publicDns)).rejects.toThrow();
  });

  it("re-checks every redirect hop", async () => {
    const dns = (async (host: string) => [{ address: host === "evil.example" ? "127.0.0.1" : "93.184.216.34", family: 4 }]) as never;
    const f = (async () => new Response(null, { status: 302, headers: { location: "https://evil.example/" } })) as unknown as typeof fetch;
    await expect(fetchPage("https://ok.example/", f, dns)).rejects.toThrow(/can't be imported/);
  });

  it("fetches an allowed page", async () => {
    const f = (async () => new Response(page, { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    const res = await fetchPage("https://ok.example/e", f, publicDns);
    expect(res.html).toContain("MusicEvent");
  });
});
