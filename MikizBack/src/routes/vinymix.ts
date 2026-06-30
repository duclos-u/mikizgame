import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import {
  games,
  leaderboardEntries,
  vinymixArtists,
  vinymixDaily,
  vinymixSessions,
} from "../db/schema";
import { todayDate } from "../lib/date";
import { fetchSpotifyArtist, getArtistInfo, searchSpotifyArtists } from "../lib/spotify";
import { type VinymixArtist, type VinymixGuess, compareArtists, dailySeed } from "../lib/vinymix";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";

const MAX_GUESSES = 6;

// ─── Daily artist ─────────────────────────────────────────────────────────────

let dailyCache: { dateStr: string; artist: VinymixArtist } | null = null;

function rowToArtist(row: typeof vinymixArtists.$inferSelect): VinymixArtist {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    creationYear: row.creationYear,
    memberCount: row.memberCount,
    spotifyFollowers: row.spotifyFollowers,
    spotifyPopularity: row.spotifyPopularity,
    genres: (row.genres as string[]) ?? [],
    gender: row.gender,
    country: row.country,
  };
}

async function getDailyArtist(): Promise<VinymixArtist | null> {
  const dateStr = todayDate();
  if (dailyCache?.dateStr === dateStr) return dailyCache.artist;

  const row = await db.query.vinymixDaily.findFirst({
    where: eq(vinymixDaily.date, dateStr),
  });

  let artistId: string | null = null;

  if (row) {
    artistId = row.artistId;
  } else {
    const allIds = await db.select({ id: vinymixArtists.id }).from(vinymixArtists);
    artistId = dailySeed(
      dateStr,
      allIds.map((r) => r.id),
    );
  }

  if (!artistId) return null;

  const artist = await db.query.vinymixArtists.findFirst({
    where: eq(vinymixArtists.id, artistId),
  });

  if (!artist) return null;

  const result = rowToArtist(artist);
  dailyCache = { dateStr, artist: result };
  return result;
}

// ─── Game ID ──────────────────────────────────────────────────────────────────

let vinymixGameId: string | null = null;
async function getVinymixGameId(): Promise<string | null> {
  if (vinymixGameId) return vinymixGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "vinymix") });
  if (game) vinymixGameId = game.id;
  return vinymixGameId;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const vinymix = new Hono();

/**
 * GET /api/vinymix/session
 * Optional auth. Returns today's session state for logged-in users.
 */
vinymix.get("/session", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ session: null });

  const today = todayDate();
  const session = await db.query.vinymixSessions.findFirst({
    where: and(eq(vinymixSessions.userId, userId), eq(vinymixSessions.date, today)),
  });

  if (!session) return c.json({ session: null });

  const target = session.status !== "in_progress" ? await getDailyArtist() : null;
  const guesses = session.guesses as VinymixGuess[];

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
 * POST /api/vinymix/guess
 * Optional auth. Body: { artistId: string }
 * Authenticated: saves session, enforces limits.
 * Guest: stateless comparison only.
 */
vinymix.post("/guess", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId") as string | undefined;
  const today = todayDate();

  const body = await c.req.json<{ artistId?: string }>();
  if (!body.artistId) return c.json({ error: "artistId requis" }, 400);

  // Fetch guess artist from pool; auto-upsert from Spotify if missing
  let guessArtist: VinymixArtist;
  const guessRow = await db.query.vinymixArtists.findFirst({
    where: eq(vinymixArtists.id, body.artistId),
  });

  if (guessRow) {
    guessArtist = rowToArtist(guessRow);
  } else {
    const spotifyArtist = await fetchSpotifyArtist(body.artistId);
    if (!spotifyArtist) return c.json({ error: "Artiste introuvable" }, 404);
    guessArtist = await getArtistInfo(body.artistId, spotifyArtist.name, spotifyArtist.imageUrl);
    // Upsert so the pool grows and future dailySeed can draw from it
    await db
      .insert(vinymixArtists)
      .values({ ...guessArtist, updatedAt: new Date() })
      .onConflictDoNothing();
  }

  const target = await getDailyArtist();
  if (!target) return c.json({ error: "Artiste du jour non configuré" }, 503);
  const clues = compareArtists(guessArtist, target);
  const correct = guessArtist.id === target.id;

  if (userId) {
    const session = await db.query.vinymixSessions.findFirst({
      where: and(eq(vinymixSessions.userId, userId), eq(vinymixSessions.date, today)),
    });

    if (session && session.status !== "in_progress") {
      return c.json({ error: "Partie déjà terminée aujourd'hui" }, 409);
    }

    const prevGuesses = (session?.guesses ?? []) as VinymixGuess[];
    if (prevGuesses.some((g) => g.artist.id === body.artistId)) {
      return c.json({ error: "Artiste déjà deviné" }, 400);
    }

    const newGuess: VinymixGuess = { artist: guessArtist, clues };
    const newGuesses = [...prevGuesses, newGuess];
    const newCount = newGuesses.length;
    const lost = !correct && newCount >= MAX_GUESSES;
    const newStatus = correct ? "won" : lost ? "lost" : "in_progress";
    const completedAt = newStatus !== "in_progress" ? new Date() : null;

    if (!session) {
      await db.insert(vinymixSessions).values({
        userId,
        date: today,
        guesses: newGuesses,
        status: newStatus,
        completedAt,
      });
    } else {
      await db
        .update(vinymixSessions)
        .set({ guesses: newGuesses, status: newStatus, completedAt })
        .where(eq(vinymixSessions.id, session.id));
    }

    if (newStatus !== "in_progress") {
      const gameId = await getVinymixGameId();
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
 * GET /api/vinymix/today
 * Public. Returns today's target artist — used by guests after game over to reveal the answer.
 */
vinymix.get("/today", async (c) => {
  const artist = await getDailyArtist();
  if (!artist) return c.json({ error: "Aucun artiste configuré aujourd'hui" }, 503);
  return c.json({ targetArtist: artist });
});

/**
 * GET /api/vinymix/search?q=
 * Public. Searches Spotify directly.
 */
vinymix.get("/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json([]);

  const results = await searchSpotifyArtists(q);
  return c.json(results);
});

/**
 * POST /api/vinymix/artists
 * Dev: Upsert an artist into the pool.
 */
vinymix.post("/artists", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const artist = await c.req.json<VinymixArtist & { updatedAt?: unknown }>();
  await db
    .insert(vinymixArtists)
    .values({ ...artist, updatedAt: new Date() })
    .onConflictDoUpdate({ target: vinymixArtists.id, set: { ...artist, updatedAt: new Date() } });
  dailyCache = null;
  return c.json({ ok: true });
});

/**
 * POST /api/vinymix/daily
 * Dev: Set the daily artist for a given date.
 */
vinymix.post("/daily", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const { artistId, date } = await c.req.json<{ artistId: string; date?: string }>();
  const targetDate = date ?? todayDate();

  let artist = await db.query.vinymixArtists.findFirst({
    where: eq(vinymixArtists.id, artistId),
  });

  if (!artist) {
    const spotifyArtist = await fetchSpotifyArtist(artistId);
    if (!spotifyArtist) return c.json({ error: "Artiste introuvable" }, 404);
    const newArtist = {
      id: spotifyArtist.id,
      name: spotifyArtist.name,
      imageUrl: spotifyArtist.imageUrl,
      creationYear: null,
      memberCount: 1,
      spotifyFollowers: spotifyArtist.followers,
      spotifyPopularity: spotifyArtist.popularity,
      genres: spotifyArtist.genres,
      updatedAt: new Date(),
    };
    const [inserted] = await db
      .insert(vinymixArtists)
      .values(newArtist)
      .onConflictDoNothing()
      .returning();
    artist = inserted ?? await db.query.vinymixArtists.findFirst({ where: eq(vinymixArtists.id, artistId) }) ?? null;
    if (!artist) return c.json({ error: "Impossible d'insérer l'artiste" }, 500);
  }

  await db
    .insert(vinymixDaily)
    .values({ date: targetDate, artistId })
    .onConflictDoUpdate({ target: vinymixDaily.date, set: { artistId } });

  dailyCache = null;
  return c.json({ ok: true, artist: rowToArtist(artist) });
});

/**
 * DELETE /api/vinymix/session
 * Dev: Reset today's session for the authenticated user.
 */
vinymix.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(vinymixSessions)
    .where(and(eq(vinymixSessions.userId, userId), eq(vinymixSessions.date, today)));

  const gameId = await getVinymixGameId();
  if (gameId) {
    await db
      .delete(leaderboardEntries)
      .where(
        and(
          eq(leaderboardEntries.userId, userId),
          eq(leaderboardEntries.gameId, gameId),
          eq(leaderboardEntries.date, today),
        ),
      );
  }

  return c.json({ ok: true });
});

export { vinymix };
