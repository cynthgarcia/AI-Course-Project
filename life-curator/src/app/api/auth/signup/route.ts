import { timingSafeEqual } from "node:crypto";
import { createSession, hashPassword, MIN_PASSWORD } from "@/server/auth";
import { getDb } from "@/server/db";
import { clientKey, error, json, rateLimited, readJson, sameOrigin, sessionCookie } from "@/server/http";
import { createProfile } from "@/server/repo";
import { credentials } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  if (await rateLimited(`signup:${clientKey(req)}`, Number(process.env.SIGNUP_RATE_LIMIT ?? 10), 60 * 60_000)) return error(429, "Too many sign-ups from here. Try again later.");
  const raw = await readJson<Record<string, unknown>>(req, 4_000);
  // Private beta: when SIGNUP_INVITE_CODE is set, only people with the code can join.
  const code = process.env.SIGNUP_INVITE_CODE;
  if (code) {
    const given = Buffer.from(typeof raw?.inviteCode === "string" ? raw.inviteCode.trim() : "");
    const expected = Buffer.from(code);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return error(403, "That invite code isn't right. Ask whoever invited you for the code.");
  }
  const parsed = credentials.safeParse(raw);
  if (!parsed.success) return error(400, "Enter a valid email and password.");
  const { email, password } = parsed.data;
  if (password.length < MIN_PASSWORD) return error(400, `Use at least ${MIN_PASSWORD} characters for your password.`);

  const db = await getDb();
  const hash = await hashPassword(password);
  const token = await db.transaction(async (q) => {
    const [user] = await q.query<{ id: string }>("insert into users (email, password_hash) values ($1, $2) on conflict (email) do nothing returning id", [email, hash]);
    if (!user) return null;
    await createProfile(q, user.id);
    return createSession(q, user.id);
  });
  if (!token) return error(409, "An account with that email already exists. Try signing in.");
  return json({ ok: true }, 201, { "set-cookie": sessionCookie(token) });
}
