import { getDb } from "@/server/db";
import { currentUser, error, json, sameOrigin, sessionCookie } from "@/server/http";

export const dynamic = "force-dynamic";

/** Permanently deletes the account and everything linked to it (cascades). */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  await (await getDb()).query("delete from users where id = $1", [user.id]);
  return json({ ok: true }, 200, { "set-cookie": sessionCookie(null) });
}
