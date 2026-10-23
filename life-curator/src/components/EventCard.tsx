"use client";

import Link from "next/link";
import { describeFit } from "@/lib/domain/availability";
import { costFromPrice, describePrice, formatMoney, monthOf, toBudgetAmount, tripTotal } from "@/lib/domain/budget";
import type { Recommendation } from "@/lib/domain/ranking";
import { formatDuration } from "@/lib/domain/time";
import { initialTripCosts } from "@/lib/domain/trip";
import { CATEGORY_LABELS, PROTECTED_LABELS } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { CATEGORY_TINT, durationMinutes, placeLabel, verificationLabel, whenLabel } from "@/lib/ui/format";
import { QuickActions } from "./EventActions";
import { Badge } from "./ui";

export function EventCard({ rec, showExclusions = false }: { rec: Recommendation; showExclusions?: boolean }) {
  const { state, derived } = useStore();
  const { event, fit, trip } = rec;
  const { prefs } = state;
  const tz = prefs.timezone;
  const amount = toBudgetAmount(costFromPrice(event), prefs);
  const duration = durationMinutes(event);
  const headingId = `ev-${event.id}`;

  return (
    <article aria-labelledby={headingId} className="relative overflow-hidden rounded-xl border border-line bg-card">
      <div aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: CATEGORY_TINT[event.category] }} />
      <div className="space-y-3 p-4 pl-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">{CATEGORY_LABELS[event.category]}</span>
          {event.isDemo && <Badge tone="warn">Sample</Badge>}
          {!rec.isLondon && <Badge tone="info">Travel-worthy</Badge>}
          {rec.isNew && (
            <Badge tone="accent" title={rec.newReason ?? undefined}>
              New for you
            </Badge>
          )}
          {event.occurrenceGroupId && <Badge>Several dates</Badge>}
        </div>

        <div>
          <h3 id={headingId} className="font-serif text-xl leading-snug">
            <Link href={`/events/${encodeURIComponent(event.id)}`} className="hover:underline">
              {event.title}
            </Link>
          </h3>
          <p className="mt-1 text-sm">
            {whenLabel(event, tz)}
            {duration !== null && <span className="text-muted"> · {formatDuration(duration)}</span>}
          </p>
          <p className="text-sm text-muted">{placeLabel(event)}</p>
        </div>

        <dl className="grid gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="sr-only">Price</dt>
            <dd>
              <span className="font-medium">{describePrice(event)}</span>
              {event.isDemo && event.price.status !== "unknown" && <span className="text-muted"> (sample price)</span>}
              {derived && amount !== null && amount > 0 && (
                <span className="text-muted">
                  {" "}
                  · leaves {formatMoney(Math.max(0, derived.budgetForMonth(monthOf(event, tz)).remaining - amount), prefs.budgetCurrency)} of that month&rsquo;s budget if planned
                </span>
              )}
              {amount === null && event.price.status !== "unknown" && <span className="text-muted"> · not converted to {prefs.budgetCurrency}</span>}
            </dd>
          </div>
          {fit && (
            <div>
              <dt className="sr-only">Calendar fit</dt>
              <dd className={fit.hardBlocked ? "text-bad" : fit.status === "unverified" ? "text-warn" : "text-ok"}>
                {describeFit(fit, event.venue.area, tz)}
              </dd>
            </div>
          )}
          {fit?.protectedOverlap && !fit.hardBlocked && (
            <dd className="text-warn">Browsing inside {PROTECTED_LABELS[fit.protectedOverlap]} — it stays protected.</dd>
          )}
          {trip && (
            <div>
              <dt className="sr-only">Trip</dt>
              <dd className={trip.hardBlocked ? "text-bad" : trip.weekendCompatible ? "text-ok" : "text-warn"}>
                {trip.route.mode === "rail" ? "Train" : "Flight"} · about {formatDuration(trip.doorToDoorMinutes)} door to door (reference, not live) ·{" "}
                {trip.dayTrip ? "day trip possible" : "overnight likely"} ·{" "}
                {trip.weekendCompatible ? "fits a weekend" : `needs time off (${trip.leaveDays.map((d) => d.weekday.toUpperCase()).join(", ")})`}
                {!trip.calendarVerified && " · calendar unverified"}
              </dd>
              <dd className="text-muted">
                {(() => {
                  const t = tripTotal(initialTripCosts(event, trip, prefs.budgetCurrency), prefs);
                  const research = t.missing.filter((m) => !t.unconverted.includes(m));
                  return research.length ? `Trip total unknown — still to research: ${research.join(", ")}.` : null;
                })()}
              </dd>
            </div>
          )}
          {rec.whyItFits.length > 0 && (
            <div>
              <dt className="sr-only">Why it fits</dt>
              <dd className="text-muted">{rec.whyItFits.slice(0, 2).join(" ")}</dd>
            </div>
          )}
          {showExclusions && rec.exclusions.length > 0 && (
            <div>
              <dt className="sr-only">Not recommended because</dt>
              <dd className="text-bad">{rec.exclusions[0]}</dd>
            </div>
          )}
          <div>
            <dt className="sr-only">Verification</dt>
            <dd className="text-xs text-muted">{verificationLabel(event.verification)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {rec.isLondon ? <QuickActions event={event} /> : <span className="text-sm text-muted">{state.trips[event.id] ? "On your travel shortlist" : ""}</span>}
          <Link href={`/events/${encodeURIComponent(event.id)}`} className="text-sm font-medium text-accent hover:underline">
            Details{!rec.isLondon && " & trip"} →
          </Link>
        </div>
      </div>
    </article>
  );
}
