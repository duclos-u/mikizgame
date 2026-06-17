import { and, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import {
  games,
  leaderboardEntries,
  spotleArtists,
  spotleDaily,
  spotleSessions,
} from "../db/schema";
import {
  compareArtists,
  dailySeed,
  type SpotleArtist,
  type SpotleGuess,
} from "../lib/spotle";
import { searchSpotifyArtists } from "../lib/spotify";
import { todayDate } from "../lib/date";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";

const MAX_GUESSES = 6;

// ─── Daily artist ─────────────────────────────────────────────────────────────

let dailyCache: { dateStr: string; artist: SpotleArtist } | null = null;

function rowToArtist(row: typeof spotleArtists.$inferSelect): SpotleArtist {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    creationYear: row.creationYear,
    memberCount: row.memberCount,
    spotifyFollowers: row.spotifyFollowers,
    genres: (row.genres as string[]) ?? [],
    country: row.country,
    vocalType: row.vocalType,
    primaryLanguage: row.primaryLanguage,
    mostFamousSong: row.mostFamousSong as { title: string; spotifyStreams: number } | null,
    instrumentation: row.instrumentation,
    appearsOnSoundtracksWith: (row.appearsOnSoundtracksWith as string[]) ?? [],
  };
}

async function getDailyArtist(): Promise<SpotleArtist | null> {
  const dateStr = todayDate();
  if (dailyCache?.dateStr === dateStr) return dailyCache.artist;

  const row = await db.query.spotleDaily.findFirst({
    where: eq(spotleDaily.date, dateStr),
  });

  let artistId: string | null = null;

  if (row) {
    artistId = row.artistId;
  } else {
    const allIds = await db.select({ id: spotleArtists.id }).from(spotleArtists);
    artistId = dailySeed(dateStr, allIds.map((r) => r.id));
  }

  if (!artistId) return null;

  const artist = await db.query.spotleArtists.findFirst({
    where: eq(spotleArtists.id, artistId),
  });

  if (!artist) return null;

  const result = rowToArtist(artist);
  dailyCache = { dateStr, artist: result };
  return result;
}

// ─── Game ID ──────────────────────────────────────────────────────────────────

let spotleGameId: string | null = null;
async function getSpotleGameId(): Promise<string | null> {
  if (spotleGameId) return spotleGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "spotle") });
  if (game) spotleGameId = game.id;
  return spotleGameId;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const spotle = new Hono();

/**
 * GET /api/spotle/session
 * Optional auth. Returns today's session state for logged-in users.
 */
spotle.get("/session", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ session: null });

  const today = todayDate();
  const session = await db.query.spotleSessions.findFirst({
    where: and(eq(spotleSessions.userId, userId), eq(spotleSessions.date, today)),
  });

  if (!session) return c.json({ session: null });

  const target = session.status !== "in_progress" ? await getDailyArtist() : null;
  const guesses = session.guesses as SpotleGuess[];

  return c.json({
    session: {
      guesses,
      status: session.status,
      guessesLeft: MAX_GUESSES - guesses.length,
      targetArtist: target,
    },
  });
});

/**
 * POST /api/spotle/guess
 * Optional auth. Body: { artistId: string }
 * Authenticated: saves session, enforces limits.
 * Guest: stateless comparison only.
 */
spotle.post("/guess", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId") as string | undefined;
  const today = todayDate();

  const body = await c.req.json<{ artistId?: string }>();
  if (!body.artistId) return c.json({ error: "artistId requis" }, 400);

  const [guessRow, target] = await Promise.all([
    db.query.spotleArtists.findFirst({ where: eq(spotleArtists.id, body.artistId) }),
    getDailyArtist(),
  ]);

  if (!guessRow) return c.json({ error: "Artiste introuvable dans le pool" }, 404);
  if (!target) return c.json({ error: "Artiste du jour non configuré" }, 503);

  const guessArtist = rowToArtist(guessRow);
  const clues = compareArtists(guessArtist, target);
  const correct = guessArtist.id === target.id;

  if (userId) {
    const session = await db.query.spotleSessions.findFirst({
      where: and(eq(spotleSessions.userId, userId), eq(spotleSessions.date, today)),
    });

    if (session && session.status !== "in_progress") {
      return c.json({ error: "Partie déjà terminée aujourd'hui" }, 409);
    }

    const prevGuesses = (session?.guesses ?? []) as SpotleGuess[];
    if (prevGuesses.some((g) => g.artist.id === body.artistId)) {
      return c.json({ error: "Artiste déjà deviné" }, 400);
    }

    const newGuess: SpotleGuess = { artist: guessArtist, clues };
    const newGuesses = [...prevGuesses, newGuess];
    const newCount = newGuesses.length;
    const lost = !correct && newCount >= MAX_GUESSES;
    const newStatus = correct ? "won" : lost ? "lost" : "in_progress";
    const completedAt = newStatus !== "in_progress" ? new Date() : null;

    if (!session) {
      await db.insert(spotleSessions).values({
        userId,
        date: today,
        guesses: newGuesses,
        status: newStatus,
        completedAt,
      });
    } else {
      await db
        .update(spotleSessions)
        .set({ guesses: newGuesses, status: newStatus, completedAt })
        .where(eq(spotleSessions.id, session.id));
    }

    if (newStatus !== "in_progress") {
      const gameId = await getSpotleGameId();
      if (gameId) {
        await db.insert(leaderboardEntries).values({
          userId,
          gameId,
          date: today,
          score: correct ? newCount : null,
        });
      }
    }

    return c.json({
      guess: newGuess,
      status: newStatus,
      guessesLeft: MAX_GUESSES - newCount,
      targetArtist: newStatus !== "in_progress" ? target : null,
    });
  }

  // Stateless guest path
  return c.json({
    guess: { artist: guessArtist, clues },
    status: correct ? "won" : "in_progress",
    guessesLeft: -1,
    targetArtist: correct ? target : null,
  });
});

/**
 * GET /api/spotle/search?q=
 * Public. Searches pool by name; falls back to Spotify if configured.
 */
spotle.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json([]);

  const rows = await db
    .select({
      id: spotleArtists.id,
      name: spotleArtists.name,
      imageUrl: spotleArtists.imageUrl,
      genres: spotleArtists.genres,
      spotifyFollowers: spotleArtists.spotifyFollowers,
    })
    .from(spotleArtists)
    .where(ilike(spotleArtists.name, `%${q}%`))
    .limit(15);

  const poolResults = rows.map((r) => ({
    id: r.id,
    name: r.name,
    imageUrl: r.imageUrl,
    genres: (r.genres as string[]) ?? [],
    followers: r.spotifyFollowers,
    inPool: true,
  }));

  if (poolResults.length >= 10 || !process.env.SPOTIFY_CLIENT_ID) {
    return c.json(poolResults);
  }

  // Augment with Spotify results for names not already in pool
  try {
    const poolIds = new Set(poolResults.map((r) => r.id));
    const sp = await searchSpotifyArtists(q);
    const extra = sp
      .filter((a) => !poolIds.has(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        imageUrl: a.imageUrl,
        genres: a.genres,
        followers: a.followers,
        inPool: false,
      }));
    return c.json([...poolResults, ...extra].slice(0, 15));
  } catch {
    return c.json(poolResults);
  }
});

/**
 * POST /api/spotle/artists
 * Dev: Upsert an artist into the pool.
 */
spotle.post("/artists", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const artist = await c.req.json<SpotleArtist & { updatedAt?: unknown }>();
  await db
    .insert(spotleArtists)
    .values({ ...artist, updatedAt: new Date() })
    .onConflictDoUpdate({ target: spotleArtists.id, set: { ...artist, updatedAt: new Date() } });
  dailyCache = null;
  return c.json({ ok: true });
});

/**
 * POST /api/spotle/daily
 * Dev: Set the daily artist for a given date.
 */
spotle.post("/daily", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const { artistId, date } = await c.req.json<{ artistId: string; date?: string }>();
  const targetDate = date ?? todayDate();

  const artist = await db.query.spotleArtists.findFirst({
    where: eq(spotleArtists.id, artistId),
  });
  if (!artist) return c.json({ error: "Artiste introuvable dans le pool" }, 404);

  await db
    .insert(spotleDaily)
    .values({ date: targetDate, artistId })
    .onConflictDoUpdate({ target: spotleDaily.date, set: { artistId } });

  dailyCache = null;
  return c.json({ ok: true, artist: rowToArtist(artist) });
});

/**
 * DELETE /api/spotle/session
 * Dev: Reset today's session for the authenticated user.
 */
spotle.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(spotleSessions)
    .where(and(eq(spotleSessions.userId, userId), eq(spotleSessions.date, today)));

  const gameId = await getSpotleGameId();
  if (gameId) {
    await db.delete(leaderboardEntries).where(
      and(
        eq(leaderboardEntries.userId, userId),
        eq(leaderboardEntries.gameId, gameId),
        eq(leaderboardEntries.date, today),
      ),
    );
  }

  return c.json({ ok: true });
});

export { spotle };
