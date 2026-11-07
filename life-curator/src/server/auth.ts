// Email + password accounts with server-side sessions.
// Passwords: scrypt with a per-user salt. Sessions: random 256-bit tokens; only their
// SHA-256 hash is stored, so a database leak doesn't expose live sessions.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Queryable } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export const SESSION_COOKIE = "lc_session";
export const SESSION_DAYS = 30;
export const MIN_PASSWORD = 10;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used to keep login timing similar whether or not the email exists.
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  return dummyHash;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(q: Queryable, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await q.query(`insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [
    tokenHash(token),
    userId,
  ]);
  return token;
}

export interface SessionUser {
  id: string;
  email: string;
}

export async function userForToken(q: Queryable, token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const rows = await q.query<SessionUser>(
    "select u.id, u.email from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()",
    [tokenHash(token)],
  );
  return rows[0] ?? null;
}

export async function deleteSession(q: Queryable, token: string | undefined | null): Promise<void> {
  if (token) await q.query("delete from sessions where token_hash = $1", [tokenHash(token)]);
}
