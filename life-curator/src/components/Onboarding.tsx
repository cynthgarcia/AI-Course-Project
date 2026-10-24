"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/domain/budget";
import { useStore } from "@/lib/store/AppStore";

export function Onboarding() {
  const { state, dispatch, snapshot } = useStore();
  const { prefs } = state;
  const [calendar, setCalendar] = useState<"demo" | "snapshot" | "disconnected">(snapshot ? "snapshot" : state.calendarMode);

  return (
    <section aria-labelledby="welcome" className="mx-auto max-w-xl space-y-6 py-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Welcome</p>
        <h1 id="welcome" className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">
          A fuller life, not a busier one.
        </h1>
        <p className="mt-3 text-muted">
          I&rsquo;ve set things up from your profile. You can change any of this later in Settings.
        </p>
      </div>

      <dl className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
        {[
          ["Home", prefs.homeNeighborhood],
          ["Office", `${prefs.officeNeighborhood} · Tue–Thu`],
          ["Monthly activity budget", `${formatMoney(prefs.monthlyBudget, prefs.budgetCurrency)} maximum — a ceiling, not a target`],
          ["Planning horizon", `Next ${prefs.planningHorizonDays} days, plus standouts up to ${Math.round(prefs.advanceHorizonDays / 7)} weeks ahead`],
          ["Protected time", "Personal Time and Keep Open for Friends are never filled automatically"],
          ["European travel", "Suggested only when an event is worth it and the trip is feasible"],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <fieldset className="space-y-2">
        <legend className="mb-2 font-serif text-lg">Calendar</legend>
        {snapshot && (
          <label className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3">
            <input type="radio" name="cal" checked={calendar === "snapshot"} onChange={() => setCalendar("snapshot")} className="mt-1 accent-[var(--accent)]" />
            <span>
              <span className="font-medium">Use my Google Calendar busy times</span>
              <span className="block text-sm text-muted">
                A read-only copy taken {snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : ""}. Only start and end times — no titles or details. It won&rsquo;t update by itself.
              </span>
            </span>
          </label>
        )}
        <label className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3">
          <input type="radio" name="cal" checked={calendar === "demo"} onChange={() => setCalendar("demo")} className="mt-1 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">Use a sample calendar</span>
            <span className="block text-sm text-muted">See how calendar-aware suggestions work, using made-up busy times.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3">
          <input type="radio" name="cal" checked={calendar === "disconnected"} onChange={() => setCalendar("disconnected")} className="mt-1 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">No calendar for now</span>
            <span className="block text-sm text-muted">Browse freely; suggested times will be marked unverified.</span>
          </span>
        </label>
        <div className="flex gap-3 rounded-lg border border-dashed border-line p-3 text-sm text-muted">
          <span aria-hidden>○</span>
          <span>
            <span className="font-medium text-ink">Google Calendar (read-only)</span> — not available yet. It needs OAuth credentials to be configured; it&rsquo;s the next integration on the roadmap.
          </span>
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => {
          dispatch({ type: "setCalendarMode", mode: calendar });
          dispatch({ type: "completeOnboarding" });
        }}
        className="w-full rounded-full bg-ink px-5 py-3 font-medium text-paper sm:w-auto"
      >
        Show me what&rsquo;s worth doing
      </button>
    </section>
  );
}
