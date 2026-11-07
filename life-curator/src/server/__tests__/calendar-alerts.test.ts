import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as act } from "@/app/api/actions/route";
import { GET as start } from "@/app/api/calendar/google/start/route";
import { GET as callback } from "@/app/api/calendar/google/callback/route";
import { GET as busyRoute } from "@/app/api/calendar/busy/route";
import { POST as disconnect } from "@/app/api/calendar/google/disconnect/route";
import { POST as subscribe } from "@/app/api/push/subscribe/route";
import { GET as sourcesRoute } from "@/app/api/sources/route";
import { decrypt, encrypt } from "@/server/crypto";
import { getDb, resetDbForTests } from "@/server/db";
import { fetchBusy, FREEBUSY_SCOPE, ReconnectNeeded } from "@/server/googleCalendar";
import { alertsForUser } from "@/server/alerts";
import { ev } from "@/lib/domain/__tests__/helpers";

const ORIGIN = "http://localhost:3000";
let ip = 0;
function req(method: string, path: string, body?: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { host: "localhost:3000", origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `10.9.0.${++ip}` };
  if (cookie) headers.cookie = cookie;
  return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function account(email: string): Promise<string> {
  const res = await signup(req("POST", "/api/auth/signup", { email, password: "correct horse battery" }));
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}

beforeAll(() => {
  process.env.DATA_DIR = "memory://";
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.TOKEN_ENCRYPTION_KEY = "k".repeat(40);
  process.env.COOKIE_INSECURE = "1";
});
afterEach(() => vi.unstubAllGlobals());
afterAll(resetDbForTests);

describe("token encryption", () => {
  it("round-trips and rejects tampering", () => {
    const sealed = encrypt("refresh-123");
    expect(sealed).not.toContain("refresh-123");
    expect(decrypt(sealed)).toBe("refresh-123");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
});

describe("Google free/busy", () => {
  it("asks for 120 days in 30-day windows with a fresh access token", async () => {
    const calls: string[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      calls.push(String(url));
      if (String(url).includes("/token")) return new Response(JSON.stringify({ access_token: "at" }));
      const { timeMin } = JSON.parse(String(init!.body));
      return new Response(JSON.stringify({ calendars: { primary: { busy: [{ start: timeMin, end: new Date(Date.parse(timeMin) + 3600_000).toISOString() }] } } }));
    }) as unknown as typeof fetch;
    const busy = await fetchBusy("rt", Date.parse("2026-11-07T12:00:00Z"), f);
    expect(calls.filter((c) => c.includes("freeBusy"))).toHaveLength(4);
    expect(busy).toHaveLength(4);
  });

  it("asks to reconnect when Google revokes access", async () => {
    const f = (async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })) as unknown as typeof fetch;
    await expect(fetchBusy("rt", Date.now(), f)).rejects.toBeInstanceOf(ReconnectNeeded);
  });
});

describe("connecting Google Calendar", () => {
  it("runs the consent flow with state + PKCE, stores the token encrypted, and disconnects", async () => {
    const c = await account("cal@example.com");
    const res = await start(req("GET", "/api/calendar/google/start", undefined, c));
    expect(res.status).toBe(303);
    const google = new URL(res.headers.get("location")!);
    expect(google.host).toBe("accounts.google.com");
    expect(google.searchParams.get("scope")).toBe(FREEBUSY_SCOPE);
    expect(google.searchParams.get("code_challenge_method")).toBe("S256");
    const oauthCookie = (res.headers.get("set-cookie") ?? "").split(";")[0]!;
    const state = google.searchParams.get("state")!;

    // Wrong state is refused.
    const bad = await callback(req("GET", `/api/calendar/google/callback?code=abc&state=nope`, undefined, `${c}; ${oauthCookie}`));
    expect(bad.headers.get("location")).toContain("calendar=error");

    vi.stubGlobal("fetch", async (url: string) => {
      if (String(url).includes("/token")) return new Response(JSON.stringify({ refresh_token: "real-refresh-token", access_token: "at", scope: FREEBUSY_SCOPE }));
      if (String(url).includes("freeBusy")) return new Response(JSON.stringify({ calendars: { primary: { busy: [{ start: "2026-11-20T18:00:00Z", end: "2026-11-20T21:00:00Z" }] } } }));
      return new Response("{}");
    });
    const ok = await callback(req("GET", `/api/calendar/google/callback?code=abc&state=${state}`, undefined, `${c}; ${oauthCookie}`));
    expect(ok.headers.get("location")).toContain("calendar=connected");

    const db = await getDb();
    const [row] = await db.query<{ refresh_token_enc: string }>("select refresh_token_enc from calendar_connections");
    expect(row!.refresh_token_enc).not.toContain("real-refresh-token");

    const busy = await (await busyRoute(req("GET", "/api/calendar/busy", undefined, c))).json();
    expect(busy.calendar.mode).toBe("live");
    expect(busy.calendar.busy).toHaveLength(4); // same interval returned for each window in this fake
    expect(JSON.stringify(busy)).not.toMatch(/refresh|summary|title/);

    await disconnect(req("POST", "/api/calendar/google/disconnect", {}, c));
    expect(await db.query("select 1 from calendar_connections")).toHaveLength(0);
    const after = await (await busyRoute(req("GET", "/api/calendar/busy", undefined, c))).json();
    expect(after.calendar).toBeNull();
  });

  it("won't switch to Google without a connection", async () => {
    const c = await account("nocal@example.com");
    expect((await act(req("POST", "/api/actions", { type: "setCalendarMode", mode: "google" }, c))).status).toBe(409);
  });
});

describe("alerts and notifications", () => {
  it("records follow alerts once, pushes one summary, and forgets dead devices", async () => {
    const c = await account("alerts@example.com");
    await act(req("POST", "/api/actions", { actions: [{ type: "setPrefs", prefs: { follows: ["Kurt Elling"] } }, { type: "completeOnboarding" }] }, c));
    const sub = { endpoint: "https://push.example/sub-1", keys: { p256dh: "p".repeat(20), auth: "a".repeat(12) } };
    expect((await subscribe(req("POST", "/api/push/subscribe", sub, c))).status).toBe(200);
    expect((await subscribe(req("POST", "/api/push/subscribe", { ...sub, endpoint: "http://insecure.example" }, c))).status).toBe(400);

    const db = await getDb();
    const [{ id }] = (await db.query<{ id: string }>("select id from users where email = 'alerts@example.com'")) as [{ id: string }];
    const shared = [ev({ id: `tm-${randomUUID()}`, title: "Kurt Elling Quartet", start: new Date(Date.now() + 10 * 86_400_000).toISOString() })];
    const sent: string[] = [];
    const send = async (_s: unknown, payload: string) => {
      sent.push(payload);
    };
    expect(await alertsForUser(db, id, shared, Date.now(), send)).toEqual({ created: 1, pushed: 1 });
    expect(JSON.parse(sent[0]!).body).toMatch(/You follow Kurt Elling/);
    expect(await alertsForUser(db, id, shared, Date.now(), send)).toEqual({ created: 0, pushed: 0 });

    const gone = async () => {
      throw Object.assign(new Error("gone"), { statusCode: 410 });
    };
    const more = [ev({ id: `tm-${randomUUID()}`, title: "Kurt Elling Trio", start: new Date(Date.now() + 12 * 86_400_000).toISOString() })];
    expect((await alertsForUser(db, id, more, Date.now(), gone)).pushed).toBe(0);
    expect(await db.query("select 1 from push_subscriptions where user_id = $1", [id])).toHaveLength(0);
  });

  it("lists every source with its status", async () => {
    const b = await (await sourcesRoute()).json();
    const groups = new Set(b.sources.map((s: { group: string }) => s.group));
    expect(groups.has("Ticketing")).toBe(true);
    expect(b.sources.find((s: { id: string }) => s.id === "ticketmaster").active).toBe(false);
  });
});
