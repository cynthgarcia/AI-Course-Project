// Database access. Production: any Postgres via DATABASE_URL (e.g. Supabase, Neon).
// Development and tests: embedded Postgres (PGlite) stored under .data/ — same SQL, no setup.
import path from "node:path";
import { MIGRATIONS } from "./migrations";

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

async function createPglite(dataDir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  const wrap = (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Queryable => ({
    async query<T>(text: string, params: unknown[] = []) {
      return (await c.query(text, params)).rows as T[];
    },
  });
  return {
    ...wrap(pg),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    close: () => pg.close(),
  };
}

async function createPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 5, ssl: process.env.DATABASE_SSL === "disable" ? false : "require", onnotice: () => {} });
  type Unsafe = (t: string, p?: never[]) => Promise<unknown[]>;
  const wrap = (u: Unsafe): Queryable => ({
    async query<T>(text: string, params: unknown[] = []) {
      return [...(await u(text, params as never[]))] as T[];
    },
  });
  return {
    ...wrap(sql.unsafe.bind(sql) as unknown as Unsafe),
    transaction: (fn) => sql.begin((tx) => fn(wrap(tx.unsafe.bind(tx) as unknown as Unsafe))) as Promise<never>,
    close: () => sql.end(),
  };
}

async function migrate(db: Db): Promise<void> {
  await db.query("create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await db.query<{ id: string }>("select id from schema_migrations")).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.transaction(async (q) => {
      for (const stmt of m.statements) await q.query(stmt);
      await q.query("insert into schema_migrations (id) values ($1)", [m.id]);
    });
  }
}

const g = globalThis as unknown as { __lcDb?: Promise<Db> };

/** Shared connection, created and migrated on first use. */
export function getDb(): Promise<Db> {
  if (!g.__lcDb) {
    g.__lcDb = (async () => {
      const db = process.env.DATABASE_URL
        ? await createPostgres(process.env.DATABASE_URL)
        : await createPglite(process.env.DATA_DIR ?? path.join(process.cwd(), ".data", "pglite"));
      await migrate(db);
      return db;
    })();
    g.__lcDb.catch(() => {
      g.__lcDb = undefined;
    });
  }
  return g.__lcDb;
}

/** Test helper: drop the shared connection so the next getDb() starts fresh. */
export async function resetDbForTests(): Promise<void> {
  const db = await g.__lcDb?.catch(() => undefined);
  g.__lcDb = undefined;
  await db?.close();
}
