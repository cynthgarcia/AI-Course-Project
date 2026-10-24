import { catalogue } from "@/server/events";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Public event catalogue (no user data). */
export async function GET() {
  const { events, runs } = await catalogue();
  return json({ events, runs });
}
