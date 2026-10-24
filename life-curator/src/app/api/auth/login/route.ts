import { createSession, dummyPasswordHash, verifyPassword } from "@/server/auth";
import { getDb } from "@/server/db";
import { clientKey, error, json, rateLimited, readJson, sameOrigin, sessionCookie } from "@/server/http";
import { credentials } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const parsed = credentials.safeParse(await readJson(req, 4_000));
  if (!parsed.success) return error(400, "Enter your email and password.");
  const { email, password } = parsed.data;
  if (rateLimited(`login:${clientKey(req)}:${email}`, 8, 15 * 60_000)) return error(429, "Too many attempts. Wait a few minutes and try again.");

  const db = await getDb();
  const [user] = await db.query<{ id: string; password_hash: string }>("select id, password_hash from users where email = $1", [email]);
  const ok = await verifyPassword(password, user?.password_hash ?? (await dummyPasswordHash()));
  if (!user || !ok) return error(401, "That email and password don't match.");
  const token = await createSession(db, user.id);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
}
