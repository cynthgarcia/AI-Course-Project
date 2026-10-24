import { currentUser, error, json, readJson, sameOrigin } from "@/server/http";
import { ActionError, applyActions } from "@/server/service";
import { z } from "zod";
import { clientAction } from "@/server/validate";

/** One action, or a batch of up to 50 applied in order. */
const body = z.union([clientAction.transform((a) => [a]), z.object({ actions: z.array(clientAction).min(1).max(50) }).transform((b) => b.actions)]);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return error(403, "Cross-site request refused.");
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  const parsed = body.safeParse(await readJson(req, 512_000));
  if (!parsed.success) return error(400, "That change couldn't be saved because some details were invalid.");
  try {
    return json({ state: await applyActions(user.id, parsed.data) });
  } catch (e) {
    if (e instanceof ActionError) return error(409, e.message);
    console.error("action failed", parsed.data.map((a) => a.type).join(",")); // never log payloads
    return error(500, "Something went wrong saving that. Please try again.");
  }
}
