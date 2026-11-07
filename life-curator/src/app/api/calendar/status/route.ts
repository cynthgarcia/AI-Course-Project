import { getDb } from "@/server/db";
import { connectionStatus } from "@/server/googleCalendar";
import { currentUser, error, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  return json(await connectionStatus(await getDb(), user.id));
}
