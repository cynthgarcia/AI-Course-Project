// Shared request/response helpers for API routes.
import { SESSION_COOKIE, SESSION_DAYS, userForToken, type SessionUser } from "./auth";
import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function sessionCookie(token: string | null): string {
  const secure = process.env.COOKIE_INSECURE === "1" ? "" : "; Secure";
  return token
    ? `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`
    : `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/** Rejects cross-site state-changing requests (in addition to SameSite cookies). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson<T = unknown>(req: Request, maxBytes = 256_000): Promise<T | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function currentUser(req: Request): Promise<SessionUser | null> {
  const db = await getDb();
  return userForToken(db, readCookie(req, SESSION_COOKIE));
}

/**
 * Fixed-window rate limit stored in the database, so it holds across server instances.
 * Keys are hashed: no emails or IP addresses are stored.
 */
export async function rateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const db = await getDb();
  const hashed = createHash("sha256").update(key).digest("hex");
  const [row] = await db.query<{ count: number }>(
    `insert into rate_limits (key, count, reset_at) values ($1, 1, now() + ($2::int * interval '1 millisecond'))
     on conflict (key) do update set
       count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
       reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
     returning count`,
    [hashed, windowMs],
  );
  if (Math.random() < 0.02) await db.query("delete from rate_limits where reset_at < now() - interval '1 day'");
  return (row?.count ?? 0) > limit;
}

export function clientKey(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0]!.trim();
}

/** Scheduled jobs: Vercel Cron sends "Authorization: Bearer $CRON_SECRET". */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
