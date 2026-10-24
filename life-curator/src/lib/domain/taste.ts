// Taste profile learned from star ratings. Deterministic and explainable: each signal is
// an average rating, shrunk towards neutral when there are only a few ratings, so one
// great or bad night never dominates. Taste only nudges ranking; it never overrides
// hard constraints (calendar, protected time, eligibility).
import { CATEGORY_LABELS, type Category, type CuratorEvent, type Experience } from "./types";

export interface TasteStat {
  avg: number;
  count: number;
}

export interface TasteProfile {
  byCategory: Map<Category, TasteStat>;
  byTag: Map<string, TasteStat>;
  ratedCount: number;
}

/** Ratings needed before a signal counts at half strength. */
const SHRINK = 2;

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function buildTaste(experiences: Experience[]): TasteProfile {
  const cat = new Map<Category, { sum: number; count: number }>();
  const tag = new Map<string, { sum: number; count: number }>();
  let ratedCount = 0;
  for (const x of experiences) {
    if (x.rating === null || x.source === "sample") continue;
    ratedCount++;
    const c = cat.get(x.category) ?? { sum: 0, count: 0 };
    cat.set(x.category, { sum: c.sum + x.rating, count: c.count + 1 });
    for (const t of new Set(x.tags.map(normalizeTag))) {
      if (!t) continue;
      const v = tag.get(t) ?? { sum: 0, count: 0 };
      tag.set(t, { sum: v.sum + x.rating, count: v.count + 1 });
    }
  }
  const toStats = <K,>(m: Map<K, { sum: number; count: number }>) =>
    new Map([...m].map(([k, v]) => [k, { avg: v.sum / v.count, count: v.count }] as const));
  return { byCategory: toStats(cat), byTag: toStats(tag), ratedCount };
}

/** -1 (consistently 1★) … 0 (neutral / no data) … +1 (consistently 5★). */
function signal(stat: TasteStat | undefined): number {
  if (!stat) return 0;
  return ((stat.avg - 3) / 2) * (stat.count / (stat.count + SHRINK));
}

export interface TasteMatch {
  /** 0–1 where 0.5 is neutral. */
  score: number;
  reason: string | null;
}

export function tasteMatch(e: CuratorEvent, taste: TasteProfile): TasteMatch {
  const catStat = taste.byCategory.get(e.category);
  const cat = signal(catStat);
  const tagSignals = e.tags
    .map((t) => ({ t: normalizeTag(t), s: taste.byTag.get(normalizeTag(t)) }))
    .filter((x): x is { t: string; s: TasteStat } => !!x.s);
  const tags = tagSignals.length ? tagSignals.reduce((a, x) => a + signal(x.s), 0) / tagSignals.length : 0;
  const score = Math.max(0, Math.min(1, 0.5 + 0.35 * cat + 0.15 * tags));

  let reason: string | null = null;
  const bestTag = [...tagSignals].sort((a, b) => signal(b.s) - signal(a.s))[0];
  if (bestTag && signal(bestTag.s) >= 0.2 && bestTag.s.count >= 2) {
    reason = `You've rated ${bestTag.s.count} ${bestTag.t} experiences ${bestTag.s.avg.toFixed(1)}★ on average.`;
  } else if (catStat && cat >= 0.2) {
    reason = `You've rated ${catStat.count} ${CATEGORY_LABELS[e.category].toLowerCase()} experiences ${catStat.avg.toFixed(1)}★ on average.`;
  }
  return { score, reason };
}
