"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store/AppStore";
import { Notice, btn } from "../ui";

interface Status {
  available: boolean;
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  needsReconnect: boolean;
}

const RESULT: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "Google Calendar connected. Suggestions now fit around when you're actually busy." },
  declined: { tone: "warn", text: "Google Calendar wasn't connected — you can try again any time." },
  error: { tone: "bad", text: "Something went wrong connecting Google Calendar. Please try again." },
  unavailable: { tone: "warn", text: "Connecting Google Calendar isn't switched on for this app yet." },
};

export function CalendarSettings() {
  const { state, dispatch, snapshot, mode } = useStore();
  const params = useSearchParams();
  const result = params.get("calendar");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "server") return;
    fetch("/api/calendar/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => undefined);
  }, [mode, result]);

  const disconnect = async () => {
    setBusy(true);
    await fetch("/api/calendar/google/disconnect", { method: "POST" }).catch(() => undefined);
    // Reload so the app picks up the change from the server.
    window.location.assign("/settings");
  };

  const options = (["google", "snapshot", "demo", "disconnected"] as const).filter(
    (m) => (m === "google" ? status?.connected : m === "snapshot" ? !!snapshot : true),
  );

  return (
    <div className="space-y-3">
      {result && RESULT[result] && <Notice tone={RESULT[result]!.tone}>{RESULT[result]!.text}</Notice>}

      {mode === "server" && (
        <div className="space-y-2 rounded-lg border border-line bg-card p-3 text-sm">
          <p className="font-medium">Google Calendar</p>
          {status === null ? (
            <p className="text-muted">Checking…</p>
          ) : status.connected ? (
            <>
              <p className={status.needsReconnect ? "text-warn" : "text-ok"}>
                {status.needsReconnect
                  ? "Access has expired — reconnect to keep suggestions in sync."
                  : `Connected${status.lastSyncedAt ? ` · busy times updated ${new Date(status.lastSyncedAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}` : ""}.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {status.needsReconnect && (
                  <a href="/api/calendar/google/start" className={btn.primary}>
                    Reconnect
                  </a>
                )}
                <button type="button" className={btn.quiet} disabled={busy} onClick={disconnect}>
                  Disconnect
                </button>
              </div>
            </>
          ) : status.available ? (
            <a href="/api/calendar/google/start" className={btn.primary}>
              Connect Google Calendar
            </a>
          ) : (
            <p className="text-muted">Not switched on for this app yet (it needs Google sign-in set up on the server).</p>
          )}
          <p className="text-xs text-muted">
            Off Hours only sees when you&rsquo;re busy — never event names, places or guests — and can&rsquo;t add, change or delete anything. To put an event in your calendar, use
            &ldquo;Add to calendar&rdquo; on it and save it yourself. Events you&rsquo;ve marked as &ldquo;free&rdquo; in Google aren&rsquo;t counted as busy.
          </p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-xs text-muted">Use for suggestions</legend>
        {options.map((m) => (
          <label key={m} className="flex cursor-pointer gap-3 rounded-lg border border-line bg-card p-3 text-sm">
            <input type="radio" name="calmode" checked={state.calendarMode === m} onChange={() => dispatch({ type: "setCalendarMode", mode: m })} className="accent-[var(--accent)]" />
            {m === "google"
              ? "My Google Calendar (live busy times)"
              : m === "snapshot"
                ? `My Google Calendar busy times (copy from ${snapshot?.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "?"}, not live)`
                : m === "demo"
                  ? "Sample calendar (made-up busy times)"
                  : "No calendar — suggested times are unverified"}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
