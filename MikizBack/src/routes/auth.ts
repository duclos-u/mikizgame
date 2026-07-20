import { zValidator } from "@hono/zod-validator";
import { eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { users } from "../db/schema";
import { signToken } from "../lib/jwt";
import { authMiddleware } from "../middleware/auth";
import { createResetToken, resetPassword, sendResetEmail } from "../server/auth/passwordReset";

const auth = new Hono();

const registerSchema = z.object({
  username: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/register
 * Body: { username, email, password }
 * Returns: { user: { id, username, email }, token }
 */
auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const { username, email, password } = c.req.valid("json");

  const existing = await db.query.users.findFirst({
    where: or(eq(users.username, username), eq(users.email, email)),
  });

  if (existing) {
    return c.json({ error: "Username or email already taken" }, 409);
  }

  const passwordHash = await Bun.password.hash(password);
  const [user] = await db.insert(users).values({ username, email, passwordHash }).returning({
    id: users.id,
    username: users.username,
    email: users.email,
    isAdmin: users.isAdmin,
  });

  const token = await signToken({ sub: user.id, username: user.username });
  return c.json({ user: { ...user, streak: 0, longestStreak: 0 }, token }, 201);
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { user: { id, username, email }, token }
 */
auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user || !(await Bun.password.verify(password, user.passwordHash))) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signToken({ sub: user.id, username: user.username });
  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      streak: user.streakCount,
      longestStreak: user.longestStreakCount,
      isAdmin: user.isAdmin,
    },
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
    columns: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      streakCount: true,
      longestStreakCount: true,
      isAdmin: true,
    },
  });

  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      streak: user.streakCount,
      longestStreak: user.longestStreakCount,
      isAdmin: user.isAdmin,
    },
  });
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

// In-memory rate limiter: email → timestamp of last request
const forgotPasswordRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Always returns 200 to avoid revealing whether the email is registered.
 */
auth.post("/forgot-password", zValidator("json", forgotPasswordSchema), async (c) => {
  const { email } = c.req.valid("json");

  const now = Date.now();
  const lastRequest = forgotPasswordRateLimit.get(email);
  if (lastRequest !== undefined && now - lastRequest < RATE_LIMIT_WINDOW_MS) {
    return c.json({ error: "Trop de demandes. Veuillez réessayer dans une minute." }, 429);
  }
  forgotPasswordRateLimit.set(email, now);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (user) {
    const token = await createResetToken(user.id);
    const frontendUrl = process.env.CORS_ORIGIN ?? "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await sendResetEmail(email, resetUrl);
  }

  return c.json({
    message: "Si cet email est enregistré, un lien de réinitialisation a été envoyé.",
  });
});

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 */
auth.post("/reset-password", zValidator("json", resetPasswordSchema), async (c) => {
  const { token, newPassword } = c.req.valid("json");

  try {
    await resetPassword(token, newPassword);
  } catch {
    return c.json({ error: "Lien invalide ou expiré." }, 400);
  }

  return c.json({ message: "Mot de passe réinitialisé avec succès." });
});

export { auth };
