import { getDb } from "@/server/db";
import { liveCalendar } from "@/server/googleCalendar";
import { currentUser, error, json } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Busy times only (start and end) for the signed-in user's connected calendar. */
export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  const cal = await liveCalendar(await getDb(), user.id);
  return cal ? json({ calendar: { ...cal, busy: cal.busy.map((b) => ({ start: b.start, end: b.end })) } }) : json({ calendar: null, reconnect: true });
}
