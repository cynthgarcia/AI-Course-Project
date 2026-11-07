// Web push notifications (standard browser push; no third-party service). Needs VAPID keys:
// generate once with `npx web-push generate-vapid-keys`.
import webpush from "web-push";
import type { Queryable } from "./db";

export function pushConfigured(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

let configured = false;
function setup(): void {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? process.env.APP_URL ?? "https://offhours.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export type Sender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;

const defaultSender: Sender = (sub, payload) => {
  setup();
  return webpush.sendNotification(sub, payload, { TTL: 24 * 3600, urgency: "normal" });
};

/** Sends to every device the user turned notifications on for. Returns how many received it. */
export async function pushToUser(q: Queryable, userId: string, msg: PushMessage, send: Sender = defaultSender): Promise<number> {
  if (!pushConfigured() && send === defaultSender) return 0;
  const subs = await q.query<{ endpoint: string; p256dh: string; auth: string }>("select endpoint, p256dh, auth from push_subscriptions where user_id = $1", [userId]);
  let delivered = 0;
  for (const s of subs) {
    try {
      await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg));
      delivered++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // The browser unsubscribed or the subscription expired: forget it.
      if (status === 404 || status === 410) await q.query("delete from push_subscriptions where endpoint = $1 and user_id = $2", [s.endpoint, userId]);
    }
  }
  return delivered;
}
