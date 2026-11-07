import { getDb } from "@/server/db";
import { currentUser, error, json, rateLimited, sameOrigin } from "@/server/http";
import { pushToUser } from "@/server/push";

export const dynamic = "force-dynamic";

/** Sends a test notification to the user's own devices. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  if (await rateLimited(`push-test:${user.id}`, 5, 60 * 60_000)) return error(429, "That's enough tests for now.");
  const n = await pushToUser(await getDb(), user.id, { title: "OffHours alerts are on", body: "You'll hear from us when something you'd love comes up.", url: "/alerts", tag: "test" });
  return json({ delivered: n });
}
