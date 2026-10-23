import { describe, expect, it } from "vitest";
import { canonicalUrl, dedupeEvents } from "../dedupe";
import { collectEvents } from "@/lib/sources";
import { ev } from "./helpers";

describe("deduplication", () => {
  it("merges the same occurrence from two sources and keeps both source records", () => {
    const a = ev({ id: "a", title: "The Jazz Night", start: "2026-11-01T19:00:00Z", venue: { name: "Hall", address: null, neighborhood: null, city: "London", country: "UK", area: "soho" } });
    const b = { ...ev({ id: "b", title: "Jazz Night", start: "2026-11-01T19:00:00Z", officialUrl: "https://hall.example/jazz" }), venue: a.venue, sourceRecords: [{ sourceId: "other", externalId: "99", url: null, lastSeenAt: "" }] };
    const out = dedupeEvents([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0]!.sourceRecords).toHaveLength(2);
    expect(out[0]!.officialUrl).toBe("https://hall.example/jazz");
  });

  it("keeps separate performances as separate occurrences", () => {
    const venue = { name: "Hall", address: null, neighborhood: null, city: "London", country: "UK", area: "soho" as const };
    const out = dedupeEvents([
      ev({ title: "Show", venue, start: "2026-11-01T19:00:00Z", officialUrl: "https://x.example/show" }),
      ev({ title: "Show", venue, start: "2026-11-02T19:00:00Z", officialUrl: "https://x.example/show" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("canonicalises URLs and rejects non-http schemes", () => {
    expect(canonicalUrl("https://www.Example.org/a/?utm_source=x#top")).toBe("example.org/a");
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
  });

  it("deduplicates the demo feeds end to end", async () => {
    const now = Date.parse("2026-10-23T09:00:00Z");
    const { events, runs } = await collectEvents({ from: now - 86_400_000 * 7, to: now + 86_400_000 * 120 }, now);
    expect(runs.every((r) => r.ok)).toBe(true);
    const jazz = events.filter((e) => e.id === "demo-jazz-trio");
    expect(jazz).toHaveLength(1);
    expect(jazz[0]!.sourceRecords).toHaveLength(2);
    expect(events.filter((e) => e.occurrenceGroupId === "chamber-mozart")).toHaveLength(2);
    // Sample data never carries booking links.
    expect(events.every((e) => e.isDemo && e.bookingUrl === null && e.verification.status === "demo")).toBe(true);
  });

  it("keeps working when one source fails", async () => {
    const now = Date.parse("2026-10-23T09:00:00Z");
    const broken = { id: "bad", name: "Broken", kind: "api" as const, isDemo: false, fetchEvents: async () => { throw new Error("secret token xyz"); } };
    const { runs } = await collectEvents({ from: now, to: now + 1 }, now, [broken]);
    expect(runs[0]!.ok).toBe(false);
    expect(runs[0]!.error).not.toMatch(/secret/);
  });
});
