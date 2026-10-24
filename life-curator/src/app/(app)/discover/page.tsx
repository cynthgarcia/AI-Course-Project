"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { EventCard } from "@/components/EventCard";
import { EmptyState, Notice } from "@/components/ui";
import { AREA_LABELS } from "@/lib/domain/areas";
import { costFromPrice, toBudgetAmount, tripTotal } from "@/lib/domain/budget";
import type { Recommendation } from "@/lib/domain/ranking";
import { isWeekend } from "@/lib/domain/ranking";
import { DAY } from "@/lib/domain/time";
import { initialTripCosts } from "@/lib/domain/trip";
import { CATEGORY_LABELS, type Category } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { durationMinutes } from "@/lib/ui/format";

const select = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm";

export default function DiscoverPage() {
  return (
    <Suspense fallback={null}>
      <Discover />
    </Suspense>
  );
}

function Discover() {
  const params = useSearchParams();
  const router = useRouter();
  const view = params.get("view") === "travel" ? "travel" : "local";
  const { state, derived } = useStore();
  const { prefs } = state;

  const [days, setDays] = useState(view === "travel" ? "90" : "14");
  const [category, setCategory] = useState<Category | "">("");
  const [maxPrice, setMaxPrice] = useState("");
  const [area, setArea] = useState("");
  const [social, setSocial] = useState("");
  const [dayType, setDayType] = useState("");
  const [duration, setDuration] = useState("");
  const [newOnly, setNewOnly] = useState(false);
  const [fitsOnly, setFitsOnly] = useState(true);
  const [browseProtected, setBrowseProtected] = useState(false);
  // Travel filters
  const [city, setCity] = useState("");
  const [maxTrip, setMaxTrip] = useState("");
  const [weekendOnly, setWeekendOnly] = useState(false);
  const [directOnly, setDirectOnly] = useState(false);
  const [deadlineSoon, setDeadlineSoon] = useState(false);
  const [strongOnly, setStrongOnly] = useState(false);
  const [oneOff, setOneOff] = useState(false);

  const results = useMemo(() => {
    if (!derived) return [];
    const source = browseProtected ? derived.browse : derived.recommend;
    const horizon = days === "all" ? Infinity : derived.now + Number(days) * DAY;
    return source.filter((r: Recommendation) => {
      const e = r.event;
      const start = Date.parse(e.start);
      if (start <= derived.now) return false;
      if (view === "local" ? !r.isLondon : r.isLondon) return false;
      if (start > horizon) return false;
      if (category && e.category !== category) return false;
      if (social && e.socialFit !== social && e.socialFit !== "either") return false;
      if (newOnly && !r.isNew) return false;
      if (dayType && (dayType === "weekend") !== isWeekend(e, prefs.timezone)) return false;
      const dur = durationMinutes(e);
      if (duration === "short" && (dur === null || dur > 120)) return false;
      if (duration === "long" && (dur === null || dur <= 120)) return false;
      if (maxPrice) {
        if (maxPrice === "free") {
          if (e.price.status !== "free") return false;
        } else {
          const amt = toBudgetAmount(costFromPrice(e), prefs);
          if (amt === null || amt > Number(maxPrice)) return false;
        }
      }
      if (fitsOnly && r.exclusions.length > 0) return false;
      if (view === "local") {
        if (area && e.venue.area !== area) return false;
      } else {
        if (city && e.destinationId !== city) return false;
        if (weekendOnly && !r.trip?.weekendCompatible) return false;
        if (directOnly && !r.trip?.route.direct) return false;
        if (strongOnly && r.breakdown.interest < 0.8) return false;
        if (oneOff && !e.tags.includes("one-off") && !e.tags.includes("hard-to-replicate")) return false;
        if (deadlineSoon && !(e.bookingDeadline && Date.parse(e.bookingDeadline) - derived.now < 30 * DAY)) return false;
        if (maxTrip) {
          const costs = state.trips[e.id]?.costs ?? initialTripCosts(e, r.trip, prefs.budgetCurrency);
          const t = tripTotal(costs, prefs);
          if (t.total === null || t.total > Number(maxTrip)) return false;
        }
      }
      return true;
    });
  }, [derived, browseProtected, days, view, category, social, newOnly, dayType, duration, maxPrice, fitsOnly, area, city, weekendOnly, directOnly, strongOnly, oneOff, deadlineSoon, maxTrip, prefs, state.trips]);

  if (!derived) return null;
  const cities = [...new Map(derived.events.filter((e) => e.destinationId).map((e) => [e.destinationId!, `${e.venue.city}, ${e.venue.country}`])).entries()];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Discover</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">{view === "local" ? "Around London" : "Travel-worthy experiences"}</h1>
        <p className="mt-2 max-w-prose text-muted">
          {view === "local"
            ? "Everything on the radar, ranked for you. Narrow it down however you like."
            : "Events across Europe that may be worth the journey — with an honest look at whether the trip works."}
        </p>
      </div>

      <div role="tablist" aria-label="Discover view" className="inline-flex rounded-full border border-line bg-card p-1 text-sm">
        {(["local", "travel"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => {
              setDays(v === "travel" ? "90" : "14");
              router.replace(v === "travel" ? "/discover?view=travel" : "/discover");
            }}
            className={`rounded-full px-4 py-1.5 ${view === v ? "bg-ink text-paper" : "text-muted"}`}
          >
            {v === "local" ? "London" : "Europe"}
          </button>
        ))}
      </div>

      <details className="rounded-xl border border-line bg-card p-4" open>
        <summary className="cursor-pointer font-medium">Filters</summary>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="When">
            <select className={select} value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="7">Next 7 days</option>
              <option value="14">Next 14 days</option>
              <option value="42">Next 6 weeks</option>
              <option value="90">Next 3 months</option>
              <option value="all">Any time</option>
            </select>
          </Field>
          <Field label="Category">
            <select className={select} value={category} onChange={(e) => setCategory(e.target.value as Category | "")}>
              <option value="">All</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ticket price">
            <select className={select} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
              <option value="">Any</option>
              <option value="free">Free only</option>
              <option value="25">Up to £25</option>
              <option value="50">Up to £50</option>
              <option value="100">Up to £100</option>
            </select>
          </Field>
          {view === "local" ? (
            <Field label="Neighbourhood">
              <select className={select} value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">Anywhere in London</option>
                {Object.entries(AREA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="City">
              <select className={select} value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">All of Europe</option>
                {cities.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Company">
            <select className={select} value={social} onChange={(e) => setSocial(e.target.value)}>
              <option value="">Solo or with friends</option>
              <option value="friends">Good with friends</option>
              <option value="solo">Good solo</option>
              <option value="meet_people">Easy to meet people</option>
            </select>
          </Field>
          <Field label="Days">
            <select className={select} value={dayType} onChange={(e) => setDayType(e.target.value)}>
              <option value="">Any day</option>
              <option value="weekday">Weekdays</option>
              <option value="weekend">Weekends</option>
            </select>
          </Field>
          <Field label="Duration">
            <select className={select} value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="">Any length</option>
              <option value="short">Up to 2 hours</option>
              <option value="long">Longer than 2 hours</option>
            </select>
          </Field>
          {view === "travel" && (
            <Field label="Max trip total (£)">
              <input inputMode="numeric" className={select} value={maxTrip} onChange={(e) => setMaxTrip(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Any" />
            </Field>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Check checked={fitsOnly} onChange={setFitsOnly} label="Only things that fit my calendar & preferences" />
          <Check checked={newOnly} onChange={setNewOnly} label="New experiences" />
          <Check checked={browseProtected} onChange={setBrowseProtected} label="Include my protected time (browse only)" />
          {view === "travel" && (
            <>
              <Check checked={weekendOnly} onChange={setWeekendOnly} label="Fits a weekend" />
              <Check checked={directOnly} onChange={setDirectOnly} label="Direct route (reference)" />
              <Check checked={deadlineSoon} onChange={setDeadlineSoon} label="Booking deadline within 30 days" />
              <Check checked={strongOnly} onChange={setStrongOnly} label="Strong interest match" />
              <Check checked={oneOff} onChange={setOneOff} label="Unusual or one-off" />
            </>
          )}
        </div>
        {view === "travel" && maxTrip && (
          <p className="mt-3 text-xs text-muted">Trips whose total is still unknown are hidden by this filter — add your research estimates on a trip to include it.</p>
        )}
      </details>

      {browseProtected && (
        <Notice tone="warn">You&rsquo;re browsing inside Personal Time and time kept for friends. Those blocks stay protected — nothing gets moved or recategorised.</Notice>
      )}
      {view === "travel" && (
        <Notice>
          Journey times are typical scheduled durations for planning, not live timetables. Fares and hotel prices aren&rsquo;t fetched yet, so trip totals stay unknown until you add research.
        </Notice>
      )}

      <p className="text-sm text-muted" aria-live="polite">
        {results.length} {results.length === 1 ? "result" : "results"}
      </p>
      {results.length === 0 ? (
        <EmptyState title="Nothing matches these filters">
          Try widening the dates or turning off &ldquo;Only things that fit&rdquo;. Protected time is only included if you ask.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.map((r) => (
            <EventCard key={r.event.id} rec={r} showExclusions={!fitsOnly} />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}
