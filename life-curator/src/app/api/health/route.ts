import { ConfigError, getDb } from "@/server/db";
import { json } from "@/server/http";
import { MIGRATIONS } from "@/server/migrations";
import { configuredSources } from "@/server/sources";

export const dynamic = "force-dynamic";

/** Setup check after deploying. Reports configuration state only — never secrets or error details. */
export async function GET() {
  let database: "ok" | "not configured" | "unreachable" = "ok";
  let schema: string | null = null;
  try {
    const db = await getDb();
    const rows = await db.query<{ id: string }>("select id from schema_migrations order by id desc limit 1");
    schema = rows[0]?.id ?? null;
  } catch (e) {
    database = e instanceof ConfigError ? "not configured" : "unreachable";
  }
  return json(
    {
      ok: database === "ok" && schema === MIGRATIONS.at(-1)!.id,
      database,
      databaseKind: process.env.DATABASE_URL ? "postgres" : "embedded",
      schema,
      scheduledJobs: process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16 ? "configured" : "CRON_SECRET not set",
      sources: configuredSources().status.map(({ id, configured }) => ({ id, configured })),
    },
    database === "ok" ? 200 : 503,
  );
}
