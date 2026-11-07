"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PushToggle } from "@/components/PushToggle";
import { EmptyState, Notice } from "@/components/ui";
import { formatShortDay, formatTime } from "@/lib/domain/time";
import { useStore } from "@/lib/store/AppStore";

interface Item {
  eventId: string;
  title: string;
  reason: string;
  startsAt: string;
  createdAt: string;
  read: boolean;
}

export default function AlertsPage() {
  const { mode, state } = useStore();
  const [items, setItems] = useState<Item[] | null>(null);
  const tz = state.prefs.timezone;
  const follows = state.prefs.follows ?? [];

  useEffect(() => {
    if (mode !== "server") return;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((b: { items: Item[] }) => {
        setItems(b.items);
        if (b.items.some((i) => !i.read)) void fetch("/api/notifications/read", { method: "POST" });
      })
      .catch(() => setItems([]));
  }, [mode]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Alerts</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Don&rsquo;t miss the good ones</h1>
        <p className="mt-2 max-w-prose text-muted">
          You&rsquo;ll hear about events from artists, venues and names you follow, plus the occasional very strong match that fits your calendar — a few a day at most, in the afternoon.
        </p>
      </div>

      {mode === "local" ? (
        <Notice tone="warn">Alerts need the live app with an account. They aren&rsquo;t available in this preview.</Notice>
      ) : (
        <>
          <section aria-labelledby="device" className="space-y-2 rounded-xl border border-line bg-card p-4">
            <h2 id="device" className="font-serif text-xl">
              Notifications
            </h2>
            <PushToggle />
          </section>

          <section aria-labelledby="following" className="space-y-2">
            <h2 id="following" className="font-serif text-xl">
              You follow
            </h2>
            {follows.length ? (
              <p className="text-sm">{follows.join(" · ")}</p>
            ) : (
              <p className="text-sm text-muted">Nothing yet.</p>
            )}
            <Link href="/settings#s-alerts" className="text-sm text-accent underline">
              Follow artists, venues or anything else
            </Link>
          </section>

          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-3 font-serif text-xl">
              Recent alerts
            </h2>
            {items === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : items.length === 0 ? (
              <EmptyState title="No alerts yet">They&rsquo;ll appear here when something you&rsquo;d love is announced.</EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-card">
                {items.map((i) => (
                  <li key={i.eventId} className="space-y-0.5 px-4 py-3">
                    <Link href={`/events/${encodeURIComponent(i.eventId)}`} className={`font-medium hover:underline ${i.read ? "" : "text-accent"}`}>
                      {i.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {formatShortDay(Date.parse(i.startsAt), tz)} {formatTime(Date.parse(i.startsAt), tz)} · {i.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
