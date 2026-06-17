import type { Context, Next } from "hono";
import { verifyToken } from "../lib/jwt";

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await verifyToken(authHeader.slice(7));
    c.set("userId", payload.sub);
    c.set("username", payload.username);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

export async function optionalAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = await verifyToken(authHeader.slice(7));
      c.set("userId", payload.sub);
      c.set("username", payload.username);
    } catch {
      // Invalid token — continue as guest, userId stays undefined
    }
  }
  await next();
}
