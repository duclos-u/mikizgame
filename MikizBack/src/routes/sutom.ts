import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { games, leaderboardEntries, sutomDailyWords, sutomSessions } from "../db/schema";
import { type GuessResult, evaluateGuess } from "../lib/sutom";
import { isValidWord } from "../lib/words";
import { authMiddleware } from "../middleware/auth";

const MAX_ATTEMPTS = 6;

const sutom = new Hono();

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/sutom/daily
 * Public. Returns today's word length and first letter.
 */
sutom.get("/daily", async (c) => {
  const today = todayDate();
  const daily = await db.query.sutomDailyWords.findFirst({
    where: eq(sutomDailyWords.date, today),
  });

  if (!daily) return c.json({ error: "No word scheduled for today" }, 404);

  return c.json({
    date: today,
    wordLength: daily.word.length,
    firstLetter: daily.word[0],
  });
});

/**
 * GET /api/sutom/session
 * Protected. Returns the user's session for today.
 */
sutom.get("/session", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const session = await db.query.sutomSessions.findFirst({
    where: and(eq(sutomSessions.userId, userId), eq(sutomSessions.date, today)),
  });

  if (!session) return c.json({ session: null });

  const daily = await db.query.sutomDailyWords.findFirst({
    where: eq(sutomDailyWords.id, session.wordId),
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
 * POST /api/sutom/guess
 * Protected. Submit a guess for today's word.
 * Body: { guess: string }
 * Returns: { result: GuessResult, status, attemptsLeft, word? }
 */
sutom.post("/guess", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const body = await c.req.json<{ guess?: string }>();
  const guess = body.guess?.toUpperCase().trim();

  if (!guess) return c.json({ error: "guess is required" }, 400);

  const daily = await db.query.sutomDailyWords.findFirst({
    where: eq(sutomDailyWords.date, today),
  });

  if (!daily) return c.json({ error: "No word scheduled for today" }, 404);

  if (guess.length !== daily.word.length) {
    return c.json({ error: `Guess must be ${daily.word.length} letters` }, 400);
  }

  if (!isValidWord(guess)) {
    return c.json({ error: "Not a valid French word" }, 422);
  }

  const existing = await db.query.sutomSessions.findFirst({
    where: and(eq(sutomSessions.userId, userId), eq(sutomSessions.date, today)),
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
    await db.insert(sutomSessions).values({
      userId,
      wordId: daily.id,
      date: today,
      attempts: updatedAttempts,
      status: newStatus,
      completedAt,
    });
  } else {
    await db
      .update(sutomSessions)
      .set({ attempts: updatedAttempts, status: newStatus, completedAt })
      .where(eq(sutomSessions.id, existing.id));
  }

  if (newStatus !== "in_progress") {
    const game = await db.query.games.findFirst({ where: eq(games.slug, "sutom") });
    if (game) {
      await db.insert(leaderboardEntries).values({
        userId,
        gameId: game.id,
        date: today,
        score: isWon ? updatedAttempts.length : null,
      });
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
 * DELETE /api/sutom/session
 * Dev-only. Wipes the authenticated user's session and leaderboard entry for today.
 */
sutom.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(sutomSessions)
    .where(
      and(eq(sutomSessions.userId, userId), eq(sutomSessions.date, today))
    );

  const game = await db.query.games.findFirst({
    where: eq(games.slug, "sutom"),
  });
  if (game) {
    await db
      .delete(leaderboardEntries)
      .where(
        and(
          eq(leaderboardEntries.userId, userId),
          eq(leaderboardEntries.gameId, game.id),
          eq(leaderboardEntries.date, today)
        )
      );
  }

  return c.json({ ok: true });
});

export { sutom };
