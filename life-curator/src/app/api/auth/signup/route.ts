import { createSession, hashPassword, MIN_PASSWORD } from "@/server/auth";
import { getDb } from "@/server/db";
import { clientKey, error, json, rateLimited, readJson, sameOrigin, sessionCookie } from "@/server/http";
import { createProfile } from "@/server/repo";
import { credentials } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  if (rateLimited(`signup:${clientKey(req)}`, Number(process.env.SIGNUP_RATE_LIMIT ?? 10), 60 * 60_000)) return error(429, "Too many sign-ups from here. Try again later.");
  const parsed = credentials.safeParse(await readJson(req, 4_000));
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
