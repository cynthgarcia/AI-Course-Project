// Source registry: runs each adapter independently, so one failing source never
// takes down the others, then normalizes and deduplicates the combined result.
import { dedupeEvents } from "@/lib/domain/dedupe";
import type { CuratorEvent } from "@/lib/domain/types";
import { demoSources } from "./demo";
import type { EventSourceAdapter, SourceRange, SourceRunResult } from "./types";

export async function collectEvents(
  range: SourceRange,
  now: number,
  sources: EventSourceAdapter[] = demoSources,
): Promise<{ events: CuratorEvent[]; runs: SourceRunResult[] }> {
  const runs: SourceRunResult[] = [];
  const all: CuratorEvent[] = [];
  const results = await Promise.allSettled(sources.map((s) => s.fetchEvents(range, now)));
  results.forEach((r, i) => {
    const src = sources[i]!;
    const fetchedAt = new Date(now).toISOString();
    if (r.status === "fulfilled") {
      all.push(...r.value);
      runs.push({ sourceId: src.id, ok: true, count: r.value.length, error: null, fetchedAt });
    } else {
      runs.push({ sourceId: src.id, ok: false, count: 0, error: `${src.name} could not be loaded.`, fetchedAt });
    }
  });
  const events = dedupeEvents(all).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return { events, runs };
}
