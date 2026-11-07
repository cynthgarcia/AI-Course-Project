"use client";

import { useState } from "react";
import type { CuratorEvent } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";

/** One-tap "follow" for an event's venue or organiser, or a name typed in (e.g. the artist). */
export function FollowChips({ event }: { event: CuratorEvent }) {
  const { state, dispatch } = useStore();
  const follows = state.prefs.follows ?? [];
  const [name, setName] = useState("");
  const isFollowed = (n: string) => follows.some((f) => f.toLowerCase() === n.toLowerCase());
  const toggle = (n: string) =>
    dispatch({ type: "setPrefs", prefs: { follows: isFollowed(n) ? follows.filter((f) => f.toLowerCase() !== n.toLowerCase()) : [...follows, n].slice(0, 50) } });
  const options = [event.venue.name, event.organizer].filter((n): n is string => !!n && n.length >= 2 && !/^venue not listed$|^online$/i.test(n));

  return (
    <section aria-labelledby="follow" className="space-y-2">
      <h2 id="follow" className="font-serif text-xl">
        Get alerts for…
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={isFollowed(n)}
            onClick={() => toggle(n)}
            className={`rounded-full border px-3 py-1.5 text-sm ${isFollowed(n) ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}
          >
            {isFollowed(n) ? "✓ " : "+ "}
            {n}
          </button>
        ))}
      </div>
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (n.length >= 2 && !isFollowed(n)) toggle(n.slice(0, 80));
          setName("");
        }}
      >
        <label htmlFor="follow-artist" className="sr-only">
          Follow an artist or performer
        </label>
        <input id="follow-artist" value={name} onChange={(e) => setName(e.target.value)} placeholder="Follow an artist or performer…" maxLength={80} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm" />
        <button type="submit" className="rounded-full border border-line bg-card px-4 py-2 text-sm" disabled={name.trim().length < 2}>
          Follow
        </button>
      </form>
      <p className="text-xs text-muted">You&rsquo;ll get an alert when they have something new. Manage everything you follow in Settings → Alerts.</p>
    </section>
  );
}
