"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BudgetCard } from "@/components/BudgetCard";
import { EventCard } from "@/components/EventCard";
import { WeekStrip } from "@/components/WeekStrip";
import { Badge, EmptyState, Notice, SectionHeading, btn } from "@/components/ui";
import { selectShortlist, weeklyCapacity } from "@/lib/domain/ranking";
import { DAY, formatShortDay, formatTime, localDate, startOfWeek } from "@/lib/domain/time";
import { LOCAL_STATUS_LABELS } from "@/lib/domain/types";
import { countFreeEvenings, generateWeeklyPlan } from "@/lib/domain/weeklyPlan";
import { useStore } from "@/lib/store/AppStore";
import { whenLabel } from "@/lib/ui/format";

export default function ThisWeekPage() {
  const { state, dispatch, derived } = useStore();
  const [message, setMessage] = useState<string | null>(null);
  const { prefs } = state;
  const tz = prefs.timezone;

  const view = useMemo(() => {
    if (!derived) return null;
    const horizonEnd = derived.now + prefs.planningHorizonDays * DAY;
    const free = countFreeEvenings(derived.rankContext);
    const capacity = free === null ? 4 : weeklyCapacity(free);
    const local = derived.recommend.filter((r) => r.isLondon && Date.parse(r.event.start) <= horizonEnd);
    const shortlist = selectShortlist(local, prefs, capacity);
    const travel = derived.recommend.filter((r) => !r.isLondon && r.exclusions.length === 0 && r.trip?.weekendCompatible).slice(0, 2);
    const deadlines = derived.recommend
      .filter((r) => r.event.bookingDeadline && r.exclusions.length === 0)
      .filter((r) => {
        const d = Date.parse(r.event.bookingDeadline!);
        return d > derived.now && d - derived.now < 21 * DAY;
      })
      .sort((a, b) => Date.parse(a.event.bookingDeadline!) - Date.parse(b.event.bookingDeadline!));
    const upcoming = Object.values(state.saved)
      .filter((s) => ["saved", "interested", "invited", "planned"].includes(s.status))
      .map((s) => ({ s, e: derived.eventMap.get(s.eventId) }))
      .filter((x): x is { s: (typeof x)["s"]; e: NonNullable<(typeof x)["e"]> } => !!x.e && Date.parse(x.e.start) > derived.now)
      .sort((a, b) => Date.parse(a.e.start) - Date.parse(b.e.start));
    const weekStart = startOfWeek(localDate(derived.now, tz));
    const plan = state.plans.find((p) => p.weekStart === weekStart) ?? null;
    const plannedThisWeek = upcoming.filter((u) => u.s.status === "planned" && Date.parse(u.e.start) < derived.now + 7 * DAY).length;
    return { shortlist, travel, deadlines, upcoming, plan, free, plannedThisWeek };
  }, [derived, prefs, state.saved, state.plans, tz]);

  if (!derived || !view) return null;

  const generate = () => {
    const at = new Date().toISOString();
    try {
      const plan = generateWeeklyPlan(derived.events, derived.rankContext);
      dispatch({ type: "addPlan", plan, run: { at, weekStart: plan.weekStart, trigger: "manual", outcome: "generated", itemCount: plan.items.length, error: null } });
      setMessage(`Plan generated with ${plan.items.length} suggestion${plan.items.length === 1 ? "" : "s"}. It's saved here only — nothing was sent.`);
    } catch {
      dispatch({ type: "recordFailedRun", run: { at, weekStart: startOfWeek(localDate(derived.now, tz)), trigger: "manual", outcome: "failed", itemCount: 0, error: "Plan generation failed." } });
      setMessage("Plan generation failed. Your previous plan is unchanged — you can safely try again.");
    }
  };

  const planItems = view.plan?.items
    .map((i) => ({ item: i, rec: derived.recommend.find((r) => r.event.id === i.eventId) ?? derived.browse.find((r) => r.event.id === i.eventId) }))
    .filter((x) => x.rec);

  return (
    <div className="space-y-10">
      <section aria-labelledby="hello" className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{formatShortDay(derived.now, tz)}</p>
          <h1 id="hello" className="mt-1 font-serif text-3xl leading-tight sm:text-4xl">
            What&rsquo;s worth doing soon
          </h1>
          <p className="mt-2 max-w-prose text-muted">
            {view.free !== null && view.free <= 1
              ? "Your week looks full, so I'm keeping this light."
              : "A few well-chosen things that fit your time — and plenty of room left for rest and spontaneity."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <WeekStrip />
            {prefs.weeklyFunIntention && (
              <p className="text-sm text-muted">
                {view.plannedThisWeek > 0
                  ? "You have something fun planned this week. Enjoy it."
                  : "Gentle intention: one fun thing this week, if it suits you. No pressure."}
              </p>
            )}
          </div>
          <BudgetCard />
        </div>
      </section>

      <section aria-labelledby="shortlist">
        <SectionHeading
          id="shortlist"
          kicker={view.plan ? `Weekly plan · generated ${formatShortDay(Date.parse(view.plan.generatedAt), tz)} ${formatTime(Date.parse(view.plan.generatedAt), tz)}` : "Next 14 days"}
          aside={
            <button type="button" onClick={generate} className={btn.secondary}>
              {view.plan ? "Regenerate plan" : "Generate my weekly plan"}
            </button>
          }
        >
          {view.plan ? "Your plan for this week" : "Best upcoming"}
        </SectionHeading>
        {message && (
          <div className="mb-3" role="status">
            <Notice>{message}</Notice>
          </div>
        )}
        {view.plan?.note && <p className="mb-3 text-sm text-muted">{view.plan.note}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {view.plan
            ? planItems?.map(({ item, rec }) => <EventCard key={item.eventId} rec={rec!} showExclusions />)
            : view.shortlist.map((r) => <EventCard key={r.event.id} rec={r} />)}
        </div>
        {(view.plan ? planItems?.length === 0 : view.shortlist.length === 0) && (
          <EmptyState title="Nothing strong fits right now">
            That&rsquo;s fine — an empty evening is not a problem to solve. <Link className="text-accent underline" href="/discover">Browse Discover</Link> if you&rsquo;d like to look more widely.
          </EmptyState>
        )}
        <p className="mt-3 text-xs text-muted">
          Automatic Thursday digests aren&rsquo;t set up yet — use the button whenever you want a fresh plan.
        </p>
      </section>

      {view.travel.length > 0 && prefs.travelEnabled && (
        <section aria-labelledby="travel">
          <SectionHeading id="travel" kicker="Worth a weekend away?" aside={<Link href="/discover?view=travel" className="text-sm text-accent">All travel ideas →</Link>}>
            Travel-worthy
          </SectionHeading>
          <div className="grid gap-4 md:grid-cols-2">
            {view.travel.map((r) => (
              <EventCard key={r.event.id} rec={r} />
            ))}
          </div>
        </section>
      )}

      {view.deadlines.length > 0 && (
        <section aria-labelledby="deadlines">
          <SectionHeading id="deadlines" kicker="Book or decide by">
            Upcoming deadlines
          </SectionHeading>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {view.deadlines.map((r) => (
              <li key={r.event.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/events/${encodeURIComponent(r.event.id)}`} className="font-medium hover:underline">
                  {r.event.title}
                </Link>
                <span className="text-muted">
                  by {formatShortDay(Date.parse(r.event.bookingDeadline!), tz)} {r.event.isDemo && <Badge tone="warn">Sample</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="saved">
        <SectionHeading id="saved" kicker="Your list" aside={<Link href="/my-life" className="text-sm text-accent">My Life →</Link>}>
          Saved &amp; planned
        </SectionHeading>
        {view.upcoming.length === 0 ? (
          <EmptyState title="Nothing saved yet">Save anything that catches your eye; it&rsquo;ll appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {view.upcoming.slice(0, 8).map(({ s, e }) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/events/${encodeURIComponent(e.id)}`} className="font-medium hover:underline">
                  {e.title}
                </Link>
                <span className="text-muted">
                  {whenLabel(e, tz)} · {LOCAL_STATUS_LABELS[s.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
