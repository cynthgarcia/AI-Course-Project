"use client";

import { useId } from "react";

/** Accessible 1–5 star picker (a radio group). Choosing the current value again clears it. */
export function StarRating({ value, onChange, label = "Your rating", size = "md" }: { value: number | null; onChange: (v: number | null) => void; label?: string; size?: "sm" | "md" }) {
  const name = useId();
  const text = size === "sm" ? "text-lg" : "text-2xl";
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-2">
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`cursor-pointer px-0.5 leading-none ${text} ${value !== null && n <= value ? "text-accent" : "text-line"}`}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              onClick={() => value === n && onChange(null)}
              className="sr-only"
            />
            <span aria-hidden>★</span>
            <span className="sr-only">
              {n} star{n === 1 ? "" : "s"}
            </span>
          </label>
        ))}
      </span>
      <span className="text-xs text-muted tabular-nums">{value === null ? "Not rated" : `${value}/5`}</span>
    </div>
  );
}

export function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted">Not rated</span>;
  return (
    <span aria-label={`${value} out of 5 stars`} className="text-accent">
      {"★".repeat(value)}
      <span className="text-line">{"★".repeat(5 - value)}</span>
    </span>
  );
}
