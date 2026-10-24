// Server-side event catalogue, refreshed at most hourly.
import { DAY } from "@/lib/domain/time";
import type { CuratorEvent } from "@/lib/domain/types";
import { collectEvents } from "@/lib/sources";
import type { SourceRunResult } from "@/lib/sources/types";

let cache: { hour: number; value: Promise<{ events: CuratorEvent[]; runs: SourceRunResult[] }> } | null = null;

export function catalogue(now = Date.now()) {
  const hour = Math.floor(now / 3_600_000);
  if (!cache || cache.hour !== hour) {
    const t = hour * 3_600_000;
    cache = { hour, value: collectEvents({ from: t - 14 * DAY, to: t + 120 * DAY }, t) };
  }
  return cache.value;
}
