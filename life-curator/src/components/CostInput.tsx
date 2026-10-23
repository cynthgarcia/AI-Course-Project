"use client";

import { useId } from "react";
import type { CostBasis, CostItem } from "@/lib/domain/types";

const BASIS_LABELS: Partial<Record<CostBasis, string>> = {
  unknown: "Unknown",
  user_estimate: "My estimate",
  verified: "Confirmed price",
  not_needed: "Not needed",
  sample: "Sample (fictional)",
};

/** A cost field that keeps "unknown" distinct from zero. */
export function CostInput({ label, value, onChange, defaultCurrency }: { label: string; value: CostItem; onChange: (c: CostItem) => void; defaultCurrency: string }) {
  const id = useId();
  const basis = value.basis;
  return (
    <fieldset className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[8rem_1fr_6rem_8rem]">
      <legend className="sr-only">{label}</legend>
      <span className="col-span-2 text-sm sm:col-span-1 sm:self-center">{label}</span>
      <label htmlFor={`${id}-amt`} className="block text-xs text-muted">
        Amount
        <input
          id={`${id}-amt`}
          inputMode="decimal"
          disabled={basis === "unknown" || basis === "not_needed"}
          value={value.amount ?? ""}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, "");
            onChange({ ...value, amount: v === "" ? null : Number(v), basis: basis === "unknown" ? "user_estimate" : basis });
          }}
          className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink disabled:opacity-50"
        />
      </label>
      <label htmlFor={`${id}-cur`} className="block text-xs text-muted">
        Currency
        <select id={`${id}-cur`} value={value.currency || defaultCurrency} onChange={(e) => onChange({ ...value, currency: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-card px-2 py-2 text-sm text-ink">
          {["GBP", "EUR", "CHF", "DKK", "CZK", "SEK", "NOK", "PLN", "HUF"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-basis`} className="col-span-2 block text-xs text-muted sm:col-span-1">
        Status
        <select
          id={`${id}-basis`}
          value={basis}
          onChange={(e) => {
            const b = e.target.value as CostBasis;
            onChange({ ...value, basis: b, amount: b === "unknown" ? null : b === "not_needed" ? 0 : value.amount });
          }}
          className="mt-1 w-full rounded-lg border border-line bg-card px-2 py-2 text-sm text-ink"
        >
          {Object.entries(BASIS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}
