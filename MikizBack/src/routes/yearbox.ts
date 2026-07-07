import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { games, leaderboardEntries, yearboxDaily, yearboxSessions } from "../db/schema";
import { todayDate } from "../lib/date";
import {
  type YearboxPuzzle,
  compareYear,
  getFactsRevealed,
  getPuzzle,
} from "../lib/yearbox";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";

const MAX_GUESSES = 5;

// ─── Daily puzzle ─────────────────────────────────────────────────────────────

let dailyCache: { dateStr: string; index: number } | null = null;

async function getDailyPuzzleIndex(): Promise<number | null> {
  const dateStr = todayDate();
  if (dailyCache?.dateStr === dateStr) return dailyCache.index;

  const row = await db.query.yearboxDaily.findFirst({
    where: eq(yearboxDaily.date, dateStr),
  });
  if (!row) return null;

  dailyCache = { dateStr, index: row.puzzleIndex };
  return row.puzzleIndex;
}

// ─── Game ID helper ───────────────────────────────────────────────────────────

let yearboxGameId: string | null = null;
async function getYearboxGameId(): Promise<string | null> {
  if (yearboxGameId) return yearboxGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "yearbox") });
  if (game) yearboxGameId = game.id;
  return yearboxGameId;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const guessSchema = z.object({
  year: z.number().int().min(1900).max(2030),
  wrongGuessesSoFar: z.number().int().nonnegative().optional(),
});

const dailySchema = z.object({
  puzzleIndex: z.number().int().nonnegative(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSessionPayload(
  puzzle: YearboxPuzzle,
  guesses: number[],
  status: "in_progress" | "won" | "lost",
) {
  const wrongCount = guesses.filter((g) => g !== puzzle.year).length;
  return {
    statut: status,
    guesses,
    factsRevealed: getFactsRevealed(puzzle, wrongCount),
    tentativesRestantes: MAX_GUESSES - guesses.length,
    cible: status !== "in_progress" ? { year: puzzle.year, facts: puzzle.facts } : null,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const yearbox = new Hono();

/**
 * GET /api/yearbox/daily
 * Public. Returns the initial two facts for today's puzzle (no year revealed).
 */
yearbox.get("/daily", async (c) => {
  const puzzleIndex = await getDailyPuzzleIndex();
  if (puzzleIndex === null) return c.json({ error: "Puzzle du jour non configuré" }, 503);

  const puzzle = getPuzzle(puzzleIndex);
  if (!puzzle) return c.json({ error: "Puzzle introuvable" }, 500);

  return c.json({ factsRevealed: getFactsRevealed(puzzle, 0) });
});

/**
 * GET /api/yearbox/session
 * Optional auth. Returns the current player's session for today.
 */
yearbox.get("/session", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ session: null });

  const today = todayDate();

  const puzzleIndex = await getDailyPuzzleIndex();
  if (puzzleIndex === null) return c.json({ error: "Puzzle du jour non configuré" }, 503);

  const puzzle = getPuzzle(puzzleIndex);
  if (!puzzle) return c.json({ error: "Puzzle introuvable" }, 500);

  const session = await db.query.yearboxSessions.findFirst({
    where: and(eq(yearboxSessions.userId, userId), eq(yearboxSessions.date, today)),
  });

  if (!session) return c.json({ session: null });

  return c.json({ session: buildSessionPayload(puzzle, session.guesses as number[], session.status) });
});

/**
 * POST /api/yearbox/guess
 * Optional auth. Submit a year guess. Body: { year: number }
 */
yearbox.post("/guess", optionalAuthMiddleware, zValidator("json", guessSchema), async (c) => {
  const userId = c.get("userId") as string | undefined;
  const today = todayDate();
  const { year, wrongGuessesSoFar } = c.req.valid("json");

  const puzzleIndex = await getDailyPuzzleIndex();
  if (puzzleIndex === null) return c.json({ error: "Puzzle du jour non configuré" }, 503);

  const puzzle = getPuzzle(puzzleIndex);
  if (!puzzle) return c.json({ error: "Erreur serveur" }, 500);

  const direction = compareYear(year, puzzle.year);
  const correct = direction === "exact";

  if (userId) {
    const session = await db.query.yearboxSessions.findFirst({
      where: and(eq(yearboxSessions.userId, userId), eq(yearboxSessions.date, today)),
    });

    if (session && session.status !== "in_progress") {
      return c.json({ error: "Partie déjà terminée aujourd'hui" }, 409);
    }

    const prevGuesses = (session?.guesses ?? []) as number[];

    if (prevGuesses.includes(year)) {
      return c.json({ error: "Année déjà soumise" }, 400);
    }

    const newGuesses = [...prevGuesses, year];
    const lost = !correct && newGuesses.length >= MAX_GUESSES;
    const newStatus = correct ? "won" : lost ? "lost" : "in_progress";
    const completedAt = newStatus !== "in_progress" ? new Date() : null;

    const wrongCount = newGuesses.filter((g) => g !== puzzle.year).length;
    const factsRevealed = getFactsRevealed(puzzle, wrongCount);

    if (!session) {
      await db.insert(yearboxSessions).values({
        userId,
        date: today,
        guesses: newGuesses,
        status: newStatus,
        completedAt,
      });
    } else {
      await db
        .update(yearboxSessions)
        .set({ guesses: newGuesses, status: newStatus, completedAt })
        .where(eq(yearboxSessions.id, session.id));
    }

    if (newStatus !== "in_progress") {
      const gameId = await getYearboxGameId();
      if (gameId) {
        await db
          .insert(leaderboardEntries)
          .values({
            userId,
            gameId,
            date: today,
            score: correct ? newGuesses.length : null,
          })
          .onConflictDoNothing();
      }
    }

    return c.json({
      direction,
      factsRevealed,
      tentativesRestantes: MAX_GUESSES - newGuesses.length,
      statut: newStatus,
      cible: newStatus !== "in_progress" ? { year: puzzle.year, facts: puzzle.facts } : null,
    });
  }

  // Guest: stateless, no DB writes. Client sends wrongGuessesSoFar to compute reveals correctly.
  const wrongCount = correct ? (wrongGuessesSoFar ?? 0) : (wrongGuessesSoFar ?? 0) + 1;
  return c.json({
    direction,
    factsRevealed: getFactsRevealed(puzzle, wrongCount),
    tentativesRestantes: null,
    statut: null,
    cible: correct ? { year: puzzle.year, facts: puzzle.facts } : null,
  });
});

/**
 * POST /api/yearbox/daily
 * Dev only. Seeds today's daily puzzle by index.
 */
yearbox.post("/daily", zValidator("json", dailySchema), async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }

  const { puzzleIndex, date } = c.req.valid("json");
  const targetDate = date ?? todayDate();

  const puzzle = getPuzzle(puzzleIndex);
  if (!puzzle) return c.json({ error: "Puzzle introuvable" }, 404);

  await db
    .insert(yearboxDaily)
    .values({ date: targetDate, puzzleIndex })
    .onConflictDoUpdate({ target: yearboxDaily.date, set: { puzzleIndex } });

  dailyCache = null;
  return c.json({ ok: true, year: puzzle.year });
});

/**
 * DELETE /api/yearbox/session
 * Dev only. Resets the current user's session.
 */
yearbox.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(yearboxSessions)
    .where(and(eq(yearboxSessions.userId, userId), eq(yearboxSessions.date, today)));

  const gameId = await getYearboxGameId();
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

export { yearbox };
