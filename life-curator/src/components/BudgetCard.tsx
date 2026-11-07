"use client";

import { formatMoney } from "@/lib/domain/budget";
import { useStore } from "@/lib/store/AppStore";

export function BudgetCard() {
  const { derived } = useStore();
  if (!derived) return null;
  const b = derived.budget;
  const used = Math.min(100, Math.max(0, ((b.actual + b.committed) / b.ceiling) * 100));
  const m = (n: number) => formatMoney(n, b.currency);
  const monthName = new Date(`${b.month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long" });
  const nextBudget = derived.nextBudget;
  const nextName = new Date(`${nextBudget.month}-15T12:00:00Z`).toLocaleDateString("en-GB", { month: "long" });

  return (
    <section aria-labelledby="budget" className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="budget" className="text-[11px] uppercase tracking-[0.18em] text-muted">
          {monthName} activity budget
        </h2>
        <span className="text-xs text-muted">Ceiling {m(b.ceiling)}</span>
      </div>
      <p className="mt-1 font-serif text-3xl">
        {m(b.remaining)} <span className="font-sans text-sm text-muted">left</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="presentation">
        <div className="h-full bg-accent" style={{ width: `${used}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted">Spent (recorded)</dt>
          <dd className="font-medium">{m(b.actual)}</dd>
        </div>
        <div>
          <dt className="text-muted">Planned{b.committedIncludesEstimates ? " (est.)" : ""}</dt>
          <dd className="font-medium">{m(b.committed)}</dd>
        </div>
        <div>
          <dt className="text-muted">Just considering</dt>
          <dd className="font-medium">{m(b.considering)}</dd>
        </div>
      </dl>
      {b.unknownCommittedCount > 0 && (
        <p className="mt-2 text-xs text-warn">
          {b.unknownCommittedCount} planned {b.unknownCommittedCount === 1 ? "item has" : "items have"} unknown costs, so the real remaining figure may be lower.
        </p>
      )}
      {(nextBudget.committed > 0 || nextBudget.unknownCommittedCount > 0 || nextBudget.actual > 0) && (
        <p className="mt-2 text-xs text-muted">
          Already planned for {nextName}: {m(nextBudget.committed + nextBudget.actual)}
          {nextBudget.unknownCommittedCount > 0 && ` plus ${nextBudget.unknownCommittedCount} with unknown costs`}.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">This is a ceiling, not a target — there&rsquo;s no need to use it.</p>
    </section>
  );
}
