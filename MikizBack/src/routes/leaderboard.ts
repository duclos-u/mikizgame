import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { games, leaderboardEntries, users } from "../db/schema";
import { RANK_POINTS, pointsExpr } from "../lib/leaderboard";

const leaderboard = new Hono();

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

  const gameIdToSlug = Object.fromEntries(activeGames.map((g) => [g.id, g.slug]));

  const flatEntries = await db
    .select({
      gameId: leaderboardEntries.gameId,
      username: users.username,
      score: leaderboardEntries.score,
    })
    .from(leaderboardEntries)
    .innerJoin(users, eq(leaderboardEntries.userId, users.id))
    .where(
      and(
        inArray(
          leaderboardEntries.gameId,
          activeGames.map((g) => g.id),
        ),
        eq(leaderboardEntries.date, date),
      ),
    )
    .orderBy(asc(leaderboardEntries.score));

  // Group by game slug and rank within each game
  const bySlug: Record<string, Array<{ username: string; score: number | null }>> = {};
  for (const entry of flatEntries) {
    const slug = gameIdToSlug[entry.gameId] ?? entry.gameId;
    if (!bySlug[slug]) bySlug[slug] = [];
    bySlug[slug].push({ username: entry.username, score: entry.score });
  }

  type UserData = {
    total: number;
    breakdown: Record<string, { rank: number; score: number | null; points: number }>;
  };
  const userMap: Record<string, UserData> = {};

  for (const [slug, entries] of Object.entries(bySlug)) {
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
 * GET /api/leaderboard/cross/stats
 * Public. Returns all-time cross-game leaderboard, aggregating F1 points across all active games.
 */
leaderboard.get("/cross/stats", async (c) => {
  const activeGames = await db.query.games.findMany({
    where: eq(games.active, true),
  });

  if (activeGames.length === 0) {
    return c.json({ games: [], entries: [] });
  }

  const gameResults = await Promise.all(
    activeGames.map(async (game) => {
      const entries = await db
        .select({
          username: users.username,
          totalPoints: sql<number>`sum(${pointsExpr})::int`,
        })
        .from(leaderboardEntries)
        .innerJoin(users, eq(leaderboardEntries.userId, users.id))
        .where(eq(leaderboardEntries.gameId, game.id))
        .groupBy(users.id, users.username);
      return { slug: game.slug, entries };
    }),
  );

  const userMap: Record<string, { total: number; breakdown: Record<string, { points: number }> }> =
    {};
  for (const { slug, entries } of gameResults) {
    for (const e of entries) {
      if (!userMap[e.username]) userMap[e.username] = { total: 0, breakdown: {} };
      userMap[e.username].breakdown[slug] = { points: e.totalPoints };
      userMap[e.username].total += e.totalPoints;
    }
  }

  const result = Object.entries(userMap)
    .map(([username, data]) => ({ username, ...data }))
    .sort((a, b) => b.total - a.total || a.username.localeCompare(b.username));

  return c.json({ games: activeGames.map((g) => g.slug), entries: result });
});

/**
 * GET /api/leaderboard/counts?date=YYYY-MM-DD
 * Public. Returns the number of players who completed each active game on the given date,
 * plus the average number of tries across those completions.
 */
leaderboard.get("/counts", async (c) => {
  const date = c.req.query("date") ?? new Date().toISOString().slice(0, 10);

  const activeGames = await db.query.games.findMany({
    where: eq(games.active, true),
  });

  const rows = await Promise.all(
    activeGames.map(async (game) => {
      const [result] = await db
        .select({
          count: sql<number>`count(*)::int`,
          avgTries: sql<number | null>`round(avg(${leaderboardEntries.score})::numeric, 1)`,
        })
        .from(leaderboardEntries)
        .where(and(eq(leaderboardEntries.gameId, game.id), eq(leaderboardEntries.date, date)));

      return {
        slug: game.slug,
        count: result?.count ?? 0,
        avgTries: result?.avgTries ?? null,
      };
    }),
  );

  const counts: Record<string, number> = {};
  const avgTries: Record<string, number | null> = {};
  for (const { slug, count, avgTries: avg } of rows) {
    counts[slug] = count;
    avgTries[slug] = avg;
  }

  return c.json({ date, counts, avgTries });
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
