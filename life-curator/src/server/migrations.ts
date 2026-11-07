// Schema migrations, applied in order on startup. Never edit a shipped migration — add a new one.
// Authorization is enforced in server code: every user-data query filters by the
// session's user_id, and composite primary keys include user_id.
export const MIGRATIONS: { id: string; statements: string[] }[] = [
  {
    id: "0001_core",
    statements: [
      `create table users (
        id uuid primary key default gen_random_uuid(),
        email text not null unique,
        password_hash text not null,
        created_at timestamptz not null default now()
      )`,
      `create table sessions (
        token_hash text primary key,
        user_id uuid not null references users (id) on delete cascade,
        expires_at timestamptz not null,
        created_at timestamptz not null default now()
      )`,
      `create index sessions_user_idx on sessions (user_id)`,
      `create table profiles (
        user_id uuid primary key references users (id) on delete cascade,
        onboarded boolean not null default false,
        calendar_mode text not null default 'demo' check (calendar_mode in ('demo', 'snapshot', 'disconnected')),
        prefs jsonb not null,
        feedback jsonb not null default '[]'::jsonb,
        plans jsonb not null default '[]'::jsonb,
        runs jsonb not null default '[]'::jsonb,
        updated_at timestamptz not null default now()
      )`,
      `create table saved_events (
        user_id uuid not null references users (id) on delete cascade,
        event_id text not null,
        status text not null,
        data jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (user_id, event_id)
      )`,
      `create table saved_trips (
        user_id uuid not null references users (id) on delete cascade,
        event_id text not null,
        status text not null,
        data jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (user_id, event_id)
      )`,
      `create table experiences (
        user_id uuid not null references users (id) on delete cascade,
        id uuid not null,
        event_id text,
        title text not null,
        category text not null,
        tags jsonb not null default '[]'::jsonb,
        venue_name text,
        neighborhood text,
        city text,
        date date not null,
        rating smallint check (rating between 1 and 5),
        cost jsonb,
        with_whom text check (with_whom in ('solo', 'friends', 'new_people')),
        was_new boolean,
        notes text not null default '',
        source text not null check (source in ('app', 'manual')),
        created_at timestamptz not null,
        updated_at timestamptz not null,
        primary key (user_id, id)
      )`,
      `create index experiences_user_date_idx on experiences (user_id, date)`,
    ],
  },
  {
    id: "0002_custom_events_hobbies",
    statements: [
      `create table user_events (
        user_id uuid not null references users (id) on delete cascade,
        id text not null,
        data jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (user_id, id)
      )`,
      `create table user_hobbies (
        user_id uuid not null references users (id) on delete cascade,
        id uuid not null,
        data jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (user_id, id)
      )`,
    ],
  },
  {
    id: "0003_shared_state",
    statements: [
      // Per-source event results, shared by all server instances.
      `create table event_cache (
        source_id text primary key,
        events jsonb not null default '[]'::jsonb,
        fetched_at timestamptz,
        last_attempt_at timestamptz,
        last_error text
      )`,
      // Rate limiting that works across serverless instances.
      `create table rate_limits (
        key text primary key,
        count integer not null,
        reset_at timestamptz not null
      )`,
      `create index sessions_expires_idx on sessions (expires_at)`,
    ],
  },
  {
    id: "0004_calendar_alerts",
    statements: [
      `alter table profiles drop constraint if exists profiles_calendar_mode_check`,
      `alter table profiles add constraint profiles_calendar_mode_check check (calendar_mode in ('demo', 'snapshot', 'disconnected', 'google'))`,
      // Google Calendar (free/busy only). The refresh token is encrypted at rest and never sent to browsers.
      `create table calendar_connections (
        user_id uuid primary key references users (id) on delete cascade,
        provider text not null default 'google',
        refresh_token_enc text not null,
        scope text not null,
        connected_at timestamptz not null default now(),
        busy jsonb not null default '[]'::jsonb,
        busy_fetched_at timestamptz,
        last_error text
      )`,
      `create table notifications (
        user_id uuid not null references users (id) on delete cascade,
        event_id text not null,
        title text not null,
        reason text not null,
        starts_at timestamptz not null,
        created_at timestamptz not null default now(),
        read_at timestamptz,
        pushed_at timestamptz,
        primary key (user_id, event_id)
      )`,
      `create index notifications_user_created_idx on notifications (user_id, created_at desc)`,
      `create table push_subscriptions (
        endpoint text primary key,
        user_id uuid not null references users (id) on delete cascade,
        p256dh text not null,
        auth text not null,
        created_at timestamptz not null default now()
      )`,
      `create index push_subscriptions_user_idx on push_subscriptions (user_id)`,
    ],
  },
];
