import { getDb } from "@/server/db";
import { removeConnection } from "@/server/googleCalendar";
import { currentUser, error, json, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

/** Disconnects: revokes access at Google and deletes the stored token and busy times. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  await removeConnection(await getDb(), user.id);
  return json({ ok: true });
}
