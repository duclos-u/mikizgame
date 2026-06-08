import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { signToken } from "../lib/jwt";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono();

/**
 * POST /api/auth/register
 * Body: { username, email, password }
 * Returns: { user: { id, username, email }, token }
 */
auth.post("/register", async (c) => {
  const body = await c.req.json<{ username?: string; email?: string; password?: string }>();
  const { username, email, password } = body;

  if (!username || !email || !password) {
    return c.json({ error: "username, email and password are required" }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const existing = await db.query.users.findFirst({
    where: or(eq(users.username, username), eq(users.email, email)),
  });

  if (existing) {
    return c.json({ error: "Username or email already taken" }, 409);
  }

  const passwordHash = await Bun.password.hash(password);
  const [user] = await db
    .insert(users)
    .values({ username, email, passwordHash })
    .returning({ id: users.id, username: users.username, email: users.email });

  const token = await signToken({ sub: user.id, username: user.username });
  return c.json({ user, token }, 201);
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { user: { id, username, email }, token }
 */
auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user || !(await Bun.password.verify(password, user.passwordHash))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signToken({ sub: user.id, username: user.username });
  return c.json({
    user: { id: user.id, username: user.username, email: user.email },
    token,
  });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
auth.get("/me", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true, email: true, createdAt: true },
  });

  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({ user });
});

export { auth };
