// Event-source adapter contract. Each provider (venue calendar, permitted API, ICS feed…)
// implements this independently so sources can be added or replaced in isolation.
import type { CuratorEvent } from "@/lib/domain/types";

export interface SourceRange {
  from: number; // epoch ms
  to: number;
}

export interface EventSourceAdapter {
  id: string;
  name: string;
  kind: "demo" | "api" | "ics" | "rss" | "venue_calendar";
  /** True for sample data that must never be presented as real. */
  isDemo: boolean;
  /** How often to refresh, in hours (default 3). */
  refreshHours?: number;
  /** Slow sources (e.g. reading many venue pages) are never fetched while a user waits. */
  backgroundOnly?: boolean;
  fetchEvents(range: SourceRange, now: number): Promise<CuratorEvent[]>;
}

export interface SourceRunResult {
  sourceId: string;
  ok: boolean;
  count: number;
  /** Safe, user-presentable summary — never raw responses or credentials. */
  error: string | null;
  fetchedAt: string;
}
