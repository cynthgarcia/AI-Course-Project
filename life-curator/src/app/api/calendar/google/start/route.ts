import { authUrl, googleConfigured, newAuthAttempt } from "@/server/googleCalendar";
import { currentUser } from "@/server/http";

export const dynamic = "force-dynamic";

const COOKIE = "lc_oauth";

/** Starts "Connect Google Calendar": sends the user to Google's consent screen. */
export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return Response.redirect(new URL("/login?next=%2Fsettings", req.url), 303);
  if (!googleConfigured()) return Response.redirect(new URL("/settings?calendar=unavailable", req.url), 303);
  const { state, verifier, challenge } = newAuthAttempt();
  const secure = process.env.COOKIE_INSECURE === "1" ? "" : "; Secure";
  return new Response(null, {
    status: 303,
    headers: {
      location: authUrl(req, state, challenge),
      "set-cookie": `${COOKIE}=${state}.${verifier}; Path=/api/calendar/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
      "cache-control": "no-store",
    },
  });
}
