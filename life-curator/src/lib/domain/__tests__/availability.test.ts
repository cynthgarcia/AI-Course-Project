import { describe, expect, it } from "vitest";
import { evaluateFit, expandBlocks } from "../availability";
import { cal, prefs } from "./helpers";
import type { TimeBlock } from "../types";

const NOW = Date.parse("2026-10-23T09:00:00Z"); // Friday
const t = (s: string) => Date.parse(s);
const base = { now: NOW, prefs: prefs(), protectedIntervals: [], mode: "recommend" as const };

describe("calendar fit", () => {
  // Tue 27 Oct 2026 (GMT after DST change). Office busy until 18:00.
  const officeBusy = cal([["2026-10-27T09:00:00Z", "2026-10-27T18:00:00Z"]]);

  it("accepts an after-work Soho event that leaves time to get there", () => {
    const fit = evaluateFit({ ...base, start: t("2026-10-27T18:30:00Z"), end: t("2026-10-27T20:30:00Z"), area: "soho", calendar: officeBusy });
    expect(fit.status).toBe("fits");
    expect(fit.origin).toBe("office");
    expect(fit.hardBlocked).toBe(false);
  });

  it("rejects overlaps once travel and buffers are included", () => {
    const fit = evaluateFit({ ...base, start: t("2026-10-27T18:15:00Z"), end: t("2026-10-27T20:00:00Z"), area: "soho", calendar: officeBusy });
    expect(fit.status).toBe("conflict");
    expect(fit.hardBlocked).toBe(true);
    const far = evaluateFit({ ...base, start: t("2026-10-27T18:30:00Z"), end: t("2026-10-27T20:00:00Z"), area: "greenwich", calendar: officeBusy });
    expect(far.status).toBe("conflict");
  });

  it("rejects direct overlaps", () => {
    const fit = evaluateFit({ ...base, start: t("2026-10-27T12:30:00Z"), end: t("2026-10-27T13:00:00Z"), area: "soho", calendar: officeBusy });
    expect(fit.status).toBe("conflict");
  });

  it("protects Personal Time and Keep Open for Friends by default", () => {
    const blocks: TimeBlock[] = [
      { id: "p", category: "personal_time", weekday: "mon", startTime: "19:00", endTime: "22:00", label: null },
      { id: "f", category: "keep_open_for_friends", weekday: "fri", startTime: "19:00", endTime: "23:00", label: null },
    ];
    const protectedIntervals = expandBlocks(blocks, "2026-10-26", 7, "Europe/London");
    const mon = evaluateFit({ ...base, protectedIntervals, start: t("2026-10-26T19:30:00Z"), end: t("2026-10-26T21:00:00Z"), area: "fulham", calendar: cal() });
    expect(mon.status).toBe("protected");
    expect(mon.hardBlocked).toBe(true);
    const fri = evaluateFit({ ...base, protectedIntervals, start: t("2026-10-30T20:00:00Z"), end: t("2026-10-30T22:00:00Z"), area: "soho", calendar: cal() });
    expect(fri.status).toBe("protected");
  });

  it("explicit browsing of a protected window warns but never recategorizes the block", () => {
    const blocks: TimeBlock[] = [{ id: "p", category: "personal_time", weekday: "mon", startTime: "19:00", endTime: "22:00", label: null }];
    const snapshot = JSON.stringify(blocks);
    const protectedIntervals = expandBlocks(blocks, "2026-10-26", 7, "Europe/London");
    const fit = evaluateFit({ ...base, mode: "browse", protectedIntervals, start: t("2026-10-26T19:30:00Z"), end: t("2026-10-26T21:00:00Z"), area: "fulham", calendar: cal() });
    expect(fit.hardBlocked).toBe(false);
    expect(fit.protectedOverlap).toBe("personal_time");
    expect(fit.warnings.join(" ")).toMatch(/stays protected/);
    expect(JSON.stringify(blocks)).toBe(snapshot);
    expect(protectedIntervals[0]!.category).toBe("personal_time");
  });

  it("marks times unverified when no calendar is connected, but still applies the work-end fallback", () => {
    const ok = evaluateFit({ ...base, start: t("2026-10-27T19:00:00Z"), end: t("2026-10-27T21:00:00Z"), area: "soho", calendar: cal([], "disconnected") });
    expect(ok.status).toBe("unverified");
    expect(ok.hardBlocked).toBe(false);
    const early = evaluateFit({ ...base, start: t("2026-10-27T17:30:00Z"), end: t("2026-10-27T19:00:00Z"), area: "soho", calendar: cal([], "disconnected") });
    expect(early.status).toBe("conflict");
  });

  it("rejects unrealistically late finishes on a work night", () => {
    const fit = evaluateFit({ ...base, start: t("2026-10-27T22:30:00Z"), end: t("2026-10-28T00:30:00Z"), area: "shoreditch", calendar: cal() });
    expect(fit.status).toBe("too_late");
    expect(fit.hardBlocked).toBe(true);
  });

  it("flags but allows a moderately late weekend finish", () => {
    const fit = evaluateFit({ ...base, start: t("2026-10-31T22:00:00Z"), end: t("2026-11-01T01:00:00Z"), area: "soho", calendar: cal() });
    expect(fit.hardBlocked).toBe(false);
    expect(fit.warnings.some((w) => w.startsWith("Late finish"))).toBe(true);
  });

  it("assumes a duration when no end time is published, and says so", () => {
    const fit = evaluateFit({ ...base, start: t("2026-10-31T14:00:00Z"), end: null, area: "soho", calendar: cal() });
    expect(fit.assumedEnd).toBe(true);
    expect(fit.warnings[0]).toMatch(/assumes about 2 hours/);
  });

  it("does not assume location on Mondays and Fridays", () => {
    const fit = evaluateFit({ ...base, start: t("2026-10-30T18:30:00Z"), end: t("2026-10-30T19:30:00Z"), area: "soho", calendar: cal() });
    expect(fit.origin).toBe("unknown");
    expect(fit.travelMinutes).toBe(30); // longer of Fulham→Soho (30) and Soho→Soho (10)
  });

  it("rejects past events and too-short notice", () => {
    expect(evaluateFit({ ...base, start: NOW - 1000, end: null, area: "soho", calendar: cal() }).status).toBe("past");
    expect(evaluateFit({ ...base, start: NOW + 60 * 60_000, end: null, area: "soho", calendar: cal() }).status).toBe("too_soon");
  });

  it("handles events on the DST changeover day", () => {
    const blocks: TimeBlock[] = [{ id: "s", category: "personal_time", weekday: "sun", startTime: "17:00", endTime: "21:00", label: null }];
    const protectedIntervals = expandBlocks(blocks, "2026-10-25", 1, "Europe/London");
    // 16:30 GMT = 16:30 London after the change: ends 17:30, overlapping the 17:00 block.
    const fit = evaluateFit({ ...base, protectedIntervals, start: t("2026-10-25T16:30:00Z"), end: t("2026-10-25T17:30:00Z"), area: "fulham", calendar: cal() });
    expect(fit.status).toBe("protected");
    const before = evaluateFit({ ...base, protectedIntervals, start: t("2026-10-25T14:00:00Z"), end: t("2026-10-25T16:00:00Z"), area: "fulham", calendar: cal() });
    expect(before.status).toBe("fits");
  });
});
