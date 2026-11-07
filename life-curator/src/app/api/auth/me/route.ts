import { currentUser, error, json } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser(req);
  return user ? json({ email: user.email }) : error(401, "Not signed in.");
}
