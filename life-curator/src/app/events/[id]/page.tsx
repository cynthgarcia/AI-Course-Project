"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CostInput } from "@/components/CostInput";
import { DismissControl, PlanControl } from "@/components/EventActions";
import { InvitationDraft } from "@/components/InvitationDraft";
import { TripPanel } from "@/components/TripPanel";
import { Badge, EmptyState, btn } from "@/components/ui";
import { describeFit } from "@/lib/domain/availability";
import { describePrice } from "@/lib/domain/budget";
import { canonicalUrl } from "@/lib/domain/dedupe";
import { canConfirmAttendance, nextLocalStatuses } from "@/lib/domain/status";
import { formatDuration, formatShortDay, formatTime } from "@/lib/domain/time";
import { CATEGORY_LABELS, DISMISSAL_LABELS, LOCAL_STATUS_LABELS, PROTECTED_LABELS, type CostItem, type CuratorEvent, type LocalStatus, type Reflection } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { durationMinutes, placeLabel, verificationLabel, whenLabel } from "@/lib/ui/format";

/** Only http(s) links are ever rendered. */
function safeHref(url: string | null): string | null {
  return url && canonicalUrl(url) ? url : null;
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const { state, derived } = useStore();
  if (!derived) return null;
  const rec = derived.recommend.find((r) => r.event.id === id);
  const browseRec = derived.browse.find((r) => r.event.id === id);
  if (!rec || !browseRec) {
    return (
      <EmptyState title="We couldn't find that event">
        It may have finished or been removed from its source. <Link href="/discover" className="text-accent underline">Back to Discover</Link>
      </EmptyState>
    );
  }
  const { event } = rec;
  const tz = state.prefs.timezone;
  const official = safeHref(event.officialUrl);
  const booking = safeHref(event.bookingUrl);
  const duration = durationMinutes(event);
  const others = event.occurrenceGroupId ? derived.events.filter((e) => e.occurrenceGroupId === event.occurrenceGroupId && e.id !== event.id) : [];

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <Link href="/discover" className="text-sm text-muted hover:text-ink">
        ← Discover
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">{CATEGORY_LABELS[event.category]}</span>
          {event.isDemo && <Badge tone="warn">Sample event — fictional</Badge>}
          {!rec.isLondon && <Badge tone="info">Travel-worthy</Badge>}
          {rec.isNew && <Badge tone="accent">New for you</Badge>}
        </div>
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{event.title}</h1>
        <p>
          {whenLabel(event, tz)}
          {duration !== null && <span className="text-muted"> · {formatDuration(duration)}</span>}
        </p>
        <p className="text-muted">{placeLabel(event)}</p>
      </header>

      <section aria-labelledby="facts">
        <h2 id="facts" className="sr-only">
          Event facts
        </h2>
        <dl className="grid gap-x-4 gap-y-2 rounded-xl border border-line bg-card p-4 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted">Price</dt>
          <dd>
            {describePrice(event)}
            {event.isDemo && event.price.status !== "unknown" && " (sample)"}
            {event.price.status !== "free" && event.price.status !== "unknown" && event.price.includesFees !== true && <span className="text-muted"> · booking fees not confirmed</span>}
          </dd>
          <dt className="text-muted">Venue</dt>
          <dd>
            {event.venue.name}
            {event.venue.address ? `, ${event.venue.address}` : <span className="text-muted"> · address not listed</span>}
          </dd>
          <dt className="text-muted">Who can attend</dt>
          <dd>{{ public: "Open to the public", members: "Members only", invite_only: "Invitation only — eligibility not established", unknown: "Not confirmed" }[event.eligibility]}</dd>
          {event.dressCode && (
            <>
              <dt className="text-muted">Dress code</dt>
              <dd>{event.dressCode}</dd>
            </>
          )}
          <dt className="text-muted">Accessibility</dt>
          <dd>{event.accessibility ?? <span className="text-muted">Not listed — check with the venue</span>}</dd>
          {event.bookingDeadline && (
            <>
              <dt className="text-muted">Book by</dt>
              <dd>{formatShortDay(Date.parse(event.bookingDeadline), tz)}</dd>
            </>
          )}
          <dt className="text-muted">Source</dt>
          <dd>
            {verificationLabel(event.verification)} · {event.verification.sourceName}
            {event.sourceRecords.length > 1 && <span className="text-muted"> · seen in {event.sourceRecords.length} feeds</span>}
          </dd>
          <dt className="text-muted">Links</dt>
          <dd className="flex flex-wrap gap-3">
            {official ? (
              <a href={official} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Official page ↗
              </a>
            ) : (
              <span className="text-muted">No official link{event.isDemo ? " (sample event)" : ""}</span>
            )}
            {booking && (
              <a href={booking} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Booking page ↗
              </a>
            )}
          </dd>
        </dl>
        {official && <p className="mt-2 text-xs text-muted">Ticket availability isn&rsquo;t checked here — the official page is the source of truth.</p>}
      </section>

      <section aria-labelledby="about" className="space-y-3">
        <h2 id="about" className="font-serif text-xl">
          About
        </h2>
        <p className="whitespace-pre-line">{event.description || "No description provided."}</p>
        {(rec.whyItFits.length > 0 || rec.newReason) && (
          <div className="rounded-lg bg-accent-soft p-3 text-sm">
            <p className="font-medium text-accent">Why this might suit you</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {rec.whyItFits.map((w) => (
                <li key={w}>{w}</li>
              ))}
              {rec.newReason && <li>{rec.newReason}</li>}
            </ul>
          </div>
        )}
      </section>

      {rec.isLondon && rec.fit && (
        <section aria-labelledby="fit" className="space-y-2">
          <h2 id="fit" className="font-serif text-xl">
            Does it fit?
          </h2>
          <p className={rec.fit.hardBlocked ? "text-bad" : rec.fit.status === "unverified" ? "text-warn" : "text-ok"}>{describeFit(rec.fit, event.venue.area, tz)}</p>
          {browseRec.fit?.protectedOverlap && (
            <p className="text-sm text-warn">This falls in your {PROTECTED_LABELS[browseRec.fit.protectedOverlap]}. That block stays protected — you can still choose to go.</p>
          )}
          {rec.fit.homeArrival && <p className="text-sm text-muted">Home around {formatTime(rec.fit.homeArrival, tz)} (approximate).</p>}
          {rec.fit.warnings.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted">
              {rec.fit.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {rec.exclusions.length > 0 && !rec.fit.hardBlocked && <p className="text-sm text-bad">{rec.exclusions[0]}</p>}
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="dates">
          <h2 id="dates" className="font-serif text-xl">
            Other dates
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {others.map((o) => (
              <li key={o.id}>
                <Link href={`/events/${encodeURIComponent(o.id)}`} className="text-accent underline">
                  {whenLabel(o, tz)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rec.isLondon ? <LocalPlanning event={event} /> : <TripPanel rec={browseRec} />}

      <InvitationDraft event={event} />
    </article>
  );
}

function LocalPlanning({ event }: { event: CuratorEvent }) {
  const { state, dispatch, derived } = useStore();
  const saved = state.saved[event.id];
  const status = saved?.status ?? null;
  const [confirmAttend, setConfirmAttend] = useState(false);
  const at = () => new Date().toISOString();
  const set = (s: LocalStatus) => dispatch({ type: "setStatus", eventId: event.id, category: event.category, status: s, at: at() });
  const started = derived ? canConfirmAttendance(Date.parse(event.start), derived.now) : false;
  const allowed = nextLocalStatuses(status);

  return (
    <section aria-labelledby="plan" className="space-y-4">
      <h2 id="plan" className="font-serif text-xl">
        Your plans
      </h2>
      <p className="text-sm text-muted">
        {status ? <>Status: <strong className="text-ink">{LOCAL_STATUS_LABELS[status]}</strong>.</> : "Not saved yet."}
        {saved?.dismissalReason && ` Reason: ${DISMISSAL_LABELS[saved.dismissalReason]}.`}
        {status === "planned" && " Planned doesn't mean a ticket was bought — that's up to you."}
        {saved?.budgetOverride && " You chose to go over budget for this."}
      </p>
      <div className="flex flex-wrap gap-2">
        {allowed.includes("interested") && <button type="button" className={btn.secondary} onClick={() => set("interested")}>Interested</button>}
        {allowed.includes("saved") && <button type="button" className={btn.primary} onClick={() => set("saved")}>Save</button>}
        {allowed.includes("planned") && <PlanControl event={event} />}
        {allowed.includes("attended") && started && !confirmAttend && (
          <button type="button" className={btn.secondary} onClick={() => setConfirmAttend(true)}>
            I went
          </button>
        )}
        {allowed.includes("skipped") && <button type="button" className={btn.quiet} onClick={() => set("skipped")}>Skipped it</button>}
        {status !== "not_for_me" && status !== "attended" && <DismissControl event={event} />}
        {status && (
          <button type="button" className={btn.quiet} onClick={() => dispatch({ type: "removeSaved", eventId: event.id })}>
            Clear status
          </button>
        )}
      </div>
      {allowed.includes("attended") && !started && <p className="text-xs text-muted">You can mark it attended once it has started.</p>}
      {confirmAttend && (
        <div role="alertdialog" aria-label="Confirm attendance" className="flex flex-wrap items-center gap-2 rounded-lg bg-ok-soft p-3 text-sm text-ok">
          Confirm you attended?
          <button type="button" className={btn.primary} onClick={() => { set("attended"); setConfirmAttend(false); }}>
            Yes, I went
          </button>
          <button type="button" className={btn.quiet} onClick={() => setConfirmAttend(false)}>
            Cancel
          </button>
        </div>
      )}

      {saved && (status === "planned" || status === "attended" || saved.actualCost) && (
        <ActualCost eventId={event.id} current={saved.actualCost} currency={state.prefs.budgetCurrency} />
      )}

      {saved && (
        <label className="block text-sm">
          <span className="text-muted">Notes</span>
          <textarea
            value={saved.notes}
            onChange={(e) => dispatch({ type: "setNotes", eventId: event.id, notes: e.target.value, at: at() })}
            rows={2}
            className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm"
          />
        </label>
      )}

      {status === "attended" && saved && <ReflectionForm event={event} current={saved.reflection} />}
    </section>
  );
}

function ActualCost({ eventId, current, currency }: { eventId: string; current: CostItem | null; currency: string }) {
  const { dispatch } = useStore();
  const [value, setValue] = useState<CostItem>(current ?? { amount: null, currency, basis: "verified" });
  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <p className="text-sm font-medium">What did it actually cost?</p>
      <CostInput label="Actual cost" value={value} onChange={setValue} defaultCurrency={currency} />
      <div className="flex gap-2">
        <button type="button" className={btn.secondary} disabled={value.amount === null} onClick={() => dispatch({ type: "recordActualCost", eventId, cost: { ...value, basis: "verified" }, at: new Date().toISOString() })}>
          Save actual cost
        </button>
        {current && (
          <button type="button" className={btn.quiet} onClick={() => dispatch({ type: "recordActualCost", eventId, cost: null, at: new Date().toISOString() })}>
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-muted">The actual cost replaces the planned estimate in your budget — it&rsquo;s never counted twice.</p>
    </div>
  );
}

function ReflectionForm({ event, current }: { event: CuratorEvent; current: Reflection | null }) {
  const { dispatch } = useStore();
  const [r, setR] = useState<Reflection>(current ?? { enjoyed: null, wouldRepeat: null, wasNew: null, wouldRecommend: null, notes: "" });
  const [saved, setSaved] = useState(false);
  const q: [keyof Omit<Reflection, "notes">, string][] = [
    ["enjoyed", "Did you enjoy it?"],
    ["wouldRepeat", "Would you do it again?"],
    ["wasNew", "Was it new for you?"],
    ["wouldRecommend", "Would you recommend it?"],
  ];
  return (
    <fieldset className="space-y-3 rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-medium">Reflection (optional)</legend>
      {q.map(([k, label]) => (
        <div key={k} className="flex flex-wrap items-center gap-3 text-sm" role="radiogroup" aria-label={label}>
          <span className="w-48">{label}</span>
          {([true, false] as const).map((v) => (
            <label key={String(v)} className="flex items-center gap-1">
              <input type="radio" name={`${event.id}-${k}`} checked={r[k] === v} onChange={() => setR({ ...r, [k]: v })} className="accent-[var(--accent)]" />
              {v ? "Yes" : "No"}
            </label>
          ))}
        </div>
      ))}
      <label className="block text-sm">
        <span className="text-muted">Anything to remember?</span>
        <textarea value={r.notes} onChange={(e) => setR({ ...r, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" />
      </label>
      <button
        type="button"
        className={btn.secondary}
        onClick={() => {
          dispatch({ type: "setReflection", eventId: event.id, category: event.category, reflection: r, at: new Date().toISOString() });
          setSaved(true);
        }}
      >
        Save reflection
      </button>
      {saved && <p role="status" className="text-xs text-muted">Saved.</p>}
    </fieldset>
  );
}
