import { getDb } from "@/server/db";
import { currentUser, error } from "@/server/http";
import { loadState } from "@/server/repo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return error(401, "Not signed in.");
  const state = await loadState(await getDb(), user.id);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), app: "your-life-curator", email: user.email, data: state }, null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="life-curator-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
