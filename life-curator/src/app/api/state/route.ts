import { getDb } from "@/server/db";
import { currentUser, error, json } from "@/server/http";
import { loadState } from "@/server/repo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  return json({ email: user.email, state: await loadState(await getDb(), user.id) });
}
