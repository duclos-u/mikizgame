import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { users } from "../db/schema";
import { signToken } from "../lib/jwt";
import { authMiddleware } from "../middleware/auth";

const auth = new Hono();

function computeStreak(
  currentStreak: number,
  lastLoginDate: string | null,
  todayDate: string,
): { streakCount: number; lastLoginDate: string; changed: boolean } {
  if (lastLoginDate === todayDate)
    return { streakCount: currentStreak, lastLoginDate, changed: false };
  const yesterday = new Date(todayDate);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  // Increment only if last login was exactly yesterday; any gap resets to 1.
  const newStreak = lastLoginDate === yesterdayStr ? currentStreak + 1 : 1;
  return { streakCount: newStreak, lastLoginDate: todayDate, changed: true };
}

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

  const todayDate = new Date().toISOString().slice(0, 10);
  const { streakCount, lastLoginDate: newLastLogin, changed } = computeStreak(
    user.streakCount,
    user.lastLoginDate,
    todayDate,
  );
  if (changed) {
    await db.update(users).set({ streakCount, lastLoginDate: newLastLogin }).where(eq(users.id, user.id));
  }

  const token = await signToken({ sub: user.id, username: user.username });
  return c.json({
    user: { id: user.id, username: user.username, email: user.email, streak: streakCount },
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
    columns: { id: true, username: true, email: true, createdAt: true, lastLoginDate: true, streakCount: true },
  });

  if (!user) return c.json({ error: "User not found" }, 404);

  const todayDate = new Date().toISOString().slice(0, 10);
  const { streakCount, lastLoginDate: newLastLogin, changed } = computeStreak(
    user.streakCount,
    user.lastLoginDate,
    todayDate,
  );
  if (changed) {
    await db.update(users).set({ streakCount, lastLoginDate: newLastLogin }).where(eq(users.id, userId));
  }

  return c.json({
    user: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt, streak: streakCount },
  });
});

export { auth };
