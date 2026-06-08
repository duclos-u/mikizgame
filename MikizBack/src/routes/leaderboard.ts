import { asc, and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { games, leaderboardEntries, users } from "../db/schema";

const leaderboard = new Hono();

const RANK_POINTS = [25, 18, 15, 12, 10, 8];

/**
 * GET /api/leaderboard/cross?date=YYYY-MM-DD
 * Public. Returns a cross-game leaderboard for a given date.
 * Points awarded by attempts (F1 barème): 1→25, 2→18, 3→15, 4→12, 5→10, 6→8, loss→0.
 * Only players who completed at least one game appear.
 */
leaderboard.get("/cross", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const activeGames = await db.query.games.findMany({
    where: eq(games.active, true),
  });

  if (activeGames.length === 0) {
    return c.json({ date, games: [], entries: [] });
  }

  const gameResults = await Promise.all(
    activeGames.map(async (game) => {
      const entries = await db
        .select({ username: users.username, score: leaderboardEntries.score })
        .from(leaderboardEntries)
        .innerJoin(users, eq(leaderboardEntries.userId, users.id))
        .where(and(eq(leaderboardEntries.gameId, game.id), eq(leaderboardEntries.date, date)))
        .orderBy(asc(leaderboardEntries.score));
      return { slug: game.slug, entries };
    })
  );

  type UserData = { total: number; breakdown: Record<string, { rank: number; score: number | null; points: number }> };
  const userMap: Record<string, UserData> = {};

  for (const { slug, entries } of gameResults) {
    entries.forEach((entry, idx) => {
      const rank = idx + 1;
      const points = entry.score !== null ? (RANK_POINTS[entry.score - 1] ?? 0) : 0;
      if (!userMap[entry.username]) userMap[entry.username] = { total: 0, breakdown: {} };
      userMap[entry.username].breakdown[slug] = { rank, score: entry.score, points };
      userMap[entry.username].total += points;
    });
  }

  const result = Object.entries(userMap)
    .map(([username, data]) => ({ username, ...data }))
    .sort((a, b) => b.total - a.total || a.username.localeCompare(b.username));

  return c.json({ date, games: activeGames.map((g) => g.slug), entries: result });
});

/**
 * GET /api/leaderboard/:game/stats
 * Public. Returns all-time aggregate stats per user for a game.
 * Sorted by average points DESC (more = better), users with no wins rank last.
 */
leaderboard.get("/:game/stats", async (c) => {
  const gameSlug = c.req.param("game");

  const game = await db.query.games.findFirst({
    where: eq(games.slug, gameSlug),
  });

  if (!game) return c.json({ error: "Game not found" }, 404);
  if (!game.active) return c.json({ error: "Game is inactive" }, 404);

  const pointsExpr = sql`CASE ${leaderboardEntries.score} WHEN 1 THEN 25 WHEN 2 THEN 18 WHEN 3 THEN 15 WHEN 4 THEN 12 WHEN 5 THEN 10 WHEN 6 THEN 8 ELSE 0 END`;

  const entries = await db
    .select({
      username: users.username,
      wins: sql<number>`count(${leaderboardEntries.score})::int`,
      avgAttempts: sql<number | null>`round(avg(${leaderboardEntries.score})::numeric, 2)`,
      totalPoints: sql<number>`sum(${pointsExpr})::int`,
    })
    .from(leaderboardEntries)
    .innerJoin(users, eq(leaderboardEntries.userId, users.id))
    .where(eq(leaderboardEntries.gameId, game.id))
    .groupBy(users.id, users.username)
    .orderBy(sql`sum(${pointsExpr}) DESC`);

  return c.json({ game: gameSlug, total: entries.length, entries });
});

/**
 * GET /api/leaderboard/counts?date=YYYY-MM-DD
 * Public. Returns the number of players who completed each active game on the given date.
 */
leaderboard.get("/counts", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const activeGames = await db.query.games.findMany({
    where: eq(games.active, true),
  });

  const counts = await Promise.all(
    activeGames.map(async (game) => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leaderboardEntries)
        .where(and(eq(leaderboardEntries.gameId, game.id), eq(leaderboardEntries.date, date)));
      return { slug: game.slug, count: row?.count ?? 0 };
    })
  );

  const result: Record<string, number> = {};
  for (const { slug, count } of counts) result[slug] = count;

  return c.json({ date, counts: result });
});

/**
 * GET /api/leaderboard/:game?date=YYYY-MM-DD
 * Public. Returns ranked entries for a game on a given date.
 * Points awarded by attempts (F1 barème): 1→25, 2→18, 3→15, 4→12, 5→10, 6→8, loss→0.
 * Sorted by points DESC, ties broken alphabetically.
 */
leaderboard.get("/:game", async (c) => {
  const gameSlug = c.req.param("game");
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const game = await db.query.games.findFirst({
    where: eq(games.slug, gameSlug),
  });

  if (!game) return c.json({ error: "Game not found" }, 404);
  if (!game.active) return c.json({ error: "Game is inactive" }, 404);

  const rows = await db
    .select({
      username: users.username,
      score: leaderboardEntries.score,
      completedAt: leaderboardEntries.createdAt,
    })
    .from(leaderboardEntries)
    .innerJoin(users, eq(leaderboardEntries.userId, users.id))
    .where(and(eq(leaderboardEntries.gameId, game.id), eq(leaderboardEntries.date, date)));

  const entries = rows
    .map((row) => ({
      username: row.username,
      score: row.score,
      points: row.score !== null ? (RANK_POINTS[row.score - 1] ?? 1) : 0,
      completedAt: row.completedAt,
    }))
    .sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));

  return c.json({ date, game: gameSlug, total: entries.length, entries });
});

export { leaderboard };
