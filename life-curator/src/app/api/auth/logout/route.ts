import { deleteSession, SESSION_COOKIE } from "@/server/auth";
import { getDb } from "@/server/db";
import { error, json, readCookie, sameOrigin, sessionCookie } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  await deleteSession(await getDb(), readCookie(req, SESSION_COOKIE));
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(null) });
}
