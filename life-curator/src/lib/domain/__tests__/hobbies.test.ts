import { describe, expect, it } from "vitest";
import { recommendHobbies, hobbyTasteEntries, type UserHobby } from "../hobbies";
import { buildTaste } from "../taste";
import { ev, prefs } from "./helpers";

const NOW = Date.parse("2026-10-24T10:00:00Z");
const acting: UserHobby = {
  id: "11111111-1111-4111-8111-111111111111", hobbyId: "acting", name: "Acting", status: "signed_up", pastExperience: true,
  nextSession: null, rating: null, notes: "", createdAt: "2026-10-24T10:00:00Z", updatedAt: "2026-10-24T10:00:00Z",
};

describe("hobby recommendations", () => {
  it("puts public speaking near the top for an actor who wants to speak publicly", () => {
    const recs = recommendHobbies({ prefs: prefs(), goals: ["confidence_speaking", "public_profile"], experiences: [], hobbies: [acting], events: [], now: NOW });
    const ids = recs.map((r) => r.hobby.id);
    expect(ids.slice(0, 3)).toContain("public_speaking");
    expect(ids).not.toContain("acting"); // already tracked
    const ps = recs.find((r) => r.hobby.id === "public_speaking")!;
    expect(ps.reasons.join(" ")).toMatch(/speak confidently in public/);
    expect(ps.reasons.join(" ")).toMatch(/next step from acting/);
  });

  it("matches the user's own words for goals", () => {
    const recs = recommendHobbies({ prefs: prefs(), goals: ["podcast"], experiences: [], hobbies: [], events: [], now: NOW });
    expect(recs.find((r) => r.hobby.id === "podcasting")?.reasons.join(" ")).toMatch(/podcast/);
  });

  it("links upcoming events that let you try a hobby", () => {
    const taster = ev({ title: "Improv Acting Taster", tags: ["improv", "acting"], start: "2026-11-12T18:45:00Z" });
    const recs = recommendHobbies({ prefs: prefs(), goals: [], experiences: [], hobbies: [], events: [taster], now: NOW }, 30);
    expect(recs.find((r) => r.hobby.id === "improv")!.tryEvents).toEqual([taster]);
  });

  it("feeds hobby ratings into taste", () => {
    const t = buildTaste(hobbyTasteEntries([{ ...acting, rating: 5 }]));
    expect(t.byTag.get("acting")).toEqual({ avg: 5, count: 1 });
  });
});
