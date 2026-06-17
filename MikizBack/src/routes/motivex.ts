import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { games, leaderboardEntries, motivexDailyWords, motivexSessions } from "../db/schema";
import { todayDate } from "../lib/date";
import { type GuessResult, evaluateGuess } from "../lib/motivex";
import { isValidWord } from "../lib/words";
import { authMiddleware } from "../middleware/auth";

const MAX_ATTEMPTS = 6;

let motivexGameId: string | null = null;
async function getMotivexGameId(): Promise<string | null> {
  if (motivexGameId) return motivexGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "motivex") });
  if (game) motivexGameId = game.id;
  return motivexGameId;
}

const motivex = new Hono();

const guessSchema = z.object({
  guess: z.string().min(1).max(20),
});

/**
 * GET /api/motivex/daily
 * Public. Returns today's word length and first letter.
 */
motivex.get("/daily", async (c) => {
  const today = todayDate();
  const daily = await db.query.motivexDailyWords.findFirst({
    where: eq(motivexDailyWords.date, today),
  });

  if (!daily) return c.json({ error: "No word scheduled for today" }, 404);

  return c.json({
    date: today,
    wordLength: daily.word.length,
    firstLetter: daily.word[0],
  });
});

/**
 * GET /api/motivex/session
 * Protected. Returns the user's session for today.
 */
motivex.get("/session", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const session = await db.query.motivexSessions.findFirst({
    where: and(eq(motivexSessions.userId, userId), eq(motivexSessions.date, today)),
  });

  if (!session) return c.json({ session: null });

  const daily = await db.query.motivexDailyWords.findFirst({
    where: eq(motivexDailyWords.id, session.wordId),
  });

  return c.json({
    session: {
      status: session.status,
      attempts: session.attempts,
      wordLength: daily?.word.length,
      firstLetter: daily?.word[0],
      // Reveal the answer once the game is over
      ...(session.status !== "in_progress" ? { word: daily?.word } : {}),
    },
  });
});

/**
 * POST /api/motivex/guess
 * Protected. Submit a guess for today's word.
 * Body: { guess: string }
 * Returns: { result: GuessResult, status, attemptsLeft, word? }
 */
motivex.post("/guess", authMiddleware, zValidator("json", guessSchema), async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const { guess: rawGuess } = c.req.valid("json");
  const guess = rawGuess.toUpperCase().trim();

  const daily = await db.query.motivexDailyWords.findFirst({
    where: eq(motivexDailyWords.date, today),
  });

  if (!daily) return c.json({ error: "No word scheduled for today" }, 404);

  if (guess.length !== daily.word.length) {
    return c.json({ error: `Guess must be ${daily.word.length} letters` }, 400);
  }

  if (!isValidWord(guess)) {
    return c.json({ error: "Not a valid French word" }, 422);
  }

  const existing = await db.query.motivexSessions.findFirst({
    where: and(eq(motivexSessions.userId, userId), eq(motivexSessions.date, today)),
  });

  if (existing && existing.status !== "in_progress") {
    return c.json({ error: "Game already completed for today" }, 409);
  }

  const previousAttempts = (existing?.attempts as GuessResult[] | null) ?? [];
  const guessResult: GuessResult = {
    guess,
    result: evaluateGuess(guess, daily.word),
  };
  const updatedAttempts = [...previousAttempts, guessResult];

  const isWon = guessResult.result.every((r) => r === "correct");
  const isLost = !isWon && updatedAttempts.length >= MAX_ATTEMPTS;
  const newStatus = isWon ? "won" : isLost ? "lost" : "in_progress";
  const completedAt = newStatus !== "in_progress" ? new Date() : null;

  if (!existing) {
    await db.insert(motivexSessions).values({
      userId,
      wordId: daily.id,
      date: today,
      attempts: updatedAttempts,
      status: newStatus,
      completedAt,
    });
  } else {
    await db
      .update(motivexSessions)
      .set({ attempts: updatedAttempts, status: newStatus, completedAt })
      .where(eq(motivexSessions.id, existing.id));
  }

  if (newStatus !== "in_progress") {
    const gameId = await getMotivexGameId();
    if (gameId) {
      await db
        .insert(leaderboardEntries)
        .values({
          userId,
          gameId,
          date: today,
          score: isWon ? updatedAttempts.length : null,
        })
        .onConflictDoNothing();
    }
  }

  return c.json({
    result: guessResult,
    status: newStatus,
    attemptsLeft: MAX_ATTEMPTS - updatedAttempts.length,
    ...(newStatus !== "in_progress" ? { word: daily.word } : {}),
  });
});

/**
 * DELETE /api/motivex/session
 * Dev-only. Wipes the authenticated user's session and leaderboard entry for today.
 */
motivex.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(motivexSessions)
    .where(and(eq(motivexSessions.userId, userId), eq(motivexSessions.date, today)));

  const gameId = await getMotivexGameId();
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

export { motivex };
