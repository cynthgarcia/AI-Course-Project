import { refreshSources } from "@/server/events";
import { cronAuthorized, error, json } from "@/server/http";
import { configuredSources } from "@/server/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily refresh of every configured event source (also refreshed on demand when stale). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return error(401, "Not authorised.");
  const { sources } = configuredSources();
  await refreshSources(sources, Date.now(), true);
  return json({ ok: true, sources: sources.map((s) => s.id) });
}
