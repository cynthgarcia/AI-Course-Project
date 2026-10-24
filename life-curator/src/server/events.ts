// Server-side event catalogue, refreshed at most hourly. Each source runs independently;
// if one fails, its last good results are kept and marked as possibly out of date.
import { dedupeEvents } from "@/lib/domain/dedupe";
import { DAY } from "@/lib/domain/time";
import type { CuratorEvent } from "@/lib/domain/types";
import { collectEvents } from "@/lib/sources";
import type { EventSourceAdapter, SourceRunResult } from "@/lib/sources/types";
import { configuredSources } from "./sources";

interface Catalogue {
  events: CuratorEvent[];
  runs: (SourceRunResult & { stale: boolean })[];
}

const lastGood = new Map<string, { events: CuratorEvent[]; fetchedAt: string }>();
let cache: { hour: number; value: Promise<Catalogue> } | null = null;

export async function buildCatalogue(sources: EventSourceAdapter[], now: number): Promise<Catalogue> {
  const t = Math.floor(now / 3_600_000) * 3_600_000;
  const range = { from: t - 14 * DAY, to: t + 120 * DAY };
  const all: CuratorEvent[] = [];
  const runs: Catalogue["runs"] = [];
  await Promise.all(
    sources.map(async (src) => {
      const { events, runs: [run] } = await collectEvents(range, now, [src]);
      if (run?.ok) {
        lastGood.set(src.id, { events, fetchedAt: run.fetchedAt });
        all.push(...events);
        runs.push({ ...run, stale: false });
      } else {
        const prev = lastGood.get(src.id);
        if (prev) all.push(...prev.events.map((e) => ({ ...e, verification: { ...e.verification, status: e.isDemo ? e.verification.status : ("stale" as const) } })));
        runs.push({ ...(run ?? { sourceId: src.id, ok: false, count: 0, error: `${src.name} could not be loaded.`, fetchedAt: new Date(now).toISOString() }), stale: !!prev });
      }
    }),
  );
  return { events: dedupeEvents(all).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), runs };
}

export function catalogue(now = Date.now()): Promise<Catalogue> {
  const hour = Math.floor(now / 3_600_000);
  if (!cache || cache.hour !== hour) cache = { hour, value: buildCatalogue(configuredSources().sources, now) };
  return cache.value;
}
