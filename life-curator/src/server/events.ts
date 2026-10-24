// Shared event catalogue. Each source's latest results live in the database (event_cache),
// so every server instance sees the same events and sources aren't re-fetched per request.
// Stale sources refresh in the background; a failed refresh keeps the previous results,
// which are marked possibly out of date after a day.
import { after } from "next/server";
import { dedupeEvents } from "@/lib/domain/dedupe";
import { DAY, HOUR } from "@/lib/domain/time";
import type { CuratorEvent } from "@/lib/domain/types";
import { collectEvents } from "@/lib/sources";
import type { EventSourceAdapter, SourceRunResult } from "@/lib/sources/types";
import { getDb } from "./db";
import { configuredSources } from "./sources";

export const REFRESH_AFTER = 3 * HOUR;
const STALE_AFTER = DAY;

export interface CatalogueRun extends SourceRunResult {
  stale: boolean;
}
export interface Catalogue {
  events: CuratorEvent[];
  runs: CatalogueRun[];
}

interface Row {
  source_id: string;
  events: CuratorEvent[];
  fetched_at: Date | string | null;
  last_attempt_at: Date | string | null;
  last_error: string | null;
}

const ms = (d: Date | string | null) => (d === null ? null : new Date(d).getTime());

/** Claims a source for refreshing (at most one instance every 5 minutes), then fetches it. */
async function refreshSource(src: EventSourceAdapter, now: number, force: boolean): Promise<void> {
  const db = await getDb();
  await db.query("insert into event_cache (source_id) values ($1) on conflict (source_id) do nothing", [src.id]);
  const claimed = await db.query(
    `update event_cache set last_attempt_at = now()
      where source_id = $1 and (last_attempt_at is null or last_attempt_at < now() - interval '5 minutes' or $2)
      returning source_id`,
    [src.id, force],
  );
  if (!claimed.length) {
    // Another instance is fetching. On a first-ever fetch, wait for it rather than serving nothing.
    for (let i = 0; i < 40; i++) {
      const [row] = await db.query<{ fetched_at: unknown; last_error: string | null }>("select fetched_at, last_error from event_cache where source_id = $1", [src.id]);
      if (!row || row.fetched_at !== null || row.last_error) return;
      await new Promise((res) => setTimeout(res, 250));
    }
    return;
  }
  const t = Math.floor(now / HOUR) * HOUR;
  const { events, runs } = await collectEvents({ from: t - 14 * DAY, to: t + 120 * DAY }, now, [src]);
  if (runs[0]?.ok) {
    await db.query("update event_cache set events = $2::text::jsonb, fetched_at = now(), last_error = null where source_id = $1", [src.id, JSON.stringify(events)]);
  } else {
    await db.query("update event_cache set last_error = $2 where source_id = $1", [src.id, runs[0]?.error ?? `${src.name} could not be loaded.`]);
  }
}

export async function refreshSources(sources: EventSourceAdapter[], now = Date.now(), force = false): Promise<void> {
  await Promise.all(sources.map((s) => refreshSource(s, now, force).catch(() => undefined)));
  memo = null;
}

let memo: { at: number; key: string; value: Catalogue } | null = null;

export async function buildCatalogue(sources: EventSourceAdapter[], now: number): Promise<Catalogue> {
  const db = await getDb();
  const ids = sources.map((s) => s.id);
  let rows = await db.query<Row>("select source_id, events, fetched_at, last_attempt_at, last_error from event_cache where source_id = any(string_to_array($1, ','))", [ids.join(",")]);
  const byId = new Map(rows.map((r) => [r.source_id, r]));

  // Never fetched: fetch now so the first visitor sees events.
  const missing = sources.filter((s) => ms(byId.get(s.id)?.fetched_at ?? null) === null && !byId.get(s.id)?.last_error);
  if (missing.length) {
    await refreshSources(missing, now);
    rows = await db.query<Row>("select source_id, events, fetched_at, last_attempt_at, last_error from event_cache where source_id = any(string_to_array($1, ','))", [ids.join(",")]);
  }
  // Due for a refresh: serve what we have, refresh after responding.
  const due = sources.filter((s) => {
    const f = ms(rows.find((r) => r.source_id === s.id)?.fetched_at ?? null);
    return f === null || now - f > REFRESH_AFTER;
  });
  if (due.length) {
    try {
      after(() => refreshSources(due));
    } catch {
      void refreshSources(due); // outside a request (scripts, tests)
    }
  }

  const all: CuratorEvent[] = [];
  const runs: CatalogueRun[] = [];
  for (const src of sources) {
    const row = rows.find((r) => r.source_id === src.id);
    const fetched = ms(row?.fetched_at ?? null);
    const stale = fetched !== null && now - fetched > STALE_AFTER;
    for (const e of row?.events ?? []) {
      if (Date.parse(e.start) < now - 14 * DAY) continue;
      all.push(stale && !e.isDemo ? { ...e, verification: { ...e.verification, status: "stale" } } : e);
    }
    runs.push({
      sourceId: src.id,
      ok: !!row && !row.last_error,
      count: row?.events.length ?? 0,
      error: row?.last_error ?? null,
      fetchedAt: fetched === null ? new Date(now).toISOString() : new Date(fetched).toISOString(),
      stale,
    });
  }
  return { events: dedupeEvents(all).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), runs };
}

/** Catalogue for the configured sources, memoised briefly per instance. */
export async function catalogue(now = Date.now()): Promise<Catalogue> {
  const sources = configuredSources().sources;
  const key = sources.map((s) => s.id).join(",");
  if (memo && memo.key === key && now - memo.at < 60_000) return memo.value;
  const value = await buildCatalogue(sources, now);
  // Only remember complete results, so a source still loading is retried on the next request.
  if (value.runs.every((r) => r.ok || r.error)) memo = { at: now, key, value };
  return value;
}
