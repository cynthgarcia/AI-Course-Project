import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Public sign-up settings (never the code itself). */
export async function GET() {
  return json({ inviteRequired: !!process.env.SIGNUP_INVITE_CODE });
}
