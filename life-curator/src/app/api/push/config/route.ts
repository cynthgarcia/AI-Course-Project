import { json } from "@/server/http";
import { pushConfigured } from "@/server/push";

export const dynamic = "force-dynamic";

/** The public key browsers need to subscribe (safe to share). */
export async function GET() {
  return json({ available: pushConfigured(), publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
}
