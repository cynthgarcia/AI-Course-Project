"use client";

import { useState } from "react";
import { localDate } from "@/lib/domain/time";
import { CATEGORY_LABELS, type Category, type Experience, type WithWhom } from "@/lib/domain/types";
import { newId } from "@/lib/ui/experience";
import { StarRating } from "./StarRating";
import { btn } from "./ui";

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink";

/** Add or edit something the user went to — including things from years ago. */
export function ExperienceForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Experience;
  onSave: (x: Experience) => void;
  onCancel: () => void;
}) {
  const today = localDate(Date.now(), "Europe/London");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? today);
  const [category, setCategory] = useState<Category>(initial?.category ?? "music");
  const [venueName, setVenue] = useState(initial?.venueName ?? "");
  const [place, setPlace] = useState(initial ? (initial.city && initial.city !== "London" ? initial.city : initial.neighborhood ?? "") : "");
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [withWhom, setWithWhom] = useState<WithWhom | "">(initial?.withWhom ?? "");
  const [cost, setCost] = useState(initial?.cost?.amount?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.cost?.currency ?? "GBP");
  const [wasNew, setWasNew] = useState(initial?.wasNew ?? false);
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Give it a name.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Choose a date.");
    if (date > today) return setError("Wrapped is for things you've already done — pick a date up to today.");
    const at = new Date().toISOString();
    const amount = cost.trim() === "" ? null : Number(cost);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return setError("Enter the cost as a number, or leave it blank.");
    // A short place name is treated as a London neighbourhood unless it's a known non-London city.
    const isCity = initial?.city && initial.city !== "London" ? true : /,|paris|berlin|lisbon|madrid|barcelona|rome|milan|vienna|prague|amsterdam|brussels|antwerp|copenhagen|munich|porto|new york|edinburgh|manchester/i.test(place);
    onSave({
      id: initial?.id ?? newId(),
      eventId: initial?.eventId ?? null,
      title: title.trim(),
      category,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
      venueName: venueName.trim() || null,
      neighborhood: place.trim() && !isCity ? place.trim() : null,
      city: place.trim() ? (isCity ? place.trim() : "London") : initial?.city ?? null,
      date,
      rating,
      cost: amount === null ? null : { amount, currency, basis: "verified" },
      withWhom: withWhom || null,
      wasNew,
      notes,
      source: initial?.source === "app" ? "app" : initial?.source ?? "manual",
      createdAt: initial?.createdAt ?? at,
      updatedAt: at,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-card p-4" noValidate>
      <p className="font-serif text-lg">{initial ? "Edit experience" : "Add something you went to"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted sm:col-span-2">
          What was it?
          <input id="exp-title" className={input} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nina Simone tribute at a jazz club" />
        </label>
        <label className="block text-xs text-muted">
          Date
          <input id="exp-date" type="date" className={input} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          Type
          <select id="exp-category" className={input} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Venue (optional)
          <input id="exp-venue" className={input} value={venueName} maxLength={200} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <label className="block text-xs text-muted">
          Neighbourhood or city (optional)
          <input id="exp-place" className={input} value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} placeholder="Soho, or Paris" />
        </label>
        <label className="block text-xs text-muted">
          Who with
          <select id="exp-with" className={input} value={withWhom} onChange={(e) => setWithWhom(e.target.value as WithWhom | "")}>
            <option value="">Not recorded</option>
            <option value="solo">Solo</option>
            <option value="friends">With friends</option>
            <option value="new_people">Met new people</option>
          </select>
        </label>
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <label className="block text-xs text-muted">
            What it cost (optional)
            <input id="exp-cost" inputMode="decimal" className={input} value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))} />
          </label>
          <label className="block text-xs text-muted">
            Currency
            <select id="exp-currency" className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["GBP", "EUR", "USD", "CHF", "DKK", "CZK"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs text-muted sm:col-span-2">
          Tags (optional, comma separated — they help recommendations learn)
          <input id="exp-tags" className={input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="jazz, live music" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <StarRating value={rating} onChange={setRating} label="Rating out of 5" />
        <label className="flex items-center gap-2 text-sm">
          <input id="exp-new" type="checkbox" checked={wasNew} onChange={(e) => setWasNew(e.target.checked)} className="size-4 accent-[var(--accent)]" />
          It was new for me
        </label>
      </div>
      <label className="block text-xs text-muted">
        Notes (optional)
        <textarea id="exp-notes" className={input} rows={2} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className={btn.primary}>
          {initial ? "Save changes" : "Add to my history"}
        </button>
        <button type="button" className={btn.quiet} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
