import { currentUser, error, json, rateLimited, readJson, sameOrigin } from "@/server/http";
import { fetchPage, ImportError, parseEventPage } from "@/server/importEvent";

export const dynamic = "force-dynamic";

/** Reads one pasted event page and returns a draft for the user to review. Nothing is saved here. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  if (rateLimited(`import:${user.id}`, 30, 60 * 60_000)) return error(429, "That's a lot of imports — try again in a while.");
  const body = await readJson<{ url?: unknown }>(req, 4_000);
  if (!body || typeof body.url !== "string" || body.url.length > 2000) return error(400, "Paste a link to an event page.");
  try {
    const page = await fetchPage(body.url.trim());
    const draft = parseEventPage(page.html, page.url);
    return json({ draft, importedFrom: new URL(page.url).hostname.replace(/^www\./, "") });
  } catch (e) {
    if (e instanceof ImportError) return error(422, e.message);
    return error(502, "That page couldn't be read. You can add the event by hand instead.");
  }
}
