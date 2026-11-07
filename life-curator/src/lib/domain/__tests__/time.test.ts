import { describe, expect, it } from "vitest";
import { addDays, localDate, startOfWeek, tzOffsetMinutes, weekdayOfDate, zonedToEpoch } from "../time";
import { expandBlocks } from "../availability";

const iso = (t: number) => new Date(t).toISOString();

describe("timezone handling", () => {
  it("converts London wall-clock time in summer and winter", () => {
    expect(iso(zonedToEpoch("2026-07-01", "19:00", "Europe/London"))).toBe("2026-07-01T18:00:00.000Z");
    expect(iso(zonedToEpoch("2026-12-01", "19:00", "Europe/London"))).toBe("2026-12-01T19:00:00.000Z");
  });

  it("handles the autumn DST change (25 Oct 2026)", () => {
    expect(iso(zonedToEpoch("2026-10-25", "00:30", "Europe/London"))).toBe("2026-10-24T23:30:00.000Z");
    expect(iso(zonedToEpoch("2026-10-25", "03:00", "Europe/London"))).toBe("2026-10-25T03:00:00.000Z");
    // Ambiguous 01:30 resolves to the earlier (BST) instant.
    expect(iso(zonedToEpoch("2026-10-25", "01:30", "Europe/London"))).toBe("2026-10-25T00:30:00.000Z");
  });

  it("shifts non-existent spring-forward times forward", () => {
    expect(iso(zonedToEpoch("2026-03-29", "01:30", "Europe/London"))).toBe("2026-03-29T01:30:00.000Z");
  });

  it("handles other European zones", () => {
    expect(tzOffsetMinutes(Date.parse("2026-07-01T12:00:00Z"), "Europe/Paris")).toBe(120);
    expect(iso(zonedToEpoch("2026-11-07", "20:00", "Europe/Paris"))).toBe("2026-11-07T19:00:00.000Z");
  });

  it("does date arithmetic on calendar days", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(weekdayOfDate("2026-10-23")).toBe("fri");
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(localDate(Date.parse("2026-10-24T23:30:00Z"), "Europe/London")).toBe("2026-10-25");
  });

  it("expands recurring blocks correctly across a DST change", () => {
    const blocks = expandBlocks(
      [
        { id: "a", category: "personal_time", weekday: "sat", startTime: "10:00", endTime: "12:00", label: null },
        { id: "b", category: "personal_time", weekday: "sun", startTime: "17:00", endTime: "21:00", label: null },
        { id: "c", category: "keep_open_for_friends", weekday: "sat", startTime: "22:00", endTime: "01:00", label: null },
      ],
      "2026-10-24",
      2,
      "Europe/London",
    );
    expect(blocks.map((b) => [iso(b.start), iso(b.end)])).toEqual([
      ["2026-10-24T09:00:00.000Z", "2026-10-24T11:00:00.000Z"],
      ["2026-10-24T21:00:00.000Z", "2026-10-25T00:00:00.000Z"], // 01:00 occurs twice; earlier instant,
      ["2026-10-25T17:00:00.000Z", "2026-10-25T21:00:00.000Z"],
    ]);
  });
});
