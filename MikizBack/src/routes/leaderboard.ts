import { asc, and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { games, leaderboardEntries, users } from "../db/schema";

const leaderboard = new Hono();

const RANK_POINTS = [10, 7, 5, 3, 2, 1];

/**
 * GET /api/leaderboard/cross?date=YYYY-MM-DD
 * Public. Returns a cross-game leaderboard for a given date.
 * Points awarded by rank within each game: 10/7/5/3/2/1 (1pt for rank 6+).
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
      const points = RANK_POINTS[idx] ?? 1;
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
 * Sorted by average attempts ASC (fewer = better), users with no wins rank last.
 */
leaderboard.get("/:game/stats", async (c) => {
  const gameSlug = c.req.param("game");

  const game = await db.query.games.findFirst({
    where: eq(games.slug, gameSlug),
  });

  if (!game) return c.json({ error: "Game not found" }, 404);
  if (!game.active) return c.json({ error: "Game is inactive" }, 404);

  const entries = await db
    .select({
      username: users.username,
      gamesPlayed: sql<number>`count(*)::int`,
      wins: sql<number>`count(${leaderboardEntries.score})::int`,
      avgAttempts: sql<number | null>`round(avg(${leaderboardEntries.score})::numeric, 2)`,
    })
    .from(leaderboardEntries)
    .innerJoin(users, eq(leaderboardEntries.userId, users.id))
    .where(eq(leaderboardEntries.gameId, game.id))
    .groupBy(users.id, users.username)
    .orderBy(sql`avg(${leaderboardEntries.score}) ASC NULLS LAST`);

  return c.json({ game: gameSlug, total: entries.length, entries });
});

/**
 * GET /api/leaderboard/:game?date=YYYY-MM-DD
 * Public. Returns ranked entries for a game on a given date.
 * Wins are sorted by fewest attempts; losses appear last.
 */
leaderboard.get("/:game", async (c) => {
  const gameSlug = c.req.param("game");
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const game = await db.query.games.findFirst({
    where: eq(games.slug, gameSlug),
  });

  if (!game) return c.json({ error: "Game not found" }, 404);
  if (!game.active) return c.json({ error: "Game is inactive" }, 404);

  // PostgreSQL sorts NULLs last in ASC order — losses (score = NULL) rank below wins
  const entries = await db
    .select({
      rank: leaderboardEntries.score,
      username: users.username,
      score: leaderboardEntries.score,
      completedAt: leaderboardEntries.createdAt,
    })
    .from(leaderboardEntries)
    .innerJoin(users, eq(leaderboardEntries.userId, users.id))
    .where(and(eq(leaderboardEntries.gameId, game.id), eq(leaderboardEntries.date, date)))
    .orderBy(asc(leaderboardEntries.score));

  return c.json({ date, game: gameSlug, total: entries.length, entries });
});

export { leaderboard };
