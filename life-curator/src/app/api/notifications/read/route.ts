import { getDb } from "@/server/db";
import { currentUser, error, json, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  await (await getDb()).query("update notifications set read_at = now() where user_id = $1 and read_at is null", [user.id]);
  return json({ ok: true });
}
