"use client";

import { useState, type ReactNode } from "react";
import { Notice, btn } from "@/components/ui";
import { AREA_LABELS } from "@/lib/domain/areas";
import { formatShortDay, formatTime } from "@/lib/domain/time";
import { CATEGORY_LABELS, PROTECTED_LABELS, WEEKDAYS, type AreaId, type Category, type Preferences, type ProtectedCategory, type TimeBlock, type Weekday } from "@/lib/domain/types";
import { clearStoredState, exportState, useStore } from "@/lib/store/AppStore";

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";
const DAY_LABEL: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const TIMEZONES = ["Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "America/New_York"];

export default function SettingsPage() {
  const { state, dispatch, snapshot, mode, email } = useStore();
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const signOut = async () => {
    setAccountBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/login");
  };
  const deleteAccount = async () => {
    setAccountBusy(true);
    setAccountError(null);
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    if (res?.ok) window.location.assign("/signup");
    else {
      setAccountError("Your account couldn't be deleted. Please try again.");
      setAccountBusy(false);
    }
  };
  const { prefs } = state;
  const set = (p: Partial<Preferences>) => dispatch({ type: "setPrefs", prefs: p });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [keywords, setKeywords] = useState(prefs.interestKeywords.join(", "));

  const download = () => {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-curator-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateBlock = (id: string, patch: Partial<TimeBlock>) =>
    set({ protectedBlocks: prefs.protectedBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Settings</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Preferences</h1>
        <p className="mt-2 text-muted">Changes save automatically, on this device only for now.</p>
      </div>

      <Section title="Places & schedule">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Home neighbourhood" value={prefs.homeNeighborhood} onChange={(v) => set({ homeNeighborhood: v })} />
          <Area label="Home area (for travel estimates)" value={prefs.homeArea} onChange={(v) => set({ homeArea: v })} />
          <Text label="Office" value={prefs.officeNeighborhood} onChange={(v) => set({ officeNeighborhood: v })} />
          <Area label="Office area" value={prefs.officeArea} onChange={(v) => set({ officeArea: v })} />
        </div>
        <fieldset>
          <legend className="text-xs text-muted">Office days</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label key={d} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${prefs.officeDays.includes(d) ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={prefs.officeDays.includes(d)}
                  onChange={(e) => set({ officeDays: e.target.checked ? [...prefs.officeDays, d] : prefs.officeDays.filter((x) => x !== d) })}
                />
                {DAY_LABEL[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Time label="Usual work finish (used only without a calendar)" value={prefs.workEndTime} onChange={(v) => set({ workEndTime: v })} />
          <label className="block text-xs text-muted">
            Timezone
            <select className={input} value={prefs.timezone} onChange={(e) => set({ timezone: e.target.value })}>
              {TIMEZONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Calendar">
        <div className="space-y-2">
          {(snapshot ? (["snapshot", "demo", "disconnected"] as const) : (["demo", "disconnected"] as const)).map((m) => (
            <label key={m} className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3 text-sm">
              <input type="radio" name="calmode" checked={state.calendarMode === m} onChange={() => dispatch({ type: "setCalendarMode", mode: m })} className="accent-[var(--accent)]" />
              {m === "snapshot"
                ? `My Google Calendar busy times (read-only copy from ${snapshot?.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?"}, not live)`
                : m === "demo"
                  ? "Sample calendar (made-up busy times)"
                  : "No calendar — suggested times are unverified"}
            </label>
          ))}
          <div className="rounded-lg border border-dashed border-line p-3 text-sm text-muted">
            <p className="font-medium text-ink">Google Calendar · not connected</p>
            <p>
              Read-only free/busy access is planned but not built yet: it needs Google OAuth credentials configured on the server. When it&rsquo;s added, only busy
              times will be read — never event titles or descriptions — and nothing will ever be written to your calendar.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Protected time">
        <p className="text-sm text-muted">
          Weekly blocks. Personal Time and Keep Open for Friends are never filled with suggestions. &ldquo;Open to suggestions&rdquo; marks when you&rsquo;d welcome ideas.
        </p>
        <ul className="space-y-2">
          {prefs.protectedBlocks.map((b) => (
            <li key={b.id} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-line bg-card p-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1.2fr_auto]">
              <label className="col-span-2 block text-xs text-muted sm:col-span-1">
                Type
                <select className={input} value={b.category} onChange={(e) => updateBlock(b.id, { category: e.target.value as ProtectedCategory })}>
                  {Object.entries(PROTECTED_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted">
                Day
                <select className={input} value={b.weekday} onChange={(e) => updateBlock(b.id, { weekday: e.target.value as Weekday })}>
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>
                      {DAY_LABEL[d]}
                    </option>
                  ))}
                </select>
              </label>
              <Time label="From" value={b.startTime} onChange={(v) => updateBlock(b.id, { startTime: v })} />
              <Time label="To" value={b.endTime} onChange={(v) => updateBlock(b.id, { endTime: v })} />
              <Text label="Label (optional)" value={b.label ?? ""} onChange={(v) => updateBlock(b.id, { label: v || null })} />
              <button type="button" className={btn.quiet} aria-label={`Remove ${PROTECTED_LABELS[b.category]} on ${DAY_LABEL[b.weekday]}`} onClick={() => set({ protectedBlocks: prefs.protectedBlocks.filter((x) => x.id !== b.id) })}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={btn.secondary}
          onClick={() =>
            set({
              protectedBlocks: [...prefs.protectedBlocks, { id: `pb-${Date.now()}`, category: "personal_time", weekday: "sun", startTime: "10:00", endTime: "12:00", label: null }],
            })
          }
        >
          Add a block
        </button>
      </Section>

      <Section title="Budget">
        <div className="grid gap-3 sm:grid-cols-2">
          <Num label="Monthly activity budget (£, maximum)" value={prefs.monthlyBudget} onChange={(v) => set({ monthlyBudget: v })} />
          <Num
            label="Exchange rate: €1 = £… (your own figure; leave blank to keep euros unconverted)"
            value={prefs.fxRates.EUR ?? null}
            step={0.01}
            onChange={(v) => {
              const { EUR: _drop, ...rest } = prefs.fxRates;
              set({ fxRates: v > 0 ? { ...rest, EUR: v } : rest });
            }}
          />
        </div>
        <Toggle label="Count trip transport and accommodation against the activity budget" checked={prefs.countTravelInBudget} onChange={(v) => set({ countTravelInBudget: v })} />
      </Section>

      <Section title="Interests">
        <p className="text-sm text-muted">0 = rarely, 3 = love it. Unexpected ideas still appear based on your exploration setting.</p>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
            <label key={c} className="block text-sm">
              <span className="flex justify-between">
                {CATEGORY_LABELS[c]} <span className="text-muted">{prefs.interests[c]}</span>
              </span>
              <input type="range" min={0} max={3} step={1} value={prefs.interests[c]} onChange={(e) => set({ interests: { ...prefs.interests, [c]: Number(e.target.value) } })} className="w-full accent-[var(--accent)]" />
            </label>
          ))}
        </div>
        <label className="block text-xs text-muted">
          Keywords I love (comma separated)
          <input className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} onBlur={() => set({ interestKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) })} />
        </label>
      </Section>

      <Section title="Planning">
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="Main horizon (days)" value={prefs.planningHorizonDays} onChange={(v) => set({ planningHorizonDays: v })} />
          <Num label="Advance horizon (days)" value={prefs.advanceHorizonDays} onChange={(v) => set({ advanceHorizonDays: v })} />
          <Num label="Preparation buffer (min)" value={prefs.prepBufferMinutes} onChange={(v) => set({ prepBufferMinutes: v })} />
          <Num label="Minimum notice (hours)" value={prefs.minimumNoticeHours} onChange={(v) => set({ minimumNoticeHours: v })} />
          <Time label="Home by, work nights" value={prefs.latestHomeWeeknight} onChange={(v) => set({ latestHomeWeeknight: v })} />
          <Time label="Home by, weekends" value={prefs.latestHomeWeekend} onChange={(v) => set({ latestHomeWeekend: v })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Level label="Exploration (how often to suggest new things)" value={prefs.explorationLevel} onChange={(v) => set({ explorationLevel: v })} />
          <Level label="Variety in recommendations" value={prefs.diversityLevel} onChange={(v) => set({ diversityLevel: v })} />
        </div>
        <Toggle label="Gentle intention: one fun thing a week" checked={prefs.weeklyFunIntention} onChange={(v) => set({ weeklyFunIntention: v })} />
        <Toggle label="Gentle intention: one new experience a month" checked={prefs.monthlyNewIntention} onChange={(v) => set({ monthlyNewIntention: v })} />
      </Section>

      <Section title="Travel">
        <Toggle label="Suggest European events worth travelling for" checked={prefs.travelEnabled} onChange={(v) => set({ travelEnabled: v })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Num label="Preferred max door-to-door journey (hours, each way)" value={prefs.maxTripHours} onChange={(v) => set({ maxTripHours: v })} />
          <Num label="Look ahead for trips (days)" value={prefs.travelHorizonDays} onChange={(v) => set({ travelHorizonDays: v })} />
        </div>
      </Section>

      <Section title="Weekly digest">
        <Notice tone="warn">Automatic digests aren&rsquo;t set up yet, and nothing is ever emailed or sent. Use &ldquo;Generate my weekly plan&rdquo; on This Week.</Notice>
        <Toggle label="Prepare a weekly plan automatically (when scheduling is available)" checked={prefs.digestEnabled} onChange={(v) => set({ digestEnabled: v })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">
            Day
            <select className={input} value={prefs.digestDay} onChange={(e) => set({ digestDay: e.target.value as Weekday })}>
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {DAY_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <Time label={`Time (${prefs.timezone})`} value={prefs.digestTime} onChange={(v) => set({ digestTime: v })} />
        </div>
        {state.runs.length > 0 && (
          <div>
            <p className="text-xs text-muted">Recent plan runs</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {state.runs.slice(0, 6).map((r) => (
                <li key={r.at}>
                  {formatShortDay(Date.parse(r.at), prefs.timezone)} {formatTime(Date.parse(r.at), prefs.timezone)} · {r.trigger} · {r.outcome === "generated" ? `${r.itemCount} suggestions` : `failed: ${r.error}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {mode === "server" ? (
        <Section title="Account & data">
          <p className="text-sm text-muted">
            Signed in as <strong className="text-ink">{email}</strong>. Your data is stored in this app&rsquo;s database and only your account can read it.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href="/api/export" className={btn.secondary}>
              Export my data (JSON)
            </a>
            <button type="button" className={btn.secondary} disabled={accountBusy} onClick={signOut}>
              Sign out
            </button>
            {!confirmDelete ? (
              <button type="button" className={btn.quiet} onClick={() => setConfirmDelete(true)}>
                Delete my account…
              </button>
            ) : (
              <span role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                Permanently delete your account, history, plans and preferences? This can&rsquo;t be undone.
                <button type="button" className={btn.primary} disabled={accountBusy} onClick={deleteAccount}>
                  Delete permanently
                </button>
                <button type="button" className={btn.quiet} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
          {accountError && <p role="alert" className="text-sm text-bad">{accountError}</p>}
        </Section>
      ) : (
      <Section title="Your data">
          <p className="text-sm text-muted">
            Everything is stored in this browser only. No account, no server, no analytics. Event data is sample data.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn.secondary} onClick={download}>
              Export my data (JSON)
            </button>
            {!confirmDelete ? (
              <button type="button" className={btn.quiet} onClick={() => setConfirmDelete(true)}>
                Delete all my data…
              </button>
            ) : (
              <span role="alertdialog" aria-label="Confirm delete" className="flex flex-wrap items-center gap-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
                Delete saved events, trips, plans and preferences from this browser?
                <button
                  type="button"
                  className={btn.primary}
                  onClick={() => {
                    clearStoredState();
                    dispatch({ type: "reset" });
                    setConfirmDelete(false);
                  }}
                >
                  Delete
                </button>
                <button type="button" className={btn.quiet} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `s-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="space-y-3 border-t border-line pt-6">
      <h2 id={id} className="font-serif text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input className={input} value={value} maxLength={120} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Time({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input type="time" className={input} value={value === "24:00" ? "23:59" : value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
}

function Num({ label, value, onChange, step = 1 }: { label: string; value: number | null; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        type="number"
        min={0}
        step={step}
        className={input}
        value={value ?? ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
      />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: AreaId; onChange: (v: AreaId) => void }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <select className={input} value={value} onChange={(e) => onChange(e.target.value as AreaId)}>
        {Object.entries(AREA_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

function Level({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        {label} <span className="text-muted">{["Off", "Low", "Medium", "High"][value]}</span>
      </span>
      <input type="range" min={0} max={3} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}
