// Event deduplication across sources. Separate performances (different start times)
// stay as separate occurrences; only true duplicates are merged.
import type { CuratorEvent } from "./types";

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/.test(k)) u.searchParams.delete(k);
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}${u.search}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Keys that identify the same occurrence. Any shared key means duplicate. */
export function dedupeKeys(e: CuratorEvent): string[] {
  const keys: string[] = [];
  for (const r of e.sourceRecords) if (r.externalId) keys.push(`ext:${r.sourceId}:${r.externalId}`);
  const url = canonicalUrl(e.officialUrl);
  // A URL alone may cover several performances, so combine it with the start time.
  if (url) keys.push(`url:${url}@${e.start}`);
  keys.push(`tvs:${normalizeTitle(e.title)}|${normalizeTitle(e.venue.name)}|${e.start}`);
  return keys;
}

const VERIFICATION_RANK = { verified: 3, unverified: 2, stale: 1, demo: 0 } as const;

function merge(a: CuratorEvent, b: CuratorEvent): CuratorEvent {
  // Keep the better-verified record as primary; union the source records.
  const [primary, secondary] = VERIFICATION_RANK[b.verification.status] > VERIFICATION_RANK[a.verification.status] ? [b, a] : [a, b];
  const seen = new Set(primary.sourceRecords.map((r) => `${r.sourceId}|${r.externalId}|${r.url}`));
  const extra = secondary.sourceRecords.filter((r) => !seen.has(`${r.sourceId}|${r.externalId}|${r.url}`));
  return {
    ...primary,
    officialUrl: primary.officialUrl ?? secondary.officialUrl,
    bookingUrl: primary.bookingUrl ?? secondary.bookingUrl,
    sourceRecords: [...primary.sourceRecords, ...extra],
  };
}

export function dedupeEvents(events: CuratorEvent[]): CuratorEvent[] {
  const out: CuratorEvent[] = [];
  const keyIndex = new Map<string, number>();
  for (const e of events) {
    const keys = dedupeKeys(e);
    const hit = keys.map((k) => keyIndex.get(k)).find((i) => i !== undefined);
    if (hit === undefined) {
      out.push(e);
      keys.forEach((k) => keyIndex.set(k, out.length - 1));
    } else {
      out[hit] = merge(out[hit]!, e);
      dedupeKeys(out[hit]!).forEach((k) => keyIndex.set(k, hit));
      keys.forEach((k) => keyIndex.set(k, hit));
    }
  }
  return out;
}
