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
