import { and, desc, eq, gte } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { leaderboardEntries, userStreakMilestones } from "../db/schema";
import { todayDate } from "../lib/date";
import { STREAK_MILESTONES } from "../lib/streak";
import { authMiddleware } from "../middleware/auth";

const streak = new Hono();

/**
 * GET /api/streak/history?days=7
 * Returns the last N days' "did the user play at least one game" flag,
 * sourced from leaderboard_entries.
 */
streak.get("/history", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const days = Math.min(Math.max(Number(c.req.query("days") ?? 7), 1), 30);

  const today = todayDate();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startDate = start.toISOString().slice(0, 10);

  const rows = await db
    .selectDistinct({ date: leaderboardEntries.date })
    .from(leaderboardEntries)
    .where(and(eq(leaderboardEntries.userId, userId), gte(leaderboardEntries.date, startDate)));

  const playedDates = new Set(rows.map((r) => r.date));

  const daysList = Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return { date, played: playedDates.has(date) };
  });

  return c.json({ days: daysList });
});

/**
 * GET /api/streak/milestones
 * Returns milestones already achieved by the user, and the next unreached one.
 */
streak.get("/milestones", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;

  const rows = await db
    .select({
      milestone: userStreakMilestones.milestone,
      achievedAt: userStreakMilestones.achievedAt,
      shownAt: userStreakMilestones.shownAt,
    })
    .from(userStreakMilestones)
    .where(eq(userStreakMilestones.userId, userId))
    .orderBy(desc(userStreakMilestones.achievedAt));

  const achievedSet = new Set(rows.map((r) => r.milestone));
  const next = STREAK_MILESTONES.find((m) => !achievedSet.has(m)) ?? null;

  return c.json({
    achieved: rows.map((r) => ({
      milestone: r.milestone,
      achievedAt: r.achievedAt.toISOString(),
      shownAt: r.shownAt ? r.shownAt.toISOString() : null,
    })),
    next,
  });
});

/**
 * POST /api/streak/milestones/:milestone/ack
 * Marks a milestone as shown to the user, so it isn't re-toasted on reload.
 */
streak.post("/milestones/:milestone/ack", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const milestone = Number(c.req.param("milestone"));
  if (
    !Number.isInteger(milestone) ||
    !(STREAK_MILESTONES as readonly number[]).includes(milestone)
  ) {
    return c.json({ error: "Invalid milestone" }, 400);
  }

  await db
    .update(userStreakMilestones)
    .set({ shownAt: new Date() })
    .where(
      and(eq(userStreakMilestones.userId, userId), eq(userStreakMilestones.milestone, milestone)),
    );

  return c.json({ ok: true });
});

export { streak };
