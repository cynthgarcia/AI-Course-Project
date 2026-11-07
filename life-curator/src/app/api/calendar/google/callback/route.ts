import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db";
import { exchangeCode, saveConnection } from "@/server/googleCalendar";
import { currentUser, readCookie } from "@/server/http";

export const dynamic = "force-dynamic";

function back(req: Request, result: string): Response {
  const secure = process.env.COOKIE_INSECURE === "1" ? "" : "; Secure";
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL(`/settings?calendar=${result}`, req.url).toString(),
      "set-cookie": `lc_oauth=; Path=/api/calendar/google; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      "cache-control": "no-store",
    },
  });
}

/** Google sends the user back here after they approve (or decline). */
export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return Response.redirect(new URL("/login?next=%2Fsettings", req.url), 303);
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(req, "declined");
  const [state, verifier] = (readCookie(req, "lc_oauth") ?? "").split(".");
  const given = Buffer.from(url.searchParams.get("state") ?? "");
  const expected = Buffer.from(state ?? "");
  const code = url.searchParams.get("code");
  if (!state || !verifier || !code || given.length !== expected.length || !timingSafeEqual(given, expected)) return back(req, "error");
  try {
    const { refreshToken, scope } = await exchangeCode(req, code, verifier);
    await saveConnection(await getDb(), user.id, refreshToken, scope);
    return back(req, "connected");
  } catch {
    return back(req, "error");
  }
}
