import { formatMoney } from "@/lib/domain/budget";
import { formatShortDay, formatTime } from "@/lib/domain/time";
import type { CostItem, CuratorEvent, Verification } from "@/lib/domain/types";

export function whenLabel(e: CuratorEvent, homeTz: string): string {
  const start = Date.parse(e.start);
  const tz = e.timezone || homeTz;
  const day = formatShortDay(start, tz);
  const range = e.end ? `${formatTime(start, tz)}–${formatTime(Date.parse(e.end), tz)}` : formatTime(start, tz);
  return tz === homeTz ? `${day} · ${range}` : `${day} · ${range} local time`;
}

export function placeLabel(e: CuratorEvent): string {
  const where = e.venue.city === "London" ? e.venue.neighborhood : `${e.venue.city}, ${e.venue.country}`;
  return [e.venue.name, where].filter(Boolean).join(" · ");
}

export function verificationLabel(v: Verification): string {
  switch (v.status) {
    case "demo":
      return "Sample event — fictional";
    case "verified":
      return v.lastVerifiedAt ? `Verified ${new Date(v.lastVerifiedAt).toLocaleDateString("en-GB")}` : "Verified";
    case "stale":
      return "Information may be out of date";
    default:
      return "Not yet verified";
  }
}

export function costLabel(c: CostItem | null | undefined): string {
  if (!c) return "Not set";
  if (c.basis === "not_needed") return "Not needed";
  if (c.amount === null) return "Unknown — needs research";
  const tag = c.basis === "sample" ? " (sample)" : c.basis === "user_estimate" ? " (your estimate)" : c.basis === "verified" ? "" : "";
  return `${formatMoney(c.amount, c.currency)}${tag}`;
}

export function durationMinutes(e: CuratorEvent): number | null {
  return e.end ? Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60_000) : null;
}

export const CATEGORY_TINT: Record<string, string> = {
  music: "#6d3b52",
  theatre: "#7b2d3b",
  art: "#3d5a6c",
  film: "#3b3b52",
  sports: "#2f6a45",
  literature: "#6b5a2e",
  tech: "#2d4a6b",
  investing: "#40553a",
  social: "#8a4b2a",
  creative: "#8a5a00",
  wellness: "#4a6b63",
  faith: "#5b4a6b",
  food: "#8a3e2a",
  other: "#555",
};
