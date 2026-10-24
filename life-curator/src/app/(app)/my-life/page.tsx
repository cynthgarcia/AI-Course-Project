"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { costFromPrice, formatMoney, toBudgetAmount, tripTotal } from "@/lib/domain/budget";
import { CATEGORY_LABELS, LOCAL_STATUS_LABELS, TRAVEL_STATUS_LABELS, type Category, type LocalStatus, type TravelStatus } from "@/lib/domain/types";
import { useStore } from "@/lib/store/AppStore";
import { costLabel, placeLabel, whenLabel } from "@/lib/ui/format";

type Tab = LocalStatus | "travel";
const TABS: Tab[] = ["interested", "saved", "invited", "planned", "attended", "skipped", "not_for_me", "travel"];
const input = "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm";

export default function MyLifePage() {
  const { state, derived } = useStore();
  const [tab, setTab] = useState<Tab>("planned");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [when, setWhen] = useState<"all" | "upcoming" | "past">("all");
  const [maxCost, setMaxCost] = useState("");
  const [travelStatus, setTravelStatus] = useState<TravelStatus | "">("");
  const { prefs } = state;
  const tz = prefs.timezone;

  const counts = useMemo(() => {
    const c: Record<string, number> = { travel: Object.keys(state.trips).length };
    for (const s of Object.values(state.saved)) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [state.saved, state.trips]);

  const matches = (eventId: string, cost: number | null) => {
    const e = derived?.eventMap.get(eventId);
    if (!e || !derived) return false;
    const hay = `${e.title} ${e.venue.name} ${e.venue.neighborhood ?? ""} ${e.venue.city} ${e.venue.country}`.toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (category && e.category !== category) return false;
    const start = Date.parse(e.start);
    if (when === "upcoming" && start <= derived.now) return false;
    if (when === "past" && start > derived.now) return false;
    if (maxCost && (cost === null || cost > Number(maxCost))) return false;
    return true;
  };

  if (!derived) return null;

  const localItems =
    tab === "travel"
      ? []
      : Object.values(state.saved)
          .filter((s) => s.status === tab)
          .map((s) => {
            const e = derived.eventMap.get(s.eventId);
            const cost = s.actualCost ?? s.plannedCost ?? (e ? costFromPrice(e) : null);
            return { s, e, cost, amount: toBudgetAmount(cost, prefs) };
          })
          .filter((x) => x.e && matches(x.s.eventId, x.amount))
          .sort((a, b) => Date.parse(a.e!.start) - Date.parse(b.e!.start));

  const tripItems =
    tab !== "travel"
      ? []
      : Object.values(state.trips)
          .filter((t) => !travelStatus || t.status === travelStatus)
          .map((t) => ({ t, e: derived.eventMap.get(t.eventId), total: tripTotal(t.actualCosts ?? t.costs, prefs) }))
          .filter((x) => x.e && matches(x.t.eventId, x.total.total))
          .sort((a, b) => Date.parse(a.e!.start) - Date.parse(b.e!.start));

  const orphaned = Object.keys(state.saved).filter((id) => !derived.eventMap.has(id)).length + Object.keys(state.trips).filter((id) => !derived.eventMap.has(id)).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">My Life</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Your experiences</h1>
        <p className="mt-2 max-w-prose text-muted">Everything you&rsquo;ve saved, planned and done — and the trips you&rsquo;re mulling over.</p>
      </div>

      <div role="tablist" aria-label="Status" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full border px-3 py-1.5 ${tab === t ? "border-ink bg-ink text-paper" : "border-line bg-card text-muted"}`}
          >
            {t === "travel" ? "Travel shortlist" : LOCAL_STATUS_LABELS[t]}
            {counts[t] ? <span className="ml-1 opacity-70">{counts[t]}</span> : null}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="col-span-2 block text-xs text-muted">
          Search title or place
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className={`mt-1 ${input}`} />
        </label>
        <label className="block text-xs text-muted">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | "")} className={`mt-1 ${input}`}>
            <option value="">All</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          When
          <select value={when} onChange={(e) => setWhen(e.target.value as typeof when)} className={`mt-1 ${input}`}>
            <option value="all">Any time</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
        </label>
        {tab === "travel" ? (
          <label className="block text-xs text-muted">
            Trip status
            <select value={travelStatus} onChange={(e) => setTravelStatus(e.target.value as TravelStatus | "")} className={`mt-1 ${input}`}>
              <option value="">All</option>
              {Object.entries(TRAVEL_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-xs text-muted">
            Max cost ({prefs.budgetCurrency})
            <input inputMode="numeric" value={maxCost} onChange={(e) => setMaxCost(e.target.value.replace(/[^0-9]/g, ""))} className={`mt-1 ${input}`} placeholder="Any" />
          </label>
        )}
      </div>

      {tab !== "travel" &&
        (localItems.length === 0 ? (
          <EmptyState title={`Nothing ${LOCAL_STATUS_LABELS[tab].toLowerCase()} yet`}>
            {tab === "attended" ? "Once you've been to something, mark it attended from its page." : <Link href="/discover" className="text-accent underline">Find something in Discover</Link>}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {localItems.map(({ s, e, cost }) => (
              <li key={s.eventId} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/events/${encodeURIComponent(e!.id)}`} className="font-serif text-lg hover:underline">
                    {e!.title}
                  </Link>
                  {e!.isDemo && <Badge tone="warn">Sample</Badge>}
                </div>
                <p className="text-sm text-muted">
                  {whenLabel(e!, tz)} · {placeLabel(e!)}
                </p>
                <p className="text-sm">
                  {s.actualCost ? "Actual: " : s.status === "planned" ? "Planned: " : "Estimate: "}
                  {costLabel(cost)}
                  {s.reflection?.enjoyed !== undefined && s.reflection?.enjoyed !== null && <span className="text-muted"> · {s.reflection.enjoyed ? "Enjoyed it" : "Not for me in the end"}</span>}
                  {s.reflection?.wouldRepeat && <span className="text-muted"> · would do again</span>}
                </p>
              </li>
            ))}
          </ul>
        ))}

      {tab === "travel" &&
        (tripItems.length === 0 ? (
          <EmptyState title="No trips on your shortlist">
            <Link href="/discover?view=travel" className="text-accent underline">Explore travel-worthy experiences</Link>
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {tripItems.map(({ t, e, total }) => (
              <li key={t.eventId} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/events/${encodeURIComponent(e!.id)}`} className="font-serif text-lg hover:underline">
                    {e!.title}
                  </Link>
                  <span className="flex gap-1">
                    <Badge tone="info">{TRAVEL_STATUS_LABELS[t.status]}</Badge>
                    {e!.isDemo && <Badge tone="warn">Sample</Badge>}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {whenLabel(e!, tz)} · {e!.venue.city}, {e!.venue.country}
                </p>
                <p className="text-sm">
                  {total.total !== null ? `Estimated total ${formatMoney(total.total, prefs.budgetCurrency)}` : `Known so far ${formatMoney(total.known, prefs.budgetCurrency)} · still to research: ${total.missing.filter((m) => !total.unconverted.includes(m)).join(", ") || "currency conversion"}`}
                </p>
              </li>
            ))}
          </ul>
        ))}

      {orphaned > 0 && <p className="text-xs text-muted">{orphaned} saved item{orphaned === 1 ? " refers to an event" : "s refer to events"} no longer in the current listings.</p>}
    </div>
  );
}
