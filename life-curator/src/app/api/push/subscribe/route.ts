import { z } from "zod";
import { getDb } from "@/server/db";
import { currentUser, error, json, readJson, sameOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

const body = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://")),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  const parsed = body.safeParse(await readJson(req, 4_000));
  if (!parsed.success) return error(400, "That notification subscription wasn't valid.");
  const db = await getDb();
  const [{ n }] = (await db.query<{ n: number }>("select count(*)::int as n from push_subscriptions where user_id = $1", [user.id])) as [{ n: number }];
  if (n >= 10) await db.query("delete from push_subscriptions where endpoint = (select endpoint from push_subscriptions where user_id = $1 order by created_at limit 1)", [user.id]);
  await db.query(
    `insert into push_subscriptions (endpoint, user_id, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [parsed.data.endpoint, user.id, parsed.data.keys.p256dh, parsed.data.keys.auth],
  );
  return json({ ok: true });
}
