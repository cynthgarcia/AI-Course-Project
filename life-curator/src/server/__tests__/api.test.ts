// Integration tests: real route handlers against an in-memory Postgres (PGlite).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as getState } from "@/app/api/state/route";
import { POST as act } from "@/app/api/actions/route";
import { GET as exportData } from "@/app/api/export/route";
import { DELETE as deleteAccount } from "@/app/api/account/route";
import { getDb, resetDbForTests } from "@/server/db";

const ORIGIN = "http://localhost:3000";
let ip = 0;

function req(method: string, body?: unknown, cookie?: string, origin: string | null = ORIGIN): Request {
  const headers: Record<string, string> = { host: "localhost:3000", "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip}` };
  if (origin) headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  return new Request(`${ORIGIN}/api/x`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

function cookieFrom(res: Response): string {
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}

async function account(email: string): Promise<string> {
  const res = await signup(req("POST", { email, password: "correct horse battery" }));
  expect(res.status).toBe(201);
  return cookieFrom(res);
}

const at = new Date().toISOString();
const experience = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  eventId: null,
  title: "Ronnie's late set",
  category: "music",
  tags: ["jazz"],
  venueName: "A jazz club",
  neighborhood: "Soho",
  city: "London",
  date: "2025-06-14",
  rating: 5,
  cost: { amount: 30, currency: "GBP", basis: "verified" },
  withWhom: "friends",
  wasNew: false,
  notes: "",
  source: "manual",
  createdAt: at,
  updatedAt: at,
  ...over,
});

beforeAll(() => {
  process.env.DATA_DIR = "memory://";
});
afterAll(resetDbForTests);

describe("accounts", () => {
  it("signs up, rejects duplicates and weak passwords", async () => {
    const c = await account("ada@example.com");
    expect(c).toMatch(/^lc_session=/);
    expect((await signup(req("POST", { email: "ADA@example.com", password: "correct horse battery" }))).status).toBe(409);
    expect((await signup(req("POST", { email: "bob@example.com", password: "short" }))).status).toBe(400);
  });

  it("logs in with the right password only", async () => {
    await account("cy@example.com");
    expect((await login(req("POST", { email: "cy@example.com", password: "wrong password!!" }))).status).toBe(401);
    expect((await login(req("POST", { email: "nobody@example.com", password: "correct horse battery" }))).status).toBe(401);
    const ok = await login(req("POST", { email: "cy@example.com", password: "correct horse battery" }));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly; SameSite=Lax/);
  });

  it("stores only password and session hashes", async () => {
    const c = await account("dee@example.com");
    const db = await getDb();
    const [u] = await db.query<{ password_hash: string }>("select password_hash from users where email = 'dee@example.com'");
    expect(u!.password_hash).toMatch(/^scrypt\$/);
    const tokens = await db.query<{ token_hash: string }>("select token_hash from sessions");
    expect(tokens.some((t) => c.includes(t.token_hash))).toBe(false);
  });

  it("logs out by deleting the session", async () => {
    const c = await account("eve@example.com");
    expect((await getState(req("GET", undefined, c))).status).toBe(200);
    await logout(req("POST", {}, c));
    expect((await getState(req("GET", undefined, c))).status).toBe(401);
  });

  it("refuses cross-site and unauthenticated requests", async () => {
    expect((await signup(req("POST", { email: "x@example.com", password: "correct horse battery" }, undefined, "https://evil.example"))).status).toBe(403);
    expect((await signup(req("POST", { email: "x@example.com", password: "correct horse battery" }, undefined, null))).status).toBe(403);
    expect((await getState(req("GET"))).status).toBe(401);
    expect((await act(req("POST", { action: { type: "completeOnboarding" } }))).status).toBe(401);
  });
});

describe("actions", () => {
  it("validates input and persists changes", async () => {
    const c = await account("fay@example.com");
    expect((await act(req("POST", { type: "setPrefs", prefs: { monthlyBudget: -5 } }, c))).status).toBe(400);
    expect((await act(req("POST", { type: "reset" }, c))).status).toBe(400);
    expect((await act(req("POST", { type: "addExperience", experience: experience({ source: "sample" }) }, c))).status).toBe(400);

    expect((await act(req("POST", { type: "setPrefs", prefs: { monthlyBudget: 1200 } }, c))).status).toBe(200);
    const res = await act(req("POST", { type: "addExperience", experience: experience() }, c));
    expect(res.status).toBe(200);
    const state = (await (await getState(req("GET", undefined, c))).json()).state;
    expect(state.prefs.monthlyBudget).toBe(1200);
    expect(Object.values(state.experiences)).toHaveLength(1);
    expect((Object.values(state.experiences)[0] as { date: string }).date).toBe("2025-06-14");
  });

  it("keeps each user's data private", async () => {
    const a = await account("gil@example.com");
    const b = await account("hal@example.com");
    const x = experience();
    await act(req("POST", { type: "addExperience", experience: x }, a));
    // B can't see, edit or delete A's record, even knowing its id.
    const bState = (await (await getState(req("GET", undefined, b))).json()).state;
    expect(bState.experiences).toEqual({});
    await act(req("POST", { type: "updateExperience", id: x.id, patch: { rating: 1 }, at }, b));
    await act(req("POST", { type: "deleteExperience", id: x.id }, b));
    // Reusing A's id for B's own record creates a separate row for B only.
    await act(req("POST", { type: "addExperience", experience: { ...x, title: "B's" } }, b));
    const aState = (await (await getState(req("GET", undefined, a))).json()).state;
    expect(aState.experiences[x.id].rating).toBe(5);
    expect(aState.experiences[x.id].title).toBe("Ronnie's late set");
  });

  it("won't confirm attendance before an event has happened", async () => {
    const c = await account("ivy@example.com");
    const res = await act(req("POST", { type: "setStatus", eventId: "demo-mahler", category: "music", status: "attended", at }, c));
    expect([400, 409]).toContain(res.status);
  });

  it("generates the weekly plan on the server", async () => {
    const c = await account("jo@example.com");
    const res = await act(req("POST", { type: "generatePlan" }, c));
    const { state } = await res.json();
    expect(state.plans).toHaveLength(1);
    expect(state.runs[0].outcome).toBe("generated");
  });

  it("exports and deletes an account with all its data", async () => {
    const c = await account("kit@example.com");
    await act(req("POST", { type: "addExperience", experience: experience() }, c));
    const exp = await exportData(req("GET", undefined, c));
    expect(exp.headers.get("content-disposition")).toMatch(/attachment/);
    expect(await exp.text()).not.toMatch(/password|scrypt/);
    expect((await deleteAccount(req("DELETE", undefined, c))).status).toBe(200);
    const db = await getDb();
    expect(await db.query("select 1 from users where email = 'kit@example.com'")).toHaveLength(0);
    expect((await getState(req("GET", undefined, c))).status).toBe(401);
  });
});

describe("custom events and hobbies", () => {
  const custom = (over: Record<string, unknown> = {}) => ({
    id: `user-${randomUUID()}`,
    title: "Patrons' winter gala",
    description: "Seen on Instagram",
    category: "social",
    tags: ["gala"],
    venue: { name: "A private members' club", address: null, neighborhood: "Mayfair", city: "London", country: "United Kingdom", area: "west_end" },
    start: "2026-12-05T19:00:00.000Z",
    end: null,
    timezone: "Europe/London",
    price: { status: "unknown", min: null, max: null, currency: "GBP", includesFees: null },
    officialUrl: "https://example.org/gala",
    bookingUrl: null,
    organizer: null,
    eligibility: "invite_only",
    dressCode: "Black tie",
    accessibility: null,
    socialFit: "friends",
    bookingDeadline: null,
    destinationId: null,
    accessNote: "Ask Sam about the young patrons committee",
    ...over,
  });

  it("stores a user's own events privately, with trust fields set by the server", async () => {
    const a = await account("lou@example.com");
    const b = await account("max@example.com");
    const e = custom({ isDemo: true, verification: { status: "verified" } });
    // Unknown keys are stripped by validation; server forces unverified + addedByUser.
    expect((await act(req("POST", { type: "addCustomEvent", event: e }, a))).status).toBe(200);
    const aState = (await (await getState(req("GET", undefined, a))).json()).state;
    const saved = aState.customEvents[e.id];
    expect(saved.verification.status).toBe("unverified");
    expect(saved.verification.sourceName).toBe("Added by you");
    expect(saved.isDemo).toBe(false);
    expect(saved.accessNote).toMatch(/young patrons/);
    const bState = (await (await getState(req("GET", undefined, b))).json()).state;
    expect(bState.customEvents).toEqual({});
  });

  it("rejects unsafe links in user events", async () => {
    const a = await account("ned@example.com");
    expect((await act(req("POST", { type: "addCustomEvent", event: custom({ officialUrl: "javascript:alert(1)" }) }, a))).status).toBe(400);
  });

  it("tracks hobbies and goals", async () => {
    const a = await account("oz@example.com");
    const id = randomUUID();
    await act(req("POST", { type: "setPrefs", prefs: { goals: ["confidence_speaking", "Be more of a public figure"] } }, a));
    await act(req("POST", { type: "addHobby", hobby: { id, hobbyId: "acting", name: "Acting", status: "signed_up", pastExperience: true, nextSession: "2026-11-07", rating: null, notes: "", createdAt: at, updatedAt: at } }, a));
    await act(req("POST", { type: "updateHobby", id, patch: { status: "trying", rating: 5 }, at }, a));
    const s = (await (await getState(req("GET", undefined, a))).json()).state;
    expect(s.prefs.goals).toEqual(["confidence_speaking", "Be more of a public figure"]);
    expect(s.hobbies[id]).toMatchObject({ status: "trying", rating: 5, nextSession: "2026-11-07", pastExperience: true });
  });
});

describe("batches and invites", () => {
  it("applies a batch atomically: one bad action saves nothing", async () => {
    const c = await account("pip@example.com");
    const res = await act(req("POST", { actions: [{ type: "addExperience", experience: experience() }, { type: "setStatus", eventId: "demo-mahler", category: "music", status: "attended", at }] }, c));
    expect(res.status).toBe(409);
    const s = (await (await getState(req("GET", undefined, c))).json()).state;
    expect(s.experiences).toEqual({});
    const ok = await act(req("POST", { actions: [{ type: "setPrefs", prefs: { monthlyBudget: 500 } }, { type: "completeOnboarding" }] }, c));
    const s2 = (await ok.json()).state;
    expect(s2.onboarded).toBe(true);
    expect(s2.prefs.monthlyBudget).toBe(500);
  });

  it("new accounts start with a neutral profile", async () => {
    const c = await account("quinn@example.com");
    const s = (await (await getState(req("GET", undefined, c))).json()).state;
    expect(s.prefs.officeDays).toEqual([]);
    expect(s.prefs.protectedBlocks).toEqual([]);
    expect(s.prefs.homeNeighborhood).toBe("");
    expect(s.onboarded).toBe(false);
  });

  it("requires the invite code when one is set", async () => {
    process.env.SIGNUP_INVITE_CODE = "curate-2026";
    try {
      expect((await signup(req("POST", { email: "rae@example.com", password: "correct horse battery" }))).status).toBe(403);
      expect((await signup(req("POST", { email: "rae@example.com", password: "correct horse battery", inviteCode: "nope" }))).status).toBe(403);
      expect((await signup(req("POST", { email: "rae@example.com", password: "correct horse battery", inviteCode: "curate-2026" }))).status).toBe(201);
    } finally {
      delete process.env.SIGNUP_INVITE_CODE;
    }
  });
});

describe("scheduled weekly plans", () => {
  it("prepares a plan on the user's digest day, once per week", async () => {
    const { runScheduledPlans } = await import("@/server/service");
    const { localDate, weekdayOfDate } = await import("@/lib/domain/time");
    const c = await account("sam@example.com");
    const today = weekdayOfDate(localDate(Date.now(), "Europe/London"));
    await act(req("POST", { actions: [{ type: "setPrefs", prefs: { digestDay: today, digestEnabled: true } }, { type: "completeOnboarding" }] }, c));
    const first = await runScheduledPlans();
    expect(first.generated).toBeGreaterThanOrEqual(1);
    const state = (await (await getState(req("GET", undefined, c))).json()).state;
    expect(state.runs[0]).toMatchObject({ trigger: "scheduled", outcome: "generated" });
    const second = await runScheduledPlans();
    expect(second.generated).toBe(0);
  });
});
