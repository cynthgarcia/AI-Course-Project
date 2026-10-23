"use client";

import { useId, useState } from "react";
import { checkProposal, costFromPrice, formatMoney, monthOf, toBudgetAmount } from "@/lib/domain/budget";
import { nextLocalStatuses } from "@/lib/domain/status";
import { DISMISSAL_LABELS, LOCAL_STATUS_LABELS, type CuratorEvent, type DismissalReason } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { btn } from "./ui";

export function DismissControl({ event }: { event: CuratorEvent }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DismissalReason | "">("");
  const id = useId();

  if (!open)
    return (
      <button type="button" className={btn.quiet} onClick={() => setOpen(true)}>
        Not for me
      </button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Reason (optional)
      </label>
      <select id={id} value={reason} onChange={(e) => setReason(e.target.value as DismissalReason | "")} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm">
        <option value="">Reason (optional)</option>
        {Object.entries(DISMISSAL_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={btn.secondary}
        onClick={() => dispatch({ type: "dismiss", eventId: event.id, category: event.category, reason: reason || null, at: new Date().toISOString() })}
      >
        Dismiss
      </button>
      <button type="button" className={btn.quiet} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

/** Marking planned checks the budget first. Planning never means a ticket was bought. */
export function PlanControl({ event }: { event: CuratorEvent }) {
  const { state, dispatch, derived } = useStore();
  const [pending, setPending] = useState<null | "over" | "unknown">(null);
  if (!derived) return null;
  const cost = costFromPrice(event);
  const amount = toBudgetAmount(cost, state.prefs);
  const check = checkProposal(derived.budgetForMonth(monthOf(event, state.prefs.timezone)), amount);

  const commit = (override: boolean) => {
    dispatch({ type: "setStatus", eventId: event.id, category: event.category, status: "planned", plannedCost: cost, budgetOverride: override, at: new Date().toISOString() });
    setPending(null);
  };

  if (pending) {
    return (
      <div role="alertdialog" aria-label="Budget check" className="w-full rounded-lg border border-line bg-warn-soft p-3 text-sm text-warn">
        {pending === "over" && check.kind === "over" ? (
          <p>
            This would take you {formatMoney(check.overBy, state.prefs.budgetCurrency)} over what&rsquo;s left for that month. You can still plan it if you mean to.
          </p>
        ) : (
          <p>The cost isn&rsquo;t verified{cost.amount !== null && amount === null ? " in your budget currency (add an exchange rate in Settings)" : ""}, so I can&rsquo;t check it against your budget.</p>
        )}
        <div className="mt-2 flex gap-2">
          <button type="button" className={btn.primary} onClick={() => commit(pending === "over")}>
            Plan anyway
          </button>
          <button type="button" className={btn.quiet} onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={btn.secondary}
      onClick={() => (check.kind === "ok" ? commit(false) : setPending(check.kind))}
    >
      Mark planned
    </button>
  );
}

/** Compact save/interested/plan controls shown on cards. */
export function QuickActions({ event }: { event: CuratorEvent }) {
  const { state, dispatch } = useStore();
  const current = state.saved[event.id]?.status ?? null;
  const allowed = nextLocalStatuses(current);
  const set = (status: "saved" | "interested") =>
    dispatch({ type: "setStatus", eventId: event.id, category: event.category, status, at: new Date().toISOString() });

  if (current === "not_for_me" || current === "skipped") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <span>{LOCAL_STATUS_LABELS[current]}</span>
        <button type="button" className={btn.quiet} onClick={() => dispatch({ type: "removeSaved", eventId: event.id })}>
          Undo
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowed.includes("saved") && (
        <button type="button" className={btn.primary} onClick={() => set("saved")}>
          Save
        </button>
      )}
      {allowed.includes("interested") && current === null && (
        <button type="button" className={btn.secondary} onClick={() => set("interested")}>
          Interested
        </button>
      )}
      {current && <span className="text-sm text-muted">{LOCAL_STATUS_LABELS[current]}</span>}
      {current === null && <DismissControl event={event} />}
    </div>
  );
}
