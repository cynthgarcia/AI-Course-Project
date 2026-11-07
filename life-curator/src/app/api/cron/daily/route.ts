import { runAlerts } from "@/server/alerts";
import { cronAuthorized, error, json } from "@/server/http";
import { runScheduledPlans } from "@/server/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily, mid-afternoon London time: weekly plans for today's digest users, then alerts. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return error(401, "Not authorised.");
  const plans = await runScheduledPlans(Date.now(), 20_000);
  const alerts = await runAlerts(Date.now(), 30_000);
  return json({ plans, alerts });
}
