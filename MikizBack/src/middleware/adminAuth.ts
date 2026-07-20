import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { verifyToken } from "../lib/jwt";

export async function adminAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyToken(authHeader.slice(7));
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      return c.json({ error: "Forbidden" }, 403);
    }
    c.set("userId", payload.sub);
    c.set("username", payload.username);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}
