"use client";

import { addDays, formatShortDay, localDate, overlaps, zonedToEpoch } from "@/lib/domain/time";
import { useStore } from "@/lib/store/AppStore";

type DayState = "busy" | "personal_time" | "keep_open_for_friends" | "open_to_suggestions" | "free" | "unknown";

const STYLE: Record<DayState, { label: string; cls: string }> = {
  busy: { label: "Busy", cls: "bg-line text-muted" },
  personal_time: { label: "Personal", cls: "bg-info-soft text-info" },
  keep_open_for_friends: { label: "Friends", cls: "bg-accent-soft text-accent" },
  open_to_suggestions: { label: "Open", cls: "bg-ok-soft text-ok" },
  free: { label: "Free", cls: "bg-card text-ink border border-line" },
  unknown: { label: "Unknown", cls: "bg-card text-muted border border-dashed border-line" },
};

/** Evening (18:30–22:30) status for the next 7 days. Busy wins over protected labels. */
export function WeekStrip() {
  const { derived, state } = useStore();
  if (!derived) return null;
  const tz = state.prefs.timezone;
  const today = localDate(derived.now, tz);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const evening = { start: zonedToEpoch(date, "18:30", tz), end: zonedToEpoch(date, "22:30", tz) };
    let s: DayState;
    if (derived.calendar.mode !== "disconnected" && derived.calendar.busy.some((b) => overlaps(b, evening))) s = "busy";
    else {
      const p = derived.protectedIntervals.find((x) => overlaps(x, evening));
      s = p ? p.category : derived.calendar.mode === "disconnected" ? "unknown" : "free";
    }
    return { date, s, at: zonedToEpoch(date, "12:00", tz) };
  });

  return (
    <section aria-labelledby="evenings">
      <h2 id="evenings" className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
        Your evenings {derived.calendar.mode === "demo" ? "(sample calendar)" : derived.calendar.mode === "snapshot" ? "(your calendar, copied — not live)" : derived.calendar.mode === "disconnected" ? "(no calendar connected)" : ""}
      </h2>
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <li key={d.date} className={`rounded-lg px-1 py-2 text-center ${STYLE[d.s].cls}`}>
            <span className="block text-[11px] font-medium">{formatShortDay(d.at, tz).split(" ")[0]}</span>
            <span className="block text-[10px]">{STYLE[d.s].label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
