"use client";

import { useState } from "react";
import { checkProposal, formatMoney, monthOf, tripTotal, TRIP_COMPONENTS } from "@/lib/domain/budget";
import { getDestination } from "@/lib/domain/destinations";
import type { Recommendation } from "@/lib/domain/ranking";
import { nextTravelStatuses } from "@/lib/domain/status";
import { formatDay, formatDuration, formatShortDay, formatTime } from "@/lib/domain/time";
import { initialTripCosts } from "@/lib/domain/trip";
import { TRAVEL_STATUS_LABELS, type TravelStatus, type TripCosts } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { CostInput } from "./CostInput";
import { Badge, btn } from "./ui";

const COMPONENT_LABELS: Record<keyof TripCosts, string> = {
  ticket: "Event ticket",
  transport: "Transport",
  accommodation: "Accommodation",
  other: "Other known costs",
};

export function TripPanel({ rec }: { rec: Recommendation }) {
  const { state, dispatch, derived } = useStore();
  const { event, trip } = rec;
  const { prefs } = state;
  const tz = prefs.timezone;
  const dest = getDestination(event.destinationId);
  const saved = state.trips[event.id];
  const costs = saved?.costs ?? initialTripCosts(event, trip, prefs.budgetCurrency);
  const totals = tripTotal(costs, prefs);
  const [pendingPlan, setPendingPlan] = useState(false);
  const now = () => new Date().toISOString();

  if (!trip || !dest || !derived) {
    return <p className="text-sm text-muted">Trip feasibility can&rsquo;t be assessed for this destination yet.</p>;
  }

  const setStatus = (status: TravelStatus, override?: boolean) =>
    dispatch({ type: "setTripStatus", eventId: event.id, category: event.category, status, initialCosts: costs, budgetOverride: override, at: now() });

  const tryPlan = () => {
    const check = checkProposal(derived.budgetForMonth(monthOf(event, tz)), totals.countedMissing.length ? null : totals.countedInBudget);
    if (check.kind === "ok") setStatus("planned", false);
    else setPendingPlan(true);
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="feas" className="space-y-3">
        <h2 id="feas" className="font-serif text-xl">
          Does the trip work?
        </h2>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={trip.weekendCompatible ? "ok" : "warn"}>{trip.weekendCompatible ? "Fits a weekend" : "Needs time off"}</Badge>
          <Badge>{trip.dayTrip ? "Day trip possible" : "Overnight likely"}</Badge>
          {trip.conflict && <Badge tone="bad">Calendar clash</Badge>}
          {trip.protectedOverlap && <Badge tone="warn">Touches protected time</Badge>}
          {!trip.calendarVerified && <Badge tone="warn">Calendar unverified</Badge>}
        </div>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
          <dt className="text-muted">Route (reference)</dt>
          <dd>
            {trip.route.mode === "rail" ? "Train" : "Flight"}: {trip.route.from} → {trip.route.to}
            {trip.route.direct ? " · direct" : ""}
          </dd>
          <dt className="text-muted">Typical journey</dt>
          <dd>
            About {formatDuration(trip.route.typicalMinutes)} on board · about {formatDuration(trip.doorToDoorMinutes)} door to door including transfers and check-in
          </dd>
          <dt className="text-muted">Leave home by</dt>
          <dd>
            {formatDay(trip.latestLeaveHome, tz)}, {formatTime(trip.latestLeaveHome, tz)} at the latest (London time)
          </dd>
          <dt className="text-muted">Suggested window</dt>
          <dd>
            {formatShortDay(trip.window.start, tz)} {formatTime(trip.window.start, tz)} → home {formatShortDay(trip.window.end, tz)} {formatTime(trip.window.end, tz)}
          </dd>
        </dl>
        {trip.concerns.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-warn">
            {trip.concerns.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Journey times are typical scheduled durations, not live timetables. Check current options before deciding:
        </p>
        <ul className="flex flex-wrap gap-2 text-sm">
          {dest.researchLinks.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="costs" className="space-y-3">
        <h2 id="costs" className="font-serif text-xl">
          What it might cost
        </h2>
        {saved ? (
          <div className="space-y-3">
            {TRIP_COMPONENTS.map((k) => (
              <CostInput
                key={k}
                label={COMPONENT_LABELS[k]}
                value={costs[k]}
                defaultCurrency={prefs.budgetCurrency}
                onChange={(c) => dispatch({ type: "setTripCosts", eventId: event.id, costs: { ...costs, [k]: c }, at: now() })}
              />
            ))}
          </div>
        ) : (
          <dl className="grid grid-cols-[11rem_1fr] gap-y-1 text-sm">
            {TRIP_COMPONENTS.map((k) => (
              <div key={k} className="contents">
                <dt className="text-muted">{COMPONENT_LABELS[k]}</dt>
                <dd>{costs[k].basis === "not_needed" ? "Not needed" : costs[k].amount === null ? "Unknown — needs research" : `${formatMoney(costs[k].amount!, costs[k].currency)}${costs[k].basis === "sample" ? " (sample)" : ""}`}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="rounded-lg bg-line/40 p-3 text-sm">
          <p>
            Known so far: <strong>{formatMoney(totals.known, prefs.budgetCurrency)}</strong>
            {totals.total !== null ? " — complete estimate." : <MissingNote missing={totals.missing} unconverted={totals.unconverted} />}
          </p>
          <p className="mt-1 text-muted">
            {prefs.countTravelInBudget
              ? "Ticket, transport, accommodation and other costs all count against your monthly activity budget once planned."
              : "Only the ticket and other costs count against your activity budget; transport and accommodation are shown separately (change in Settings)."}{" "}
            Amounts in other currencies are only converted if you&rsquo;ve set an exchange rate.
          </p>
        </div>
        {!saved && <p className="text-xs text-muted">Save this trip to add your own research estimates.</p>}
      </section>

      <section aria-labelledby="tstatus" className="space-y-3">
        <h2 id="tstatus" className="font-serif text-xl">
          Travel shortlist
        </h2>
        <p className="text-sm text-muted">
          {saved ? `Status: ${TRAVEL_STATUS_LABELS[saved.status]}.` : "Not on your shortlist yet."} Saving or planning a trip doesn&rsquo;t book anything.
        </p>
        {pendingPlan ? (
          <div role="alertdialog" aria-label="Budget check" className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
            <p>
              {totals.countedMissing.length
                ? "Some costs are still unknown, so I can't check this against your budget."
                : "This trip would take you over what's left for that month."}{" "}
              Mark it planned anyway?
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" className={btn.primary} onClick={() => { setStatus("planned", true); setPendingPlan(false); }}>
                Plan anyway
              </button>
              <button type="button" className={btn.quiet} onClick={() => setPendingPlan(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nextTravelStatuses(saved?.status ?? null)
              .filter((s) => s !== "attended" || Date.parse(event.start) <= derived.now)
              .map((s) => (
                <button key={s} type="button" className={s === "not_for_me" ? btn.quiet : btn.secondary} onClick={() => (s === "planned" ? tryPlan() : setStatus(s))}>
                  {s === "interested" && !saved ? "Save to travel shortlist" : TRAVEL_STATUS_LABELS[s]}
                </button>
              ))}
            {saved && (
              <button type="button" className={btn.quiet} onClick={() => dispatch({ type: "removeTrip", eventId: event.id })}>
                Remove from shortlist
              </button>
            )}
          </div>
        )}
        {saved && (
          <label className="block text-sm">
            <span className="text-muted">Research notes</span>
            <textarea
              value={saved.notes}
              onChange={(e) => dispatch({ type: "setTripNotes", eventId: event.id, notes: e.target.value, at: now() })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm"
              placeholder="Train times you found, hotel ideas, who might come…"
            />
          </label>
        )}
      </section>
    </div>
  );
}

function MissingNote({ missing, unconverted }: { missing: (keyof TripCosts)[]; unconverted: (keyof TripCosts)[] }) {
  const unknown = missing.filter((m) => !unconverted.includes(m));
  const label = (ks: (keyof TripCosts)[]) => ks.map((m) => COMPONENT_LABELS[m].toLowerCase()).join(", ");
  return (
    <>
      .{unknown.length > 0 && ` Still unknown: ${label(unknown)}.`}
      {unconverted.length > 0 && ` Known but not converted to your budget currency: ${label(unconverted)}.`}
    </>
  );
}
