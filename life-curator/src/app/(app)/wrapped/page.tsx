"use client";

import { useMemo, useState } from "react";
import { ExperienceForm } from "@/components/ExperienceForm";
import { StarRating, Stars } from "@/components/StarRating";
import { Badge, EmptyState, btn } from "@/components/ui";
import { formatMoney } from "@/lib/domain/budget";
import { buildTaste } from "@/lib/domain/taste";
import { CATEGORY_LABELS, type Experience } from "@/lib/domain/types";
import { MONTHS, computeWrapped, yearsWithExperiences } from "@/lib/domain/wrapped";
import { sampleHistory } from "@/lib/data/sampleHistory";
import { useStore } from "@/lib/store/AppStore";
import { CATEGORY_TINT } from "@/lib/ui/format";

export default function WrappedPage() {
  const { state, dispatch, mode, derived } = useStore();
  const { prefs } = state;
  const all = useMemo(() => Object.values(state.experiences).sort((a, b) => b.date.localeCompare(a.date)), [state.experiences]);
  const thisYear = derived ? new Date(derived.now).getFullYear() : new Date().getFullYear();
  const years = useMemo(() => {
    const ys = yearsWithExperiences(all);
    return ys.includes(thisYear) ? ys : [thisYear, ...ys];
  }, [all, thisYear]);
  const [year, setYear] = useState<number | null>(null);
  const shown = year ?? (all.some((x) => x.date.startsWith(`${thisYear}-`)) || all.length === 0 ? thisYear : years.find((y) => y !== thisYear) ?? thisYear);
  const w = useMemo(() => computeWrapped(all, shown, prefs), [all, shown, prefs]);
  const taste = useMemo(() => buildTaste(all), [all]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const at = () => new Date().toISOString();
  const yearItems = all.filter((x) => x.date.startsWith(`${shown}-`));
  const peak = Math.max(1, ...w.monthly);
  const hasSamples = all.some((x) => x.source === "sample");

  const save = (x: Experience) => {
    if (state.experiences[x.id]) {
      const { id: _id, eventId: _e, source: _s, createdAt: _c, updatedAt: _u, ...patch } = x;
      dispatch({ type: "updateExperience", id: x.id, patch, at: at() });
    } else {
      dispatch({ type: "addExperience", experience: x });
    }
    setAdding(false);
    setEditing(null);
    setYear(Number(x.date.slice(0, 4)));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Wrapped</p>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Your {shown}, out and about</h1>
          <p className="mt-2 max-w-prose text-muted">Everything you went to, rated by you. Your ratings quietly tune what gets recommended next.</p>
        </div>
        <button type="button" className={btn.primary} onClick={() => { setAdding(true); setEditing(null); }}>
          Add a past experience
        </button>
      </div>

      <div role="tablist" aria-label="Year" className="flex flex-wrap gap-1 text-sm">
        {years.map((y) => (
          <button
            key={y}
            role="tab"
            aria-selected={y === shown}
            onClick={() => setYear(y)}
            className={`rounded-full border px-3 py-1.5 tabular-nums ${y === shown ? "border-ink bg-ink text-paper" : "border-line bg-card text-muted"}`}
          >
            {y}
          </button>
        ))}
      </div>

      {adding && <ExperienceForm onSave={save} onCancel={() => setAdding(false)} />}

      {all.length === 0 && !adding ? (
        <EmptyState title="Your history starts here">
          <p>Add things you&rsquo;ve been to — this year or years ago — and rate them out of 5. When you confirm attending an event in the app, it lands here too.</p>
          {mode === "local" && (
            <button type="button" className={`${btn.secondary} mt-3`} onClick={() => sampleHistory().forEach((x) => dispatch({ type: "addExperience", experience: x }))}>
              Preview with sample history
            </button>
          )}
        </EmptyState>
      ) : (
        <>
          {w.includesSamples && (
            <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
              This year includes fictional sample entries (marked &ldquo;sample&rdquo;). They&rsquo;re never used to learn your taste.
            </p>
          )}

          <section aria-labelledby="hero" className="overflow-hidden rounded-2xl bg-ink p-6 text-paper sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.2em] opacity-70">{shown} in experiences</p>
            <p className="mt-3 font-serif text-7xl leading-none tabular-nums sm:text-8xl">{w.count}</p>
            <p className="mt-1 text-sm opacity-80">{w.count === 1 ? "experience" : "experiences"} logged</p>
            <h2 id="hero" className="mt-6 font-serif text-3xl italic leading-tight sm:text-4xl">
              {w.persona.title}
            </h2>
            <p className="mt-2 max-w-prose opacity-80">{w.persona.line}</p>
          </section>

          <section aria-label="Highlights" className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Average rating" value={w.avgRating === null ? "—" : `${w.avgRating.toFixed(1)}★`} note={`${w.ratedCount} of ${w.count} rated`} />
            <Tile label="New to you" value={String(w.newCount)} note="first-time experiences" />
            <Tile label="Busiest month" value={w.busiestMonth ? MONTHS[w.busiestMonth.month]! : "—"} note={w.busiestMonth ? `${w.busiestMonth.count} experiences` : "nothing yet"} />
            <Tile
              label="Spent"
              value={formatMoney(w.spent, prefs.budgetCurrency)}
              note={w.unknownCostCount ? `+ ${w.unknownCostCount} with cost not recorded or not converted` : "all costs recorded"}
            />
          </section>

          <section aria-labelledby="months" className="rounded-xl border border-line bg-card p-4">
            <h2 id="months" className="text-[11px] uppercase tracking-[0.18em] text-muted">
              Month by month
            </h2>
            <ol className="mt-4 grid h-32 grid-cols-12 items-end gap-1.5">
              {w.monthly.map((n, i) => (
                <li key={i} className="flex h-full flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums text-muted">{n || ""}</span>
                  <span className="w-full rounded-t bg-accent" style={{ height: `${(n / peak) * 80}%`, minHeight: n ? 4 : 1, opacity: n ? 1 : 0.2 }} />
                  <span className="text-[10px] text-muted">{MONTHS[i]![0]}</span>
                  <span className="sr-only">
                    {MONTHS[i]}: {n}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="cats" className="rounded-xl border border-line bg-card p-4">
              <h2 id="cats" className="text-[11px] uppercase tracking-[0.18em] text-muted">
                What you went to
              </h2>
              <ul className="mt-3 space-y-2">
                {w.categories.map((c) => (
                  <li key={c.category} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span>{CATEGORY_LABELS[c.category]}</span>
                      <span className="tabular-nums text-muted">
                        {c.count} · {c.avgRating === null ? "unrated" : `${c.avgRating.toFixed(1)}★`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-line">
                      <div className="h-full rounded-full" style={{ width: `${(c.count / w.count) * 100}%`, background: CATEGORY_TINT[c.category] }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="top" className="rounded-xl border border-line bg-card p-4">
              <h2 id="top" className="text-[11px] uppercase tracking-[0.18em] text-muted">
                Your top-rated
              </h2>
              {w.topRated.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Rate a few experiences to see your favourites.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {w.topRated.map((x, i) => (
                    <li key={x.id} className="flex items-baseline gap-3 text-sm">
                      <span className="w-4 font-serif text-lg tabular-nums text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{x.title}</span>
                        <span className="text-xs text-muted">{new Date(`${x.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </span>
                      <Stars value={x.rating} />
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="company" className="rounded-xl border border-line bg-card p-4">
              <h2 id="company" className="text-[11px] uppercase tracking-[0.18em] text-muted">
                Who you went with
              </h2>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Solo", w.withWhom.solo],
                    ["Friends", w.withWhom.friends],
                    ["New people", w.withWhom.new_people],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dd className="font-serif text-3xl tabular-nums">{v}</dd>
                    <dt className="text-xs text-muted">{k}</dt>
                  </div>
                ))}
              </dl>
              {w.withWhom.unknown > 0 && <p className="mt-2 text-xs text-muted">{w.withWhom.unknown} without company recorded.</p>}
            </section>

            <section aria-labelledby="places" className="rounded-xl border border-line bg-card p-4">
              <h2 id="places" className="text-[11px] uppercase tracking-[0.18em] text-muted">
                Where you went
              </h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {w.places.length === 0 ? <li className="text-sm text-muted">No places recorded.</li> : w.places.map((p) => <li key={p}><Badge>{p}</Badge></li>)}
              </ul>
            </section>
          </div>

          <section aria-labelledby="learning" className="rounded-xl border border-line bg-accent-soft p-4">
            <h2 id="learning" className="font-serif text-xl">
              What your ratings are teaching the app
            </h2>
            {taste.ratedCount === 0 ? (
              <p className="mt-1 text-sm">Once you rate your own experiences, categories you love get a gentle boost — and ones you didn&rsquo;t enjoy get nudged down. A single rating never rules anything out.</p>
            ) : (
              <>
                <p className="mt-1 text-sm">Based on {taste.ratedCount} rating{taste.ratedCount === 1 ? "" : "s"} across all years:</p>
                <ul className="mt-2 flex flex-wrap gap-1.5 text-sm">
                  {[...taste.byCategory]
                    .sort((a, b) => b[1].avg - a[1].avg)
                    .map(([c, s]) => (
                      <li key={c} className="rounded-full bg-card px-3 py-1">
                        {CATEGORY_LABELS[c]} <span className="tabular-nums text-muted">{s.avg.toFixed(1)}★ · {s.count}</span>
                        <span className="sr-only">{s.avg >= 3.5 ? " (boosted)" : s.avg <= 2.5 ? " (nudged down)" : " (neutral)"}</span>
                        <span aria-hidden className="ml-1">{s.avg >= 3.5 ? "↑" : s.avg <= 2.5 ? "↓" : "·"}</span>
                      </li>
                    ))}
                </ul>
              </>
            )}
            {hasSamples && <p className="mt-2 text-xs text-muted">Sample entries are excluded.</p>}
          </section>

          <section aria-labelledby="all">
            <h2 id="all" className="mb-3 font-serif text-2xl">
              Every experience in {shown}
            </h2>
            {yearItems.length === 0 ? (
              <EmptyState title={`Nothing logged for ${shown} yet`}>Add something you went to, or switch year.</EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {yearItems.map((x) =>
                  editing === x.id ? (
                    <li key={x.id} className="p-2">
                      <ExperienceForm initial={x} onSave={save} onCancel={() => setEditing(null)} />
                    </li>
                  ) : (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {x.title} {x.source === "sample" && <Badge tone="warn">Sample</Badge>}
                        </p>
                        <p className="text-xs text-muted">
                          {new Date(`${x.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · {CATEGORY_LABELS[x.category]}
                          {[x.venueName, x.city && x.city !== "London" ? x.city : x.neighborhood].filter(Boolean).length > 0 && ` · ${[x.venueName, x.city && x.city !== "London" ? x.city : x.neighborhood].filter(Boolean).join(", ")}`}
                        </p>
                      </div>
                      <StarRating size="sm" value={x.rating} label={`Rate ${x.title}`} onChange={(rating) => dispatch({ type: "updateExperience", id: x.id, patch: { rating }, at: at() })} />
                      <div className="flex gap-1">
                        <button type="button" className={btn.quiet} onClick={() => { setEditing(x.id); setAdding(false); }}>
                          Edit
                        </button>
                        {confirmDelete === x.id ? (
                          <>
                            <button type="button" className={btn.secondary} onClick={() => { dispatch({ type: "deleteExperience", id: x.id }); setConfirmDelete(null); }}>
                              Delete
                            </button>
                            <button type="button" className={btn.quiet} onClick={() => setConfirmDelete(null)}>
                              Keep
                            </button>
                          </>
                        ) : (
                          <button type="button" className={btn.quiet} onClick={() => setConfirmDelete(x.id)} aria-label={`Delete ${x.title}`}>
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
