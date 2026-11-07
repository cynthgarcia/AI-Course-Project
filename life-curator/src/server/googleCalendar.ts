// Google Calendar, read-only free/busy. The app asks for one scope — see your
// availability — so it never sees event titles, details or guests, and cannot change
// anything in the calendar. "Add to calendar" uses pre-filled links instead.
import { createHash, randomBytes } from "node:crypto";
import { DAY, MINUTE } from "@/lib/domain/time";
import type { CalendarSnapshot, Interval } from "@/lib/domain/types";
import { decrypt, encrypt, encryptionConfigured } from "./crypto";
import type { Queryable } from "./db";

export const FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";
export const BUSY_TTL_MS = 15 * MINUTE;
const WINDOW_DAYS = 30;
const WINDOWS = 4; // 120 days ahead, asked for in 30-day pieces

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && encryptionConfigured();
}

export function appOrigin(req: Request): string {
  return (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/+$/, "");
}

export function redirectUri(req: Request): string {
  return `${appOrigin(req)}/api/calendar/google/callback`;
}

/** State + PKCE for one sign-in attempt. Both are kept in a short-lived HttpOnly cookie. */
export function newAuthAttempt(): { state: string; verifier: string; challenge: string } {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { state, verifier, challenge };
}

export function authUrl(req: Request, state: string, challenge: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: FREEBUSY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${p}`;
}

type Fetch = typeof fetch;

export async function exchangeCode(req: Request, code: string, verifier: string, fetchImpl: Fetch = fetch): Promise<{ refreshToken: string; scope: string }> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { refresh_token?: string; scope?: string };
  if (!res.ok || !body.refresh_token) throw new Error("Google sign-in didn't complete.");
  if (!(body.scope ?? "").split(" ").includes(FREEBUSY_SCOPE)) throw new Error("Calendar access wasn't granted.");
  return { refreshToken: body.refresh_token, scope: body.scope! };
}

export class ReconnectNeeded extends Error {}

async function accessToken(refreshToken: string, fetchImpl: Fetch): Promise<string> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (body.error === "invalid_grant") throw new ReconnectNeeded("Google Calendar access has expired or was removed.");
  if (!res.ok || !body.access_token) throw new Error("Couldn't refresh Google Calendar access.");
  return body.access_token;
}

/** Busy intervals across the next 120 days from the user's primary calendar. */
export async function fetchBusy(refreshToken: string, now: number, fetchImpl: Fetch = fetch): Promise<Interval[]> {
  const token = await accessToken(refreshToken, fetchImpl);
  const start = now - DAY;
  const out: Interval[] = [];
  for (let i = 0; i < WINDOWS; i++) {
    const timeMin = new Date(start + i * WINDOW_DAYS * DAY).toISOString();
    const timeMax = new Date(start + (i + 1) * WINDOW_DAYS * DAY).toISOString();
    const res = await fetchImpl(FREEBUSY_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) throw new ReconnectNeeded("Google Calendar access was removed.");
    if (!res.ok) throw new Error(`Google Calendar responded ${res.status}`);
    const body = (await res.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> };
    const cal = body.calendars?.primary;
    if (cal?.errors?.length) throw new Error("Google Calendar couldn't share availability.");
    for (const b of cal?.busy ?? []) {
      const s = Date.parse(b.start);
      const e = Date.parse(b.end);
      if (Number.isFinite(s) && Number.isFinite(e) && e > s) out.push({ start: s, end: e });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export async function revoke(refreshToken: string, fetchImpl: Fetch = fetch): Promise<void> {
  await fetchImpl(`${REVOKE_URL}?${new URLSearchParams({ token: refreshToken })}`, { method: "POST", signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
}

interface ConnectionRow {
  refresh_token_enc: string;
  busy: { start: number; end: number }[];
  busy_fetched_at: Date | string | null;
  last_error: string | null;
  connected_at: Date | string;
}

export async function saveConnection(q: Queryable, userId: string, refreshToken: string, scope: string): Promise<void> {
  await q.query(
    `insert into calendar_connections (user_id, refresh_token_enc, scope, connected_at, busy, busy_fetched_at, last_error)
     values ($1, $2, $3, now(), '[]'::jsonb, null, null)
     on conflict (user_id) do update set refresh_token_enc = excluded.refresh_token_enc, scope = excluded.scope,
       connected_at = now(), busy = '[]'::jsonb, busy_fetched_at = null, last_error = null`,
    [userId, encrypt(refreshToken), scope],
  );
  await q.query("update profiles set calendar_mode = 'google', updated_at = now() where user_id = $1", [userId]);
}

export interface CalendarStatus {
  available: boolean;
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  needsReconnect: boolean;
}

export async function connectionStatus(q: Queryable, userId: string): Promise<CalendarStatus> {
  const [row] = await q.query<ConnectionRow>("select refresh_token_enc, busy, busy_fetched_at, last_error, connected_at from calendar_connections where user_id = $1", [userId]);
  return {
    available: googleConfigured(),
    connected: !!row,
    connectedAt: row ? new Date(row.connected_at).toISOString() : null,
    lastSyncedAt: row?.busy_fetched_at ? new Date(row.busy_fetched_at).toISOString() : null,
    needsReconnect: row?.last_error === "reconnect",
  };
}

/**
 * The user's live calendar for scheduling: cached busy times, refreshed when older than
 * 15 minutes. Returns null when not connected or access needs renewing.
 */
export async function liveCalendar(q: Queryable, userId: string, now = Date.now(), fetchImpl: Fetch = fetch): Promise<CalendarSnapshot | null> {
  const [row] = await q.query<ConnectionRow>("select refresh_token_enc, busy, busy_fetched_at, last_error, connected_at from calendar_connections where user_id = $1", [userId]);
  if (!row || row.last_error === "reconnect") return null;
  const fetched = row.busy_fetched_at ? new Date(row.busy_fetched_at).getTime() : null;
  if (fetched !== null && now - fetched < BUSY_TTL_MS) {
    return { mode: "live", busy: row.busy, fetchedAt: new Date(fetched).toISOString() };
  }
  if (!googleConfigured()) return fetched === null ? null : { mode: "live", busy: row.busy, fetchedAt: new Date(fetched).toISOString() };
  try {
    const busy = await fetchBusy(decrypt(row.refresh_token_enc), now, fetchImpl);
    await q.query("update calendar_connections set busy = $2::text::jsonb, busy_fetched_at = now(), last_error = null where user_id = $1", [userId, JSON.stringify(busy)]);
    return { mode: "live", busy, fetchedAt: new Date(now).toISOString() };
  } catch (e) {
    if (e instanceof ReconnectNeeded) {
      await q.query("update calendar_connections set last_error = 'reconnect' where user_id = $1", [userId]);
      return null;
    }
    await q.query("update calendar_connections set last_error = 'temporary' where user_id = $1", [userId]);
    // A temporary failure keeps the last known busy times rather than pretending you're free.
    return fetched === null ? null : { mode: "live", busy: row.busy, fetchedAt: new Date(fetched).toISOString() };
  }
}

export async function removeConnection(q: Queryable, userId: string, fetchImpl: Fetch = fetch): Promise<void> {
  const [row] = await q.query<{ refresh_token_enc: string }>("select refresh_token_enc from calendar_connections where user_id = $1", [userId]);
  if (row) {
    try {
      await revoke(decrypt(row.refresh_token_enc), fetchImpl);
    } catch {
      // Still delete locally even if Google can't be reached.
    }
  }
  await q.query("delete from calendar_connections where user_id = $1", [userId]);
  await q.query("update profiles set calendar_mode = 'disconnected', updated_at = now() where user_id = $1 and calendar_mode = 'google'", [userId]);
}
