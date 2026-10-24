// Maps the app state to database rows. Every query is scoped to one user_id.
import { DEFAULT_PREFERENCES, NEW_ACCOUNT_PREFERENCES } from "@/lib/data/defaults";
import type { UserHobby } from "@/lib/domain/hobbies";
import type { CuratorEvent, Experience, SavedEvent, SavedTrip } from "@/lib/domain/types";
import { INITIAL_STATE, STATE_VERSION, type AppState } from "@/lib/store/state";
import type { Queryable } from "./db";

interface ProfileRow {
  onboarded: boolean;
  calendar_mode: AppState["calendarMode"];
  prefs: AppState["prefs"];
  feedback: AppState["feedback"];
  plans: AppState["plans"];
  runs: AppState["runs"];
}

interface ExperienceRow {
  id: string;
  event_id: string | null;
  title: string;
  category: Experience["category"];
  tags: string[];
  venue_name: string | null;
  neighborhood: string | null;
  city: string | null;
  date: string;
  rating: number | null;
  cost: Experience["cost"];
  with_whom: Experience["withWhom"];
  was_new: boolean | null;
  notes: string;
  source: Experience["source"];
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export async function createProfile(q: Queryable, userId: string): Promise<void> {
  await q.query("insert into profiles (user_id, prefs) values ($1, $2::text::jsonb)", [userId, JSON.stringify(NEW_ACCOUNT_PREFERENCES)]);
}

/** Loads a user's state; `lock` serialises concurrent writes for the same user. */
export async function loadState(q: Queryable, userId: string, lock = false): Promise<AppState> {
  const [p] = await q.query<ProfileRow>(
    `select onboarded, calendar_mode, prefs, feedback, plans, runs from profiles where user_id = $1${lock ? " for update" : ""}`,
    [userId],
  );
  if (!p) throw new Error("Profile missing");
  const saved = await q.query<{ event_id: string; data: SavedEvent }>("select event_id, data from saved_events where user_id = $1", [userId]);
  const trips = await q.query<{ event_id: string; data: SavedTrip }>("select event_id, data from saved_trips where user_id = $1", [userId]);
  const exps = await q.query<ExperienceRow>(
    `select id, event_id, title, category, tags, venue_name, neighborhood, city, date::text as date, rating, cost,
            with_whom, was_new, notes, source, created_at, updated_at
       from experiences where user_id = $1 order by date desc`,
    [userId],
  );
  const customEvents = await q.query<{ id: string; data: CuratorEvent }>("select id, data from user_events where user_id = $1", [userId]);
  const hobbies = await q.query<{ id: string; data: UserHobby }>("select id, data from user_hobbies where user_id = $1", [userId]);
  return {
    ...INITIAL_STATE,
    version: STATE_VERSION,
    customEvents: Object.fromEntries(customEvents.map((r) => [r.id, r.data])),
    hobbies: Object.fromEntries(hobbies.map((r) => [r.id, r.data])),
    onboarded: p.onboarded,
    calendarMode: p.calendar_mode,
    prefs: { ...DEFAULT_PREFERENCES, ...p.prefs, interests: { ...DEFAULT_PREFERENCES.interests, ...(p.prefs.interests ?? {}) } },
    feedback: p.feedback,
    plans: p.plans,
    runs: p.runs,
    saved: Object.fromEntries(saved.map((r) => [r.event_id, r.data])),
    trips: Object.fromEntries(trips.map((r) => [r.event_id, r.data])),
    experiences: Object.fromEntries(
      exps.map((r) => [
        r.id,
        {
          id: r.id,
          eventId: r.event_id,
          title: r.title,
          category: r.category,
          tags: r.tags,
          venueName: r.venue_name,
          neighborhood: r.neighborhood,
          city: r.city,
          date: r.date,
          rating: r.rating,
          cost: r.cost,
          withWhom: r.with_whom,
          wasNew: r.was_new,
          notes: r.notes,
          source: r.source,
          createdAt: iso(r.created_at),
          updatedAt: iso(r.updated_at),
        } satisfies Experience,
      ]),
    ),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Writes only what changed between two states. */
export async function persistDiff(q: Queryable, userId: string, before: AppState, after: AppState): Promise<void> {
  if (
    before.onboarded !== after.onboarded ||
    before.calendarMode !== after.calendarMode ||
    !same(before.prefs, after.prefs) ||
    !same(before.feedback, after.feedback) ||
    !same(before.plans, after.plans) ||
    !same(before.runs, after.runs)
  ) {
    await q.query(
      `update profiles set onboarded = $2, calendar_mode = $3, prefs = $4::text::jsonb, feedback = $5::text::jsonb, plans = $6::text::jsonb,
              runs = $7::text::jsonb, updated_at = now() where user_id = $1`,
      [
        userId,
        after.onboarded,
        after.calendarMode,
        JSON.stringify(after.prefs),
        JSON.stringify(after.feedback.slice(-500)),
        JSON.stringify(after.plans),
        JSON.stringify(after.runs),
      ],
    );
  }

  for (const [table, b, a] of [
    ["saved_events", before.saved, after.saved],
    ["saved_trips", before.trips, after.trips],
  ] as const) {
    for (const [eventId, row] of Object.entries(a)) {
      if (same(b[eventId], row)) continue;
      await q.query(
        `insert into ${table} (user_id, event_id, status, data, updated_at) values ($1, $2, $3, $4::text::jsonb, now())
         on conflict (user_id, event_id) do update set status = excluded.status, data = excluded.data, updated_at = now()`,
        [userId, eventId, row.status, JSON.stringify(row)],
      );
    }
    for (const eventId of Object.keys(b)) {
      if (!(eventId in a)) await q.query(`delete from ${table} where user_id = $1 and event_id = $2`, [userId, eventId]);
    }
  }

  for (const [table, b, a] of [
    ["user_events", before.customEvents, after.customEvents],
    ["user_hobbies", before.hobbies, after.hobbies],
  ] as const) {
    for (const [id, row] of Object.entries(a)) {
      if (same(b[id], row)) continue;
      await q.query(
        `insert into ${table} (user_id, id, data, updated_at) values ($1, $2, $3::text::jsonb, now())
         on conflict (user_id, id) do update set data = excluded.data, updated_at = now()`,
        [userId, id, JSON.stringify(row)],
      );
    }
    for (const id of Object.keys(b)) {
      if (!(id in a)) await q.query(`delete from ${table} where user_id = $1 and id = $2`, [userId, id]);
    }
  }

  for (const [id, x] of Object.entries(after.experiences)) {
    if (same(before.experiences[id], x)) continue;
    await q.query(
      `insert into experiences (user_id, id, event_id, title, category, tags, venue_name, neighborhood, city, date, rating, cost,
                                with_whom, was_new, notes, source, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6::text::jsonb, $7, $8, $9, $10::date, $11, $12::text::jsonb, $13, $14, $15, $16, $17, $18)
       on conflict (user_id, id) do update set
         event_id = excluded.event_id, title = excluded.title, category = excluded.category, tags = excluded.tags,
         venue_name = excluded.venue_name, neighborhood = excluded.neighborhood, city = excluded.city, date = excluded.date,
         rating = excluded.rating, cost = excluded.cost, with_whom = excluded.with_whom, was_new = excluded.was_new,
         notes = excluded.notes, updated_at = excluded.updated_at`,
      [
        userId,
        x.id,
        x.eventId,
        x.title,
        x.category,
        JSON.stringify(x.tags),
        x.venueName,
        x.neighborhood,
        x.city,
        x.date,
        x.rating,
        x.cost === null ? null : JSON.stringify(x.cost),
        x.withWhom,
        x.wasNew,
        x.notes,
        x.source,
        x.createdAt,
        x.updatedAt,
      ],
    );
  }
  for (const id of Object.keys(before.experiences)) {
    if (!(id in after.experiences)) await q.query("delete from experiences where user_id = $1 and id = $2", [userId, id]);
  }
}
