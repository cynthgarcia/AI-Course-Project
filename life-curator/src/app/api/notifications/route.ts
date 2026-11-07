import { getDb } from "@/server/db";
import { currentUser, error, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  const rows = await (await getDb()).query<{ event_id: string; title: string; reason: string; starts_at: Date | string; created_at: Date | string; read_at: Date | string | null }>(
    "select event_id, title, reason, starts_at, created_at, read_at from notifications where user_id = $1 order by created_at desc limit 50",
    [user.id],
  );
  const iso = (d: Date | string) => new Date(d).toISOString();
  return json({
    unread: rows.filter((r) => !r.read_at).length,
    items: rows.map((r) => ({ eventId: r.event_id, title: r.title, reason: r.reason, startsAt: iso(r.starts_at), createdAt: iso(r.created_at), read: !!r.read_at })),
  });
}
