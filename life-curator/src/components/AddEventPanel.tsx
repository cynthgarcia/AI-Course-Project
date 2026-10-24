"use client";

import { useState } from "react";
import { AREA_LABELS } from "@/lib/domain/areas";
import { DESTINATIONS, getDestination } from "@/lib/domain/destinations";
import { localDate, MINUTE, formatTime, zonedToEpoch } from "@/lib/domain/time";
import { CATEGORY_LABELS, type AreaId, type Category, type CuratorEvent, type Eligibility } from "@/lib/domain/types";
import { classify, inferTags } from "@/lib/sources/classify";
import { useStore } from "@/lib/store/AppStore";
import { btn } from "./ui";

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";

interface FormState {
  title: string;
  date: string;
  time: string;
  endTime: string;
  category: Category | "";
  venue: string;
  where: string; // "area:<id>" | "dest:<id>" | "other"
  otherCity: string;
  priceMode: "unknown" | "free" | "amount";
  amount: string;
  currency: string;
  officialUrl: string;
  bookingUrl: string;
  eligibility: Eligibility;
  accessNote: string;
  dressCode: string;
  description: string;
}

const EMPTY: FormState = {
  title: "",
  date: "",
  time: "19:00",
  endTime: "",
  category: "",
  venue: "",
  where: "area:soho",
  otherCity: "",
  priceMode: "unknown",
  amount: "",
  currency: "GBP",
  officialUrl: "",
  bookingUrl: "",
  eligibility: "public",
  accessNote: "",
  dressCode: "",
  description: "",
};

function fromDraft(e: CuratorEvent): FormState {
  const tz = e.timezone;
  const start = Date.parse(e.start);
  return {
    ...EMPTY,
    title: e.title,
    date: localDate(start, tz),
    time: formatTime(start, tz),
    endTime: e.end ? formatTime(Date.parse(e.end), tz) : "",
    category: e.category,
    venue: e.venue.name,
    where: e.venue.area ? `area:${e.venue.area}` : e.destinationId ? `dest:${e.destinationId}` : e.venue.city === "London" ? "area:outer_london" : "other",
    otherCity: e.venue.city === "Unknown" ? "" : e.venue.city,
    priceMode: e.price.status === "free" ? "free" : e.price.min !== null ? "amount" : "unknown",
    amount: e.price.min?.toString() ?? "",
    currency: e.price.currency,
    officialUrl: e.officialUrl ?? "",
    bookingUrl: e.bookingUrl ?? "",
    eligibility: e.eligibility === "unknown" ? "public" : e.eligibility,
    description: e.description,
  };
}

function validUrl(u: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
}

export function AddEventPanel({ onDone }: { onDone: (id: string) => void }) {
  const { mode, dispatch } = useStore();
  const [tab, setTab] = useState<"link" | "manual">(mode === "server" ? "link" : "manual");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(mode === "server" ? null : EMPTY);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));

  const doImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const body = (await res.json().catch(() => ({}))) as { draft?: CuratorEvent; importedFrom?: string; error?: string };
      if (!res.ok || !body.draft) {
        setMessage(body.error ?? "That page couldn't be read.");
        return;
      }
      setForm(fromDraft(body.draft));
      setImportedFrom(body.importedFrom ?? null);
      setMessage("Check the details below — nothing is saved until you add it.");
    } catch {
      setMessage("Couldn't reach the server. Try again, or add it by hand.");
    } finally {
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.title.trim()) return setError("Give the event a name.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) return setError("Add the date and start time.");
    if (form.officialUrl && !validUrl(form.officialUrl)) return setError("The event link needs to start with https://");
    if (form.bookingUrl && !validUrl(form.bookingUrl)) return setError("The booking link needs to start with https://");
    if (form.where === "other" && !form.otherCity.trim()) return setError("Which city is it in?");
    const amount = form.priceMode === "amount" ? Number(form.amount) : null;
    if (form.priceMode === "amount" && (!Number.isFinite(amount) || amount! < 0)) return setError("Enter the price as a number.");

    const [kind, ref] = form.where.split(":") as [string, string | undefined];
    const dest = kind === "dest" ? getDestination(ref ?? null) : null;
    const area = kind === "area" ? (ref as AreaId) : null;
    const tz = dest?.timezone ?? "Europe/London";
    const start = zonedToEpoch(form.date, form.time, tz);
    let end: number | null = form.endTime ? zonedToEpoch(form.date, form.endTime, tz) : null;
    if (end !== null && end <= start) end += 24 * 60 * MINUTE; // finishes after midnight
    const text = `${form.title} ${form.description}`;
    const at = new Date().toISOString();
    const event: CuratorEvent & { importedFrom: string | null } = {
      id: `user-${crypto.randomUUID()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category || classify(text),
      tags: inferTags(text),
      venue: {
        name: form.venue.trim() || "Venue not listed",
        address: null,
        neighborhood: area && area !== "outer_london" ? AREA_LABELS[area] : null,
        city: dest ? dest.city : kind === "area" ? "London" : form.otherCity.trim(),
        country: dest ? dest.country : kind === "area" ? "United Kingdom" : "Unknown",
        area,
      },
      start: new Date(start).toISOString(),
      end: end === null ? null : new Date(end).toISOString(),
      timezone: tz,
      price:
        form.priceMode === "free"
          ? { status: "free", min: null, max: null, currency: form.currency, includesFees: null }
          : amount !== null
            ? { status: "known", min: amount, max: amount, currency: form.currency, includesFees: null }
            : { status: "unknown", min: null, max: null, currency: form.currency, includesFees: null },
      officialUrl: form.officialUrl.trim() || null,
      bookingUrl: form.bookingUrl.trim() || null,
      organizer: null,
      eligibility: form.eligibility,
      dressCode: form.dressCode.trim() || null,
      accessibility: null,
      verification: { status: "unverified", lastVerifiedAt: at, sourceName: importedFrom ? `Imported from ${importedFrom}` : "Added by you" },
      isDemo: false,
      socialFit: null,
      bookingDeadline: null,
      advancePlanning: false,
      destinationId: dest?.id ?? null,
      occurrenceGroupId: null,
      sourceRecords: [{ sourceId: "user", externalId: null, url: form.officialUrl.trim() || null, lastSeenAt: at }],
      accessNote: form.eligibility === "public" ? null : form.accessNote.trim() || null,
      addedByUser: true,
      importedFrom,
    };
    dispatch({ type: "addCustomEvent", event });
    onDone(event.id);
  };

  return (
    <section aria-labelledby="add-event" className="space-y-4 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="add-event" className="font-serif text-xl">
          Add an event
        </h2>
        <div role="tablist" aria-label="How to add" className="inline-flex rounded-full border border-line p-1 text-sm">
          {mode === "server" && (
            <button role="tab" aria-selected={tab === "link"} onClick={() => setTab("link")} className={`rounded-full px-3 py-1 ${tab === "link" ? "bg-ink text-paper" : "text-muted"}`}>
              From a link
            </button>
          )}
          <button
            role="tab"
            aria-selected={tab === "manual"}
            onClick={() => {
              setTab("manual");
              setForm((f) => f ?? EMPTY);
            }}
            className={`rounded-full px-3 py-1 ${tab === "manual" ? "bg-ink text-paper" : "text-muted"}`}
          >
            By hand
          </button>
        </div>
      </div>

      {tab === "link" && (
        <form onSubmit={doImport} className="space-y-2">
          <label className="block text-sm">
            Event page link
            <input id="import-url" type="url" inputMode="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={input} />
          </label>
          <p className="text-xs text-muted">
            Works with many venue, ticketing and event sites that publish event details for search engines. Instagram posts can&rsquo;t be read by apps — add those by hand.
          </p>
          <button type="submit" className={btn.primary} disabled={busy || !url}>
            {busy ? "Reading the page…" : "Read event details"}
          </button>
        </form>
      )}
      {message && <p role="status" className="text-sm text-muted">{message}</p>}

      {form && (tab === "manual" || importedFrom) && (
        <form onSubmit={save} className="space-y-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted sm:col-span-2">
              Event name
              <input id="ev-title" className={input} value={form.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label className="block text-xs text-muted">
              Date
              <input id="ev-date" type="date" className={input} value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-muted">
                Starts
                <input id="ev-time" type="time" className={input} value={form.time} onChange={(e) => set({ time: e.target.value })} />
              </label>
              <label className="block text-xs text-muted">
                Ends (optional)
                <input id="ev-end" type="time" className={input} value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
              </label>
            </div>
            <label className="block text-xs text-muted">
              Venue
              <input id="ev-venue" className={input} value={form.venue} maxLength={200} onChange={(e) => set({ venue: e.target.value })} />
            </label>
            <label className="block text-xs text-muted">
              Where
              <select id="ev-where" className={input} value={form.where} onChange={(e) => set({ where: e.target.value })}>
                <optgroup label="London">
                  {Object.entries(AREA_LABELS).map(([k, v]) => (
                    <option key={k} value={`area:${k}`}>
                      {v}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Europe">
                  {DESTINATIONS.map((d) => (
                    <option key={d.id} value={`dest:${d.id}`}>
                      {d.city}, {d.country}
                    </option>
                  ))}
                </optgroup>
                <option value="other">Somewhere else…</option>
              </select>
            </label>
            {form.where === "other" && (
              <label className="block text-xs text-muted">
                City
                <input id="ev-city" className={input} value={form.otherCity} maxLength={120} onChange={(e) => set({ otherCity: e.target.value })} />
              </label>
            )}
            <label className="block text-xs text-muted">
              Type
              <select id="ev-category" className={input} value={form.category} onChange={(e) => set({ category: e.target.value as Category | "" })}>
                <option value="">Work it out from the name</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-[1fr_1fr_5.5rem] gap-2 sm:col-span-2">
              <label className="block text-xs text-muted">
                Price
                <select id="ev-price-mode" className={input} value={form.priceMode} onChange={(e) => set({ priceMode: e.target.value as FormState["priceMode"] })}>
                  <option value="unknown">Not known</option>
                  <option value="free">Free</option>
                  <option value="amount">Amount</option>
                </select>
              </label>
              <label className="block text-xs text-muted">
                Amount
                <input id="ev-amount" inputMode="decimal" disabled={form.priceMode !== "amount"} className={`${input} disabled:opacity-50`} value={form.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^0-9.]/g, "") })} />
              </label>
              <label className="block text-xs text-muted">
                Currency
                <select id="ev-currency" className={input} value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
                  {["GBP", "EUR", "USD", "CHF", "DKK", "CZK"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs text-muted">
              Event link (optional)
              <input id="ev-url" type="url" className={input} value={form.officialUrl} onChange={(e) => set({ officialUrl: e.target.value })} placeholder="https://" />
            </label>
            <label className="block text-xs text-muted">
              Tickets link (optional)
              <input id="ev-booking" type="url" className={input} value={form.bookingUrl} onChange={(e) => set({ bookingUrl: e.target.value })} placeholder="https://" />
            </label>
            <label className="block text-xs text-muted">
              Who can go
              <select id="ev-eligibility" className={input} value={form.eligibility} onChange={(e) => set({ eligibility: e.target.value as Eligibility })}>
                <option value="public">Open to the public</option>
                <option value="members">Members only</option>
                <option value="invite_only">Invitation only</option>
                <option value="unknown">Not sure</option>
              </select>
            </label>
            <label className="block text-xs text-muted">
              Dress code (optional)
              <input id="ev-dress" className={input} value={form.dressCode} maxLength={120} onChange={(e) => set({ dressCode: e.target.value })} />
            </label>
            {form.eligibility !== "public" && (
              <label className="block text-xs text-muted sm:col-span-2">
                How could you get in? (optional)
                <input
                  id="ev-access"
                  className={input}
                  value={form.accessNote}
                  maxLength={400}
                  onChange={(e) => set({ accessNote: e.target.value })}
                  placeholder="e.g. join the young patrons committee, buy a table with friends, ask a member"
                />
              </label>
            )}
            <label className="block text-xs text-muted sm:col-span-2">
              Notes (optional)
              <textarea id="ev-notes" rows={2} className={input} value={form.description} maxLength={4000} onChange={(e) => set({ description: e.target.value })} />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
          )}
          <button type="submit" className={btn.primary}>
            Add event
          </button>
        </form>
      )}
    </section>
  );
}
