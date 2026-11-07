import { describe, expect, it } from "vitest";
import { canConfirmAttendance, canTransition, canTransitionTrip } from "../status";
import { draftInvitation } from "../invitation";
import { ev } from "./helpers";

describe("status transitions", () => {
  it("does not allow jumping straight to attended or invited from nothing", () => {
    expect(canTransition(null, "attended")).toBe(false);
    expect(canTransition(null, "invited")).toBe(false);
    expect(canTransition("planned", "attended")).toBe(true);
  });

  it("only confirms attendance after the event has started", () => {
    expect(canConfirmAttendance(2000, 1000)).toBe(false);
    expect(canConfirmAttendance(1000, 2000)).toBe(true);
  });

  it("keeps travel statuses separate and never implies booking", () => {
    expect(canTransitionTrip(null, "planned")).toBe(false);
    expect(canTransitionTrip("researching", "planned")).toBe(true);
  });
});

describe("invitation drafts", () => {
  it("includes event facts and the official link, and is just text", () => {
    const e = ev({ title: "Jazz Night", start: "2026-11-03T19:30:00Z", officialUrl: "https://example.org/jazz" });
    const text = draftInvitation(e, "Europe/London");
    expect(text).toContain("Jazz Night");
    expect(text).toContain("Tuesday 3 November at 19:30");
    expect(text).toContain("https://example.org/jazz");
    expect(text).toContain("£20");
  });

  it("omits unverified or sample prices", () => {
    const demo = ev({ title: "Sample", start: "2026-11-03T19:30:00Z", isDemo: true, verification: { status: "demo", lastVerifiedAt: null, sourceName: "Sample" } });
    expect(draftInvitation(demo, "Europe/London")).not.toMatch(/£/);
  });
});
