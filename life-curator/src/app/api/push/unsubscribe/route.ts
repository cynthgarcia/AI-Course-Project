import { getDb } from "@/server/db";
import { currentUser, error, json, readJson, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  const b = await readJson<{ endpoint?: unknown }>(req, 2_000);
  if (typeof b?.endpoint === "string") await (await getDb()).query("delete from push_subscriptions where endpoint = $1 and user_id = $2", [b.endpoint, user.id]);
  else await (await getDb()).query("delete from push_subscriptions where user_id = $1", [user.id]);
  return json({ ok: true });
}
