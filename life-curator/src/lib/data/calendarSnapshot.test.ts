import { describe, expect, it } from "vitest";
import { parseSnapshot } from "./calendarSnapshot";

describe("calendar snapshot", () => {
  it("keeps only valid intervals and ignores extra fields", () => {
    const s = parseSnapshot({
      fetchedAt: "2026-10-24T09:00:00Z",
      busy: [
        { start: "2026-11-27T00:00:00Z", end: "2026-11-30T00:00:00Z", title: "private" },
        { start: "bad", end: "2026-11-30T00:00:00Z" },
        { start: "2026-11-02T10:00:00Z", end: "2026-11-02T09:00:00Z" },
      ],
    });
    expect(s!.mode).toBe("snapshot");
    expect(s!.busy).toEqual([{ start: Date.parse("2026-11-27T00:00:00Z"), end: Date.parse("2026-11-30T00:00:00Z") }]);
    expect(JSON.stringify(s)).not.toContain("private");
  });

  it("rejects malformed input", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({ busy: [] })).toBeNull();
  });
});
