import { currentUser, error, json, readJson, sameOrigin } from "@/server/http";
import { ActionError, applyAction } from "@/server/service";
import { clientAction } from "@/server/validate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  const parsed = clientAction.safeParse(await readJson(req));
  if (!parsed.success) return error(400, "That change couldn't be saved because some details were invalid.");
  try {
    return json({ state: await applyAction(user.id, parsed.data) });
  } catch (e) {
    if (e instanceof ActionError) return error(409, e.message);
    console.error("action failed", parsed.data.type); // never log payloads
    return error(500, "Something went wrong saving that. Please try again.");
  }
}
