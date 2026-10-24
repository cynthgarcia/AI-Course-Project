"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StarRating } from "@/components/StarRating";
import { Badge, EmptyState, btn } from "@/components/ui";
import {
  GOAL_LABELS,
  HOBBIES,
  HOBBY_BY_ID,
  HOBBY_STATUS_LABELS,
  recommendHobbies,
  type GoalKey,
  type Hobby,
  type HobbyStatus,
  type UserHobby,
} from "@/lib/domain/hobbies";
import { DAY, formatShortDay, localDate } from "@/lib/domain/time";
import { useStore } from "@/lib/store/AppStore";
import type { HobbyPatch } from "@/lib/store/state";
import { newId } from "@/lib/ui/experience";
import { whenLabel } from "@/lib/ui/format";

const input = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";

export default function HobbiesPage() {
  const { state, dispatch, derived } = useStore();
  const { prefs } = state;
  const goals = useMemo(() => prefs.goals ?? [], [prefs.goals]);
  const mine = useMemo(() => Object.values(state.hobbies).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [state.hobbies]);
  const active = mine.filter((h) => h.status !== "not_for_me");
  const declined = mine.filter((h) => h.status === "not_for_me");
  const [customGoal, setCustomGoal] = useState("");
  const [customHobby, setCustomHobby] = useState("");

  const recs = useMemo(
    () =>
      derived
        ? recommendHobbies({ prefs, goals, experiences: Object.values(state.experiences), hobbies: mine, events: derived.events, now: derived.now })
        : [],
    [derived, prefs, goals, state.experiences, mine],
  );

  if (!derived) return null;
  const at = () => new Date().toISOString();
  const setGoals = (g: string[]) => dispatch({ type: "setPrefs", prefs: { goals: g } });
  const add = (h: Hobby | null, name: string, status: HobbyStatus) =>
    dispatch({
      type: "addHobby",
      hobby: { id: newId(), hobbyId: h?.id ?? null, name, status, pastExperience: false, nextSession: null, rating: null, notes: "", createdAt: at(), updatedAt: at() },
    });

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Hobbies</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Things worth trying</h1>
        <p className="mt-2 max-w-prose text-muted">
          New hobbies picked from your interests, your goals and what you&rsquo;ve loved before — plus a place to keep track of the ones you&rsquo;re trying. No pressure to turn any of them into a side hustle.
        </p>
      </div>

      <section aria-labelledby="goals" className="space-y-3">
        <h2 id="goals" className="font-serif text-2xl">
          What do you want more of?
        </h2>
        <ul className="flex flex-wrap gap-2">
          {(Object.keys(GOAL_LABELS) as GoalKey[]).map((g) => {
            const on = goals.includes(g);
            return (
              <li key={g}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoals(on ? goals.filter((x) => x !== g) : [...goals, g])}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink"}`}
                >
                  {GOAL_LABELS[g]}
                </button>
              </li>
            );
          })}
          {goals
            .filter((g) => !(g in GOAL_LABELS))
            .map((g) => (
              <li key={g}>
                <span className="inline-flex items-center gap-1 rounded-full border border-ink bg-ink px-3 py-1.5 text-sm text-paper">
                  {g}
                  <button type="button" aria-label={`Remove goal ${g}`} onClick={() => setGoals(goals.filter((x) => x !== g))} className="ml-1 opacity-70 hover:opacity-100">
                    ×
                  </button>
                </span>
              </li>
            ))}
        </ul>
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const g = customGoal.trim();
            if (g && !goals.includes(g) && goals.length < 12) setGoals([...goals, g.slice(0, 80)]);
            setCustomGoal("");
          }}
        >
          <label htmlFor="custom-goal" className="sr-only">
            Your own goal
          </label>
          <input id="custom-goal" className={input} value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} placeholder="In your own words, e.g. be more of a public figure" maxLength={80} />
          <button type="submit" className={btn.secondary} disabled={!customGoal.trim()}>
            Add
          </button>
        </form>
      </section>

      <section aria-labelledby="mine">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="mine" className="font-serif text-2xl">
            Your hobbies
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = customHobby.trim();
              if (!name) return;
              const match = HOBBIES.find((h) => h.name.toLowerCase() === name.toLowerCase());
              add(match ?? null, match?.name ?? name.slice(0, 80), "curious");
              setCustomHobby("");
            }}
          >
            <label htmlFor="custom-hobby" className="sr-only">
              Add a hobby
            </label>
            <input id="custom-hobby" className={input} value={customHobby} onChange={(e) => setCustomHobby(e.target.value)} placeholder="Add one, e.g. Acting" maxLength={80} list="hobby-names" />
            <datalist id="hobby-names">
              {HOBBIES.map((h) => (
                <option key={h.id} value={h.name} />
              ))}
            </datalist>
            <button type="submit" className={btn.secondary} disabled={!customHobby.trim()}>
              Add
            </button>
          </form>
        </div>
        {active.length === 0 ? (
          <EmptyState title="Nothing tracked yet">Already signed up for a class, or picking something back up? Add it above and I&rsquo;ll suggest what could come next.</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {active.map((h) => (
              <HobbyCard key={h.id} h={h} now={derived.now} onAdd={add} tracked={mine} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="worth">
        <h2 id="worth" className="mb-1 font-serif text-2xl">
          Worth trying
        </h2>
        <p className="mb-3 text-sm text-muted">{goals.length ? "Ranked for your goals, interests and history." : "Pick a goal or two above for sharper suggestions."}</p>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {recs.map((r) => (
            <li key={r.hobby.id} className="space-y-3 rounded-xl border border-line bg-card p-4">
              <div>
                <h3 className="font-serif text-xl">{r.hobby.name}</h3>
                <p className="text-sm text-muted">{r.hobby.blurb}</p>
              </div>
              {r.reasons.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {r.reasons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted">
                {r.hobby.social === "group" ? "In a group" : r.hobby.social === "solo" ? "On your own" : "Solo or with others"} · {r.hobby.commitment} · {r.hobby.cost.toLowerCase()} cost to start (a rough guide)
              </p>
              <div className="text-sm">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">Ways to try it</p>
                <p>{r.hobby.waysToTry.join(" · ")}</p>
              </div>
              {r.tryEvents.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {r.tryEvents.map((e) => (
                    <li key={e.id}>
                      <Link href={`/events/${encodeURIComponent(e.id)}`} className="text-accent underline">
                        {e.title}
                      </Link>{" "}
                      <span className="text-muted">· {whenLabel(e, prefs.timezone)}</span> {e.isDemo && <Badge tone="warn">Sample</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <button type="button" className={btn.primary} onClick={() => add(r.hobby, r.hobby.name, "curious")}>
                  I&rsquo;m curious
                </button>
                <button type="button" className={btn.secondary} onClick={() => add(r.hobby, r.hobby.name, "signed_up")}>
                  I&rsquo;ve signed up
                </button>
                <button type="button" className={btn.quiet} onClick={() => add(r.hobby, r.hobby.name, "not_for_me")}>
                  Not for me
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {declined.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Not for me ({declined.length})</summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {declined.map((h) => (
              <li key={h.id}>
                <button type="button" className={btn.quiet} onClick={() => dispatch({ type: "removeHobby", id: h.id })}>
                  {h.name} — reconsider
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function HobbyCard({ h, now, onAdd, tracked }: { h: UserHobby; now: number; onAdd: (h: Hobby | null, name: string, s: HobbyStatus) => void; tracked: UserHobby[] }) {
  const { dispatch } = useStore();
  const [notes, setNotes] = useState(h.notes);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const at = () => new Date().toISOString();
  const update = (patch: HobbyPatch) => dispatch({ type: "updateHobby", id: h.id, patch, at: at() });
  const cat = h.hobbyId ? HOBBY_BY_ID.get(h.hobbyId) : undefined;
  const nextIdeas = (cat?.nextSteps ?? []).map((id) => HOBBY_BY_ID.get(id)!).filter((n) => n && !tracked.some((t) => t.hobbyId === n.id));
  const today = localDate(now, "Europe/London");
  const daysUntil = h.nextSession ? Math.round((Date.parse(`${h.nextSession}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY) : null;

  return (
    <li className="space-y-3 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-xl">{h.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={h.status === "ongoing" ? "ok" : h.status === "signed_up" || h.status === "trying" ? "accent" : "neutral"}>{HOBBY_STATUS_LABELS[h.status]}</Badge>
            {h.pastExperience && <Badge>Done it before</Badge>}
          </div>
        </div>
        <label className="text-xs text-muted">
          Status
          <select className={`${input} mt-1`} value={h.status} onChange={(e) => update({ status: e.target.value as HobbyStatus })}>
            {Object.entries(HOBBY_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          Next class or session
          <input type="date" className={`${input} mt-1`} value={h.nextSession ?? ""} onChange={(e) => update({ nextSession: e.target.value || null })} />
          {daysUntil !== null && (
            <span className="mt-1 block text-xs text-ink">
              {daysUntil > 1 ? `In ${daysUntil} days — ${formatShortDay(Date.parse(`${h.nextSession}T12:00:00Z`), "Europe/London")}` : daysUntil === 1 ? "Tomorrow" : daysUntil === 0 ? "Today — enjoy it" : "Passed — how did it go?"}
            </span>
          )}
        </label>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={h.pastExperience} onChange={(e) => update({ pastExperience: e.target.checked })} className="size-4 accent-[var(--accent)]" />
          I&rsquo;ve done this before
        </label>
      </div>

      {(h.status === "trying" || h.status === "ongoing" || h.status === "paused" || h.rating !== null) && (
        <div className="space-y-1">
          <StarRating value={h.rating} onChange={(rating) => update({ rating })} label={`How much are you enjoying ${h.name}?`} />
          <p className="text-xs text-muted">Your rating helps tune what gets suggested next.</p>
        </div>
      )}

      <label className="block text-xs text-muted">
        Notes
        <textarea className={`${input} mt-1`} rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== h.notes && update({ notes })} placeholder="Teacher, what to bring, how it went…" />
      </label>

      {nextIdeas.length > 0 && (
        <div className="text-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Could lead to</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {nextIdeas.map((n) => (
              <button key={n.id} type="button" className="rounded-full border border-line px-3 py-1 text-sm hover:border-ink" onClick={() => onAdd(n, n.name, "curious")}>
                + {n.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-line pt-2">
        {confirmRemove ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            Remove {h.name} from your hobbies?
            <button type="button" className={btn.secondary} onClick={() => dispatch({ type: "removeHobby", id: h.id })}>
              Remove
            </button>
            <button type="button" className={btn.quiet} onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className={btn.quiet} onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
