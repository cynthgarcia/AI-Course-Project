import { cronAuthorized, error, json } from "@/server/http";
import { runScheduledPlans } from "@/server/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily: prepares weekly plans for users whose digest day is today. Sends nothing. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return error(401, "Not authorised.");
  return json(await runScheduledPlans());
}
