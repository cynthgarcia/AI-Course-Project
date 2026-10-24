"use client";

import { useState } from "react";
import { AREA_LABELS } from "@/lib/domain/areas";
import { GOAL_LABELS, type GoalKey } from "@/lib/domain/hobbies";
import { CATEGORY_LABELS, WEEKDAYS, type AreaId, type Category, type Preferences, type TimeBlock, type Weekday } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { btn } from "./ui";

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";
const DAY_LABEL: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const LEVELS: [number, string][] = [
  [3, "Love it"],
  [1, "Sometimes"],
  [0, "Not really"],
];
const STEPS = ["Where", "Interests", "Money & goals", "Your time"];

type Preset = { id: string; label: string; block: Omit<TimeBlock, "id"> };
const PRESETS: Preset[] = [
  { id: "fri-friends", label: "Keep Friday evenings free for friends", block: { category: "keep_open_for_friends", weekday: "fri", startTime: "19:00", endTime: "23:30", label: "Friday — keep free for friends" } },
  { id: "sun-personal", label: "Sunday evenings are just for me", block: { category: "personal_time", weekday: "sun", startTime: "17:00", endTime: "21:00", label: "Sunday reset" } },
  { id: "mon-personal", label: "Monday evenings are just for me", block: { category: "personal_time", weekday: "mon", startTime: "19:30", endTime: "22:30", label: "Quiet Monday" } },
  { id: "sat-open", label: "Happy to get ideas for Saturday daytime", block: { category: "open_to_suggestions", weekday: "sat", startTime: "10:00", endTime: "18:00", label: null } },
];

function presetMatches(blocks: TimeBlock[], p: Preset): boolean {
  return blocks.some((b) => b.category === p.block.category && b.weekday === p.block.weekday && b.startTime === p.block.startTime);
}

export function Onboarding() {
  const { state, dispatch, snapshot } = useStore();
  const initial = state.prefs;
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Preferences>(initial);
  const [commutes, setCommutes] = useState(initial.officeDays.length > 0);
  const [presets, setPresets] = useState<Set<string>>(() => new Set(PRESETS.filter((x) => presetMatches(initial.protectedBlocks, x)).map((x) => x.id)));
  const [keywords, setKeywords] = useState(initial.interestKeywords.join(", "));
  const [calendar, setCalendar] = useState<"demo" | "snapshot" | "disconnected">(snapshot ? "snapshot" : state.calendarMode);
  const set = (patch: Partial<Preferences>) => setP((x) => ({ ...x, ...patch }));

  const finish = () => {
    // Keep any custom blocks; replace preset ones with what was chosen here.
    const custom = initial.protectedBlocks.filter((b) => !PRESETS.some((x) => x.block.category === b.category && x.block.weekday === b.weekday && x.block.startTime === b.startTime));
    const chosen = PRESETS.filter((x) => presets.has(x.id)).map((x) => ({ ...x.block, id: `pb-${x.id}` }));
    dispatch({
      type: "setPrefs",
      prefs: {
        homeNeighborhood: p.homeNeighborhood.trim() || AREA_LABELS[p.homeArea],
        homeArea: p.homeArea,
        officeDays: commutes ? p.officeDays : [],
        officeArea: p.officeArea,
        officeNeighborhood: commutes ? p.officeNeighborhood.trim() || AREA_LABELS[p.officeArea] : "",
        workEndTime: p.workEndTime,
        interests: p.interests,
        interestKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 50),
        monthlyBudget: p.monthlyBudget,
        goals: p.goals,
        travelEnabled: p.travelEnabled,
        protectedBlocks: [...custom, ...chosen],
      },
    });
    dispatch({ type: "setCalendarMode", mode: calendar });
    dispatch({ type: "completeOnboarding" });
  };

  return (
    <section aria-labelledby="welcome" className="mx-auto max-w-xl space-y-6 py-2">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Welcome · step {step + 1} of {STEPS.length}
        </p>
        <h1 id="welcome" className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">
          {["A fuller life, not a busier one.", "What do you enjoy?", "Money and what you're after", "Protect your time"][step]}
        </h1>
        <ol className="mt-3 flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <li key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`} />
          ))}
        </ol>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <p className="text-muted">A few questions so suggestions fit your life. You can change everything later in Settings. The app is built for London for now.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted">
              Where do you live? (area)
              <select id="ob-home-area" className={input} value={p.homeArea} onChange={(e) => set({ homeArea: e.target.value as AreaId })}>
                {Object.entries(AREA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Neighbourhood (optional, no address needed)
              <input id="ob-home" className={input} value={p.homeNeighborhood} maxLength={120} onChange={(e) => set({ homeNeighborhood: e.target.value })} placeholder="e.g. Parsons Green" />
            </label>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm">Do you go into an office or workplace on set days?</legend>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <label key={String(v)} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${commutes === v ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
                  <input type="radio" name="commutes" className="sr-only" checked={commutes === v} onChange={() => setCommutes(v)} />
                  {v ? "Yes" : "No / it varies"}
                </label>
              ))}
            </div>
          </fieldset>
          {commutes && (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <fieldset>
                <legend className="text-xs text-muted">Which days?</legend>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {WEEKDAYS.slice(0, 5).map((d) => {
                    const on = p.officeDays.includes(d);
                    return (
                      <label key={d} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${on ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={() => set({ officeDays: on ? p.officeDays.filter((x) => x !== d) : [...p.officeDays, d] })} />
                        {DAY_LABEL[d]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted">
                  Workplace area
                  <select id="ob-office-area" className={input} value={p.officeArea} onChange={(e) => set({ officeArea: e.target.value as AreaId })}>
                    {Object.entries(AREA_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-muted">
                  Usual finish time
                  <input id="ob-finish" type="time" className={input} value={p.workEndTime} onChange={(e) => e.target.value && set({ workEndTime: e.target.value })} />
                </label>
              </div>
              <p className="text-xs text-muted">On those days, nothing is suggested before you could realistically get there after work.</p>
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <li key={c} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm">{CATEGORY_LABELS[c]}</span>
                <span role="radiogroup" aria-label={CATEGORY_LABELS[c]} className="inline-flex rounded-full border border-line p-0.5 text-xs">
                  {LEVELS.map(([v, label]) => {
                    const current = (p.interests[c] ?? 0) >= 2 ? 3 : p.interests[c] ?? 0;
                    return (
                      <label key={v} className={`cursor-pointer rounded-full px-2.5 py-1 ${current === v ? "bg-ink text-paper" : "text-muted"}`}>
                        <input type="radio" name={`int-${c}`} className="sr-only" checked={current === v} onChange={() => set({ interests: { ...p.interests, [c]: v } })} />
                        {label}
                      </label>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
          <label className="block text-xs text-muted">
            Anything specific you love? (optional, comma separated)
            <input id="ob-keywords" className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="jazz, padel, pottery, AI, poetry" />
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <label className="block text-sm">
            Monthly budget for going out and experiences (£)
            <input
              id="ob-budget"
              type="number"
              min={0}
              step={10}
              className={input}
              value={p.monthlyBudget}
              onChange={(e) => set({ monthlyBudget: Math.max(0, Number(e.target.value) || 0) })}
            />
            <span className="mt-1 block text-xs text-muted">A ceiling, not a target. Free things are always included.</span>
          </label>
          <fieldset>
            <legend className="text-sm">What would you like more of? (optional)</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(GOAL_LABELS) as GoalKey[]).map((g) => {
                const on = p.goals.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ goals: on ? p.goals.filter((x) => x !== g) : [...p.goals, g] })}
                    className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}
                  >
                    {GOAL_LABELS[g]}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p.travelEnabled} onChange={(e) => set({ travelEnabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />
            Suggest events in Europe that are worth a weekend away
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm">Time that stays protected — suggestions never go here unless you ask</legend>
            {PRESETS.map((x) => (
              <label key={x.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-card p-3 text-sm">
                <input
                  type="checkbox"
                  checked={presets.has(x.id)}
                  onChange={(e) =>
                    setPresets((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(x.id);
                      else n.delete(x.id);
                      return n;
                    })
                  }
                  className="size-4 accent-[var(--accent)]"
                />
                {x.label}
              </label>
            ))}
            <p className="text-xs text-muted">Add your own blocks any time in Settings.</p>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm">Calendar</legend>
            {snapshot && (
              <label className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3 text-sm">
                <input type="radio" name="cal" checked={calendar === "snapshot"} onChange={() => setCalendar("snapshot")} className="mt-0.5 accent-[var(--accent)]" />
                <span>
                  <span className="font-medium">Use my Google Calendar busy times</span>
                  <span className="block text-muted">A read-only copy — start and end times only. It won&rsquo;t update by itself.</span>
                </span>
              </label>
            )}
            <label className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3 text-sm">
              <input type="radio" name="cal" checked={calendar === "demo"} onChange={() => setCalendar("demo")} className="mt-0.5 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">Try a sample calendar</span>
                <span className="block text-muted">Made-up busy times, to see how calendar-aware suggestions work.</span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3 text-sm">
              <input type="radio" name="cal" checked={calendar === "disconnected"} onChange={() => setCalendar("disconnected")} className="mt-0.5 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">No calendar for now</span>
                <span className="block text-muted">Suggested times will be marked unverified.</span>
              </span>
            </label>
            <p className="text-xs text-muted">Connecting Google Calendar directly is coming next.</p>
          </fieldset>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {step > 0 ? (
          <button type="button" className={btn.quiet} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className={btn.primary} onClick={() => setStep((s) => s + 1)}>
            Next
          </button>
        ) : (
          <button type="button" onClick={finish} className="rounded-full bg-ink px-5 py-3 font-medium text-paper">
            Show me what&rsquo;s worth doing
          </button>
        )}
      </div>
    </section>
  );
}
