import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, gte, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { games, leaderboardEntries, users } from "../db/schema";
import { todayDate } from "../lib/date";
import { signToken } from "../lib/jwt";
import { pointsExpr } from "../lib/leaderboard";
import { authMiddleware } from "../middleware/auth";

/**
 * Turns a rank among N players into a 0-100 percentile (100 = best).
 * Ties share the same rank (SQL RANK()), so a single player yields 100.
 */
function rankToPercentile(rank: number, totalPlayers: number): number {
  if (totalPlayers <= 1) return 100;
  return Math.round(((totalPlayers - rank) / (totalPlayers - 1)) * 100);
}

const profile = new Hono();

const HISTORY_DAYS = 365;

/**
 * GET /api/profile/summary
 * Returns everything the profile page needs in one round-trip:
 * member-since date, per-day play history (last 365 days) and all-time per-game stats.
 */
profile.get("/summary", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { createdAt: true },
  });
  if (!user) return c.json({ error: "User not found" }, 404);

  const today = todayDate();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (HISTORY_DAYS - 1));
  const startDate = start.toISOString().slice(0, 10);

  // Rank + percentile within each game's all-time points leaderboard.
  const pointsByUserGame = db
    .select({
      userId: leaderboardEntries.userId,
      game: games.slug,
      total: sql<number>`sum(${pointsExpr})`.as("total"),
    })
    .from(leaderboardEntries)
    .innerJoin(games, eq(leaderboardEntries.gameId, games.id))
    .groupBy(leaderboardEntries.userId, games.slug)
    .as("points_by_user_game");

  const rankedByGame = db
    .select({
      userId: pointsByUserGame.userId,
      game: pointsByUserGame.game,
      rank: sql<number>`rank() over (partition by ${pointsByUserGame.game} order by ${pointsByUserGame.total} desc)`.as(
        "rank",
      ),
      totalPlayers: sql<number>`count(*) over (partition by ${pointsByUserGame.game})`.as(
        "total_players",
      ),
    })
    .from(pointsByUserGame)
    .as("ranked_by_game");

  // Cross-game (overall) rank + percentile, same points barème summed across all games.
  const pointsByUser = db
    .select({
      userId: leaderboardEntries.userId,
      total: sql<number>`sum(${pointsExpr})`.as("total"),
    })
    .from(leaderboardEntries)
    .groupBy(leaderboardEntries.userId)
    .as("points_by_user");

  const rankedCross = db
    .select({
      userId: pointsByUser.userId,
      rank: sql<number>`rank() over (order by ${pointsByUser.total} desc)`.as("rank"),
      totalPlayers: sql<number>`count(*) over ()`.as("total_players"),
    })
    .from(pointsByUser)
    .as("ranked_cross");

  // Independent queries — none depend on another's result, so run them concurrently.
  const [history, gameStats, distributionRows, perGameRankRows, [crossRankRow]] = await Promise.all([
    db
      .select({
        date: leaderboardEntries.date,
        game: games.slug,
        score: leaderboardEntries.score,
      })
      .from(leaderboardEntries)
      .innerJoin(games, eq(leaderboardEntries.gameId, games.id))
      .where(and(eq(leaderboardEntries.userId, userId), gte(leaderboardEntries.date, startDate)))
      .orderBy(asc(leaderboardEntries.date)),
    db
      .select({
        game: games.slug,
        name: games.name,
        played: sql<number>`count(*)::int`,
        wins: sql<number>`count(${leaderboardEntries.score})::int`,
        avgAttempts: sql<number | null>`round(avg(${leaderboardEntries.score})::numeric, 1)`,
      })
      .from(leaderboardEntries)
      .innerJoin(games, eq(leaderboardEntries.gameId, games.id))
      .where(eq(leaderboardEntries.userId, userId))
      .groupBy(games.slug, games.name)
      .orderBy(sql`count(*) DESC`),
    // Win-distribution by attempt count (e.g. { 1: 2, 2: 5, 3: 1 }), plus losses, per game.
    db
      .select({
        game: games.slug,
        score: leaderboardEntries.score,
        count: sql<number>`count(*)::int`,
      })
      .from(leaderboardEntries)
      .innerJoin(games, eq(leaderboardEntries.gameId, games.id))
      .where(eq(leaderboardEntries.userId, userId))
      .groupBy(games.slug, leaderboardEntries.score),
    db
      .select({
        game: rankedByGame.game,
        rank: rankedByGame.rank,
        totalPlayers: rankedByGame.totalPlayers,
      })
      .from(rankedByGame)
      .where(eq(rankedByGame.userId, userId)),
    db
      .select({ rank: rankedCross.rank, totalPlayers: rankedCross.totalPlayers })
      .from(rankedCross)
      .where(eq(rankedCross.userId, userId)),
  ]);

  const distributionByGame: Record<string, { distribution: Record<number, number>; losses: number }> =
    {};
  for (const row of distributionRows) {
    if (!distributionByGame[row.game]) distributionByGame[row.game] = { distribution: {}, losses: 0 };
    if (row.score === null) {
      distributionByGame[row.game].losses += row.count;
    } else {
      distributionByGame[row.game].distribution[row.score] = row.count;
    }
  }

  const rankByGame: Record<string, { rank: number; totalPlayers: number; percentile: number }> = {};
  for (const row of perGameRankRows) {
    rankByGame[row.game] = {
      rank: row.rank,
      totalPlayers: row.totalPlayers,
      percentile: rankToPercentile(row.rank, row.totalPlayers),
    };
  }

  const crossRank = crossRankRow
    ? {
        rank: crossRankRow.rank,
        totalPlayers: crossRankRow.totalPlayers,
        percentile: rankToPercentile(crossRankRow.rank, crossRankRow.totalPlayers),
      }
    : null;

  return c.json({
    memberSince: user.createdAt.toISOString(),
    history,
    games: gameStats.map((g) => ({
      ...g,
      avgAttempts: g.avgAttempts === null ? null : Number(g.avgAttempts),
      distribution: distributionByGame[g.game]?.distribution ?? {},
      losses: distributionByGame[g.game]?.losses ?? 0,
      rank: rankByGame[g.game] ?? null,
    })),
    crossRank,
  });
});

const updateUsernameSchema = z.object({
  username: z.string().min(1).max(50),
});

/**
 * PATCH /api/profile/username
 * Body: { username }
 * Returns: { user, token } — a fresh token so the username claim stays accurate.
 */
profile.patch("/username", authMiddleware, zValidator("json", updateUsernameSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { username } = c.req.valid("json");

  const taken = await db.query.users.findFirst({
    where: and(eq(users.username, username), ne(users.id, userId)),
    columns: { id: true },
  });
  if (taken) {
    return c.json({ error: "Ce nom d'utilisateur est déjà pris" }, 409);
  }

  const updateUsername = () =>
    db.update(users).set({ username }).where(eq(users.id, userId)).returning({
      id: users.id,
      username: users.username,
      email: users.email,
      streakCount: users.streakCount,
      longestStreakCount: users.longestStreakCount,
      isAdmin: users.isAdmin,
    });

  let user: Awaited<ReturnType<typeof updateUsername>>[number] | undefined;
  try {
    [user] = await updateUsername();
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      return c.json({ error: "Ce nom d'utilisateur est déjà pris" }, 409);
    }
    throw err;
  }
  if (!user) return c.json({ error: "User not found" }, 404);

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

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

/**
 * PATCH /api/profile/password
 * Body: { currentPassword, newPassword }
 */
profile.patch("/password", authMiddleware, zValidator("json", updatePasswordSchema), async (c) => {
  const userId = c.get("userId") as string;
  const { currentPassword, newPassword } = c.req.valid("json");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { passwordHash: true },
  });
  if (!user) return c.json({ error: "User not found" }, 404);

  if (!(await Bun.password.verify(currentPassword, user.passwordHash))) {
    return c.json({ error: "Mot de passe actuel incorrect" }, 401);
  }

  const passwordHash = await Bun.password.hash(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  return c.json({ message: "Mot de passe modifié avec succès." });
});

export { profile };
