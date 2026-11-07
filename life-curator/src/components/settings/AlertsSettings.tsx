"use client";

import { useState } from "react";
import { useStore } from "@/lib/store/AppStore";
import { PushToggle } from "../PushToggle";
import { btn } from "../ui";

export function AlertsSettings() {
  const { state, dispatch, mode } = useStore();
  const { prefs } = state;
  const follows = prefs.follows ?? [];
  const [name, setName] = useState("");
  const set = (p: Partial<typeof prefs>) => dispatch({ type: "setPrefs", prefs: p });

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={prefs.alertsEnabled} onChange={(e) => set({ alertsEnabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />
        Alert me about events I&rsquo;d really like
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={prefs.alertStrongMatches} onChange={(e) => set({ alertStrongMatches: e.target.checked })} className="size-4 accent-[var(--accent)]" />
        Include very strong matches that fit my calendar (at most two a day), not only things I follow
      </label>

      <div className="space-y-2">
        <p className="text-sm">Artists, venues, organisers or anything else you follow</p>
        <ul className="flex flex-wrap gap-1.5">
          {follows.map((f) => (
            <li key={f}>
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-3 py-1 text-sm">
                {f}
                <button type="button" aria-label={`Stop following ${f}`} className="text-muted hover:text-ink" onClick={() => set({ follows: follows.filter((x) => x !== f) })}>
                  ×
                </button>
              </span>
            </li>
          ))}
          {follows.length === 0 && <li className="text-sm text-muted">Nothing yet — try an artist you love, a venue, or a word like &ldquo;padel&rdquo;.</li>}
        </ul>
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (n.length >= 2 && !follows.some((f) => f.toLowerCase() === n.toLowerCase()) && follows.length < 50) set({ follows: [...follows, n.slice(0, 80)] });
            setName("");
          }}
        >
          <label htmlFor="follow-name" className="sr-only">
            Follow an artist, venue or word
          </label>
          <input id="follow-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kurt Elling, Wigmore Hall" maxLength={80} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm" />
          <button type="submit" className={btn.secondary} disabled={name.trim().length < 2}>
            Follow
          </button>
        </form>
      </div>

      {mode === "server" && (
        <div className="space-y-1">
          <p className="text-sm">On this device</p>
          <PushToggle />
        </div>
      )}
      <p className="text-xs text-muted">Alerts are checked once a day in the afternoon, never overnight, and appear under the bell at the top.</p>
    </div>
  );
}
