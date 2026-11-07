import { getDb } from "@/server/db";
import { json } from "@/server/http";
import { configuredSources } from "@/server/sources";

export const dynamic = "force-dynamic";

function group(id: string): string {
  if (id === "ticketmaster" || id === "eventbrite") return "Ticketing";
  if (id.startsWith("luma-") || id.startsWith("ics")) return "Calendars & communities";
  if (id.startsWith("venue") || id.startsWith("page")) return "Venues";
  if (id === "scout") return "AI scout";
  return "Sample (fictional)";
}

/** Where events come from: every source, whether it's on, when it last updated and what it found. */
export async function GET() {
  const { sources, status } = configuredSources();
  let rows: { source_id: string; events: unknown[]; fetched_at: Date | string | null; last_error: string | null }[] = [];
  try {
    rows = await (await getDb()).query("select source_id, events, fetched_at, last_error from event_cache");
  } catch {
    // Database unavailable: still show what is configured.
  }
  const byId = new Map(rows.map((r) => [r.source_id, r]));
  const active = sources.map((s) => {
    const r = byId.get(s.id);
    return {
      id: s.id,
      name: s.name,
      group: group(s.id),
      active: true,
      events: r ? r.events.length : null,
      lastUpdated: r?.fetched_at ? new Date(r.fetched_at).toISOString() : null,
      problem: r?.last_error ?? null,
      note: null as string | null,
    };
  });
  const off = status
    .filter((s) => !s.configured)
    .map((s) => ({ id: s.id, name: s.name, group: group(s.id), active: false, events: null, lastUpdated: null, problem: null, note: s.note }));
  return json({ sources: [...active, ...off] });
}
