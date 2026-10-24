import { catalogue } from "@/server/events";
import { json } from "@/server/http";
import { configuredSources } from "@/server/sources";

export const dynamic = "force-dynamic";

/** Public event catalogue (no user data). */
export async function GET() {
  const { events, runs } = await catalogue();
  return json({ events, runs, sources: configuredSources().status });
}
