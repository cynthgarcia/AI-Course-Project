-- Your Life Curator — initial schema (Phase 2). NOT YET APPLIED: no Supabase project is configured.
-- User-owned tables use row-level security keyed on auth.uid(). Shared event data is
-- readable by authenticated users and writable only by the service role (ingestion jobs).

create extension if not exists "pgcrypto";

-- Profiles & preferences --------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'Europe/London',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  home_neighborhood text not null default 'Parsons Green / Fulham',
  home_area text not null default 'fulham',
  office_neighborhood text not null default 'Windmill Street, Soho',
  office_area text not null default 'soho',
  office_days text[] not null default array['tue', 'wed', 'thu'],
  monthly_activity_budget numeric(10, 2) not null default 1500 check (monthly_activity_budget >= 0),
  budget_currency char(3) not null default 'GBP',
  fx_rates jsonb not null default '{}'::jsonb, -- user-entered only
  count_travel_in_budget boolean not null default true,
  planning_horizon_days int not null default 14 check (planning_horizon_days between 1 and 90),
  advance_event_horizon_days int not null default 42 check (advance_event_horizon_days between 1 and 365),
  interests jsonb not null default '{}'::jsonb,
  interest_keywords text[] not null default '{}',
  exploration_level smallint not null default 2 check (exploration_level between 0 and 3),
  diversity_level smallint not null default 2 check (diversity_level between 0 and 3),
  travel_enabled boolean not null default true,
  preferred_max_trip_hours numeric(4, 1) not null default 6,
  scheduling jsonb not null default '{}'::jsonb, -- buffers, notice, latest-home times
  digest_enabled boolean not null default true,
  digest_day text not null default 'thu',
  digest_time time not null default '15:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Calendar ----------------------------------------------------------------------
-- Tokens are never stored here in plaintext: credential_ref points at a server-side secret
-- (e.g. Supabase Vault). Clients have no select access to this table at all.
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('google')),
  credential_ref text not null,
  connection_status text not null default 'connected' check (connection_status in ('connected', 'revoked', 'error')),
  granted_scopes text[] not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.protected_time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('open_to_suggestions', 'keep_open_for_friends', 'personal_time')),
  subtype text,
  weekday text check (weekday in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  start_time time,
  end_time time,
  starts_at timestamptz, -- one-off blocks
  ends_at timestamptz,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((weekday is not null and start_time is not null and end_time is not null) or (starts_at is not null and ends_at > starts_at))
);
create index on public.protected_time_blocks (user_id);

-- Events (shared) -----------------------------------------------------------------
create table public.event_sources (
  id text primary key,
  provider_name text not null,
  source_type text not null check (source_type in ('api', 'ics', 'rss', 'venue_calendar', 'demo')),
  base_url text,
  config jsonb not null default '{}'::jsonb, -- non-secret settings only
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error_summary text
);

create table public.destinations (
  id text primary key,
  city text not null,
  country text not null,
  timezone text not null
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null,
  tags text[] not null default '{}',
  venue_name text not null,
  address text,
  neighborhood text,
  area text,
  city text not null,
  country text not null,
  destination_id text references public.destinations (id),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null,
  price_status text not null check (price_status in ('known', 'free', 'range', 'unknown')),
  price_min numeric(10, 2),
  price_max numeric(10, 2),
  currency char(3) not null default 'GBP',
  price_includes_fees boolean, -- null = not confirmed
  booking_url text check (booking_url is null or booking_url ~* '^https?://'),
  official_url text check (official_url is null or official_url ~* '^https?://'),
  organizer text,
  eligibility text not null default 'unknown' check (eligibility in ('public', 'members', 'invite_only', 'unknown')),
  dress_code text,
  accessibility text,
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'unverified', 'stale', 'demo')),
  last_verified_at timestamptz,
  is_demo boolean not null default false,
  social_fit text,
  booking_deadline timestamptz,
  advance_planning boolean not null default false,
  occurrence_group_id uuid, -- links performances of the same production
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (price_status not in ('known', 'range') or price_min is not null)
);
create index on public.events (starts_at);
create index on public.events (city, starts_at);
create index on public.events (occurrence_group_id);

create table public.event_source_records (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  source_id text not null references public.event_sources (id),
  external_event_id text,
  source_url text,
  last_seen_at timestamptz not null default now(),
  unique (source_id, external_event_id)
);

-- User activity ---------------------------------------------------------------------
create table public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null check (status in ('interested', 'saved', 'invited', 'planned', 'attended', 'skipped', 'not_for_me')),
  planned_cost numeric(10, 2),
  actual_cost numeric(10, 2),
  currency char(3) not null default 'GBP',
  cost_basis text,
  budget_override boolean not null default false,
  notes text not null default '',
  dismissal_reason text,
  attended_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table public.saved_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null check (status in ('interested', 'researching', 'worth_considering', 'planned', 'attended', 'not_for_me')),
  costs jsonb not null, -- {ticket, transport, accommodation, other}: {amount|null, currency, basis}
  actual_costs jsonb,
  notes text not null default '',
  budget_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table public.attended_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  attended_at timestamptz not null,
  rating smallint check (rating between 1 and 5),
  enjoyed boolean,
  would_repeat boolean,
  was_new boolean,
  would_recommend boolean,
  actual_cost numeric(10, 2),
  reflection text,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  generation_status text not null check (generation_status in ('pending', 'generated', 'failed')),
  error_summary text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start) -- one plan per week: idempotent regeneration
);

create table public.plan_recommendations (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('local', 'travel')),
  suggested_start timestamptz,
  suggested_end timestamptz,
  calendar_fit_reason text,
  recommendation_reason text,
  ranking_score numeric(6, 2),
  estimated_cost numeric(10, 2),
  created_at timestamptz not null default now(),
  unique (weekly_plan_id, event_id)
);

create table public.plan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  trigger text not null check (trigger in ('manual', 'scheduled')),
  outcome text not null check (outcome in ('generated', 'failed')),
  item_count int not null default 0,
  error_summary text,
  ran_at timestamptz not null default now()
);

create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  category text not null,
  feedback_type text not null,
  feedback_value text,
  created_at timestamptz not null default now()
);
create index on public.user_feedback (user_id, created_at desc);

-- Row-level security ------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.protected_time_blocks enable row level security;
alter table public.event_sources enable row level security;
alter table public.destinations enable row level security;
alter table public.events enable row level security;
alter table public.event_source_records enable row level security;
alter table public.saved_events enable row level security;
alter table public.saved_trips enable row level security;
alter table public.attended_experiences enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.plan_recommendations enable row level security;
alter table public.plan_runs enable row level security;
alter table public.user_feedback enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['user_preferences', 'protected_time_blocks', 'saved_events', 'saved_trips',
                           'attended_experiences', 'weekly_plans', 'plan_runs', 'user_feedback']
  loop
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- calendar_connections: no client policies at all — server (service role) access only.

create policy "own plan items" on public.plan_recommendations for select
  using (exists (select 1 from public.weekly_plans p where p.id = weekly_plan_id and p.user_id = auth.uid()));

create policy "read events" on public.events for select to authenticated using (true);
create policy "read destinations" on public.destinations for select to authenticated using (true);
create policy "read source records" on public.event_source_records for select to authenticated using (true);
-- event_sources: service role only (may hold non-public config).
