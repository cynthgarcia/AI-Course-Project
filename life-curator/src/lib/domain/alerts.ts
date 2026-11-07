// Which events deserve an alert. Deterministic and deliberately sparing: things you follow,
// plus a couple of very strong matches that fit your calendar. Sample events never alert.
import { DAY, HOUR } from "./time";
import type { Recommendation } from "./ranking";
import type { CuratorEvent, LocalStatus, Preferences } from "./types";

export const MAX_FOLLOW_ALERTS = 5;
export const MAX_STRONG_ALERTS = 2;
const LOOKAHEAD = 60 * DAY;
const MIN_NOTICE = 12 * HOUR;

function fold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The first followed name that appears as a whole phrase in the event, or null. */
export function followMatch(e: CuratorEvent, follows: string[]): string | null {
  const hay = fold([e.title, e.description, e.organizer ?? "", e.venue.name, e.tags.join(" ")].join(" \n "));
  for (const f of follows) {
    const needle = fold(f.trim());
    if (needle.length < 2) continue;
    if (new RegExp(`(^|[^a-z0-9])${escape(needle)}($|[^a-z0-9])`).test(hay)) return f.trim();
  }
  return null;
}

export interface AlertCandidate {
  eventId: string;
  title: string;
  startsAt: string;
  reason: string;
  kind: "follow" | "strong";
}

export function pickAlerts(
  recs: Recommendation[],
  prefs: Preferences,
  now: number,
  statuses: Map<string, LocalStatus>,
  alreadyAlerted: Set<string>,
): AlertCandidate[] {
  if (!prefs.alertsEnabled) return [];
  const upcoming = recs.filter((r) => {
    const t = Date.parse(r.event.start);
    const st = statuses.get(r.event.id);
    return !r.event.isDemo && t > now + MIN_NOTICE && t < now + LOOKAHEAD && !alreadyAlerted.has(r.event.id) && st !== "not_for_me" && st !== "skipped";
  });

  const follow: AlertCandidate[] = [];
  for (const r of upcoming) {
    const name = followMatch(r.event, prefs.follows ?? []);
    if (!name) continue;
    // Following overrides calendar rules (you might rearrange for it), but we say so honestly.
    const clash = r.fit?.hardBlocked || r.trip?.hardBlocked;
    follow.push({ eventId: r.event.id, title: r.event.title, startsAt: r.event.start, reason: `You follow ${name}${clash ? " — it clashes with your calendar" : ""}.`, kind: "follow" });
  }

  const strong: AlertCandidate[] = prefs.alertStrongMatches
    ? upcoming
        .filter((r) => !follow.some((f) => f.eventId === r.event.id))
        .filter((r) => r.exclusions.length === 0 && r.matchedKeywords.length > 0 && (prefs.interests[r.event.category] ?? 0) >= 2 && r.breakdown.taste >= 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_STRONG_ALERTS)
        .map((r) => ({
          eventId: r.event.id,
          title: r.event.title,
          startsAt: r.event.start,
          reason: r.whyItFits[0] ?? `Matches ${r.matchedKeywords.join(", ")}.`,
          kind: "strong" as const,
        }))
    : [];

  return [...follow.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, MAX_FOLLOW_ALERTS), ...strong];
}
