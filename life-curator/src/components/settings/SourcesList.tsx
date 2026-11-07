"use client";

import { useEffect, useState } from "react";

interface Source {
  id: string;
  name: string;
  group: string;
  active: boolean;
  events: number | null;
  lastUpdated: string | null;
  problem: string | null;
  note: string | null;
}

const ORDER = ["Ticketing", "Calendars & communities", "Venues", "AI scout", "Sample (fictional)"];

function ago(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
}

/** Every place events come from, with what each one is currently contributing. */
export function SourcesList() {
  const [sources, setSources] = useState<Source[] | null>(null);
  useEffect(() => {
    fetch("/api/sources", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sources: [] }))
      .then((b: { sources: Source[] }) => setSources(b.sources))
      .catch(() => setSources([]));
  }, []);
  if (!sources) return <p className="text-sm text-muted">Loading sources…</p>;

  const groups = ORDER.map((g) => ({ g, items: sources.filter((s) => s.group === g) })).filter((x) => x.items.length);
  const total = sources.reduce((a, s) => a + (s.active && s.group !== "Sample (fictional)" ? s.events ?? 0 : 0), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {total ? `${total} real events currently loaded. ` : "No real events loaded yet. "}
        Each event also shows its own source on its page. Off Hours only reads what these sources publish publicly, and checks a site&rsquo;s robots.txt before reading it.
      </p>
      {groups.map(({ g, items }) => (
        <details key={g} open={g !== "Venues"} className="rounded-lg border border-line bg-card">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            {g} <span className="text-muted">({items.filter((i) => i.active).length} on)</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line text-sm">
            {items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span>{s.name}</span>
                <span className={!s.active ? "text-muted" : s.problem ? "text-warn" : "text-ok"}>
                  {!s.active
                    ? `Off · ${s.note ?? ""}`
                    : s.problem && !s.lastUpdated
                      ? "Not working yet"
                      : s.lastUpdated
                        ? `${s.events ?? 0} events · updated ${ago(s.lastUpdated)}${s.problem ? " · last refresh failed" : ""}`
                        : "Waiting for first update"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="text-xs text-muted">
        Not readable automatically: DICE (no public access for apps), Instagram (doesn&rsquo;t allow apps to read posts) and Google&rsquo;s event listings (no official access). The AI scout can find events
        listed on sites like these when it&rsquo;s switched on, and you can always add one from a link or by hand in Discover.
      </p>
    </div>
  );
}
