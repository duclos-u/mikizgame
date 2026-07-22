import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { chainapanDaily, chainapanSessions, games, leaderboardEntries } from "../db/schema";
import { type ChainapanStep, MAX_STEPS, computeStepTiles, validateStep } from "../lib/chainapan";
import { todayDate } from "../lib/date";
import { normalizeWord } from "../lib/normalize";
import { recordDailyPlay } from "../lib/streak";
import { authMiddleware } from "../middleware/auth";

let chainapanGameId: string | null = null;
async function getChainapanGameId(): Promise<string | null> {
  if (chainapanGameId) return chainapanGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "chainapan") });
  if (game) chainapanGameId = game.id;
  return chainapanGameId;
}

const chainapan = new Hono();

const stepSchema = z.object({ word: z.string().min(1).max(20) });

/**
 * GET /api/chainapan/daily
 * Public. Returns today's puzzle (start word, target word, word length, max steps).
 */
chainapan.get("/daily", async (c) => {
  const today = todayDate();
  const daily = await db.query.chainapanDaily.findFirst({
    where: eq(chainapanDaily.date, today),
  });

  if (!daily) return c.json({ error: "No puzzle scheduled for today" }, 404);

  return c.json({
    date: today,
    wordLength: daily.startWord.length,
    startWord: daily.startWord,
    targetWord: daily.targetWord,
    maxSteps: MAX_STEPS,
    minSteps: (daily.solution?.length ?? 2) - 1,
  });
});

/**
 * GET /api/chainapan/session
 * Protected. Returns the user's session for today with recomputed tile results.
 */
chainapan.get("/session", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const session = await db.query.chainapanSessions.findFirst({
    where: and(eq(chainapanSessions.userId, userId), eq(chainapanSessions.date, today)),
  });

  if (!session) return c.json({ session: null });

  const daily = await db.query.chainapanDaily.findFirst({
    where: eq(chainapanDaily.id, session.dailyId),
  });

  if (!daily) return c.json({ session: null });

  const rawSteps = (session.steps as string[] | null) ?? [];
  const prevWords = [daily.startWord, ...rawSteps];
  const steps: ChainapanStep[] = rawSteps.map((word, i) => ({
    word,
    tileResults: computeStepTiles(prevWords[i], word, daily.targetWord),
  }));

  return c.json({
    session: {
      status: session.status,
      steps,
      stepsLeft: MAX_STEPS - rawSteps.length,
      startWord: daily.startWord,
      targetWord: daily.targetWord,
      wordLength: daily.startWord.length,
    },
  });
});

/**
 * POST /api/chainapan/step
 * Protected. Submit the next word in the chain.
 * Body: { word: string }
 */
chainapan.post("/step", authMiddleware, zValidator("json", stepSchema), async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const { word: rawWord } = c.req.valid("json");
  const word = normalizeWord(rawWord);

  const daily = await db.query.chainapanDaily.findFirst({
    where: eq(chainapanDaily.date, today),
  });

  if (!daily) return c.json({ error: "No puzzle scheduled for today" }, 404);

  const existing = await db.query.chainapanSessions.findFirst({
    where: and(eq(chainapanSessions.userId, userId), eq(chainapanSessions.date, today)),
  });

  if (existing && existing.status !== "in_progress") {
    return c.json({ error: "Game already completed for today" }, 409);
  }

  const currentSteps = (existing?.steps as string[] | null) ?? [];
  const prevWord =
    currentSteps.length > 0 ? currentSteps[currentSteps.length - 1] : daily.startWord;

  const validationError = validateStep(word, prevWord);
  if (validationError) {
    return c.json({ error: validationError }, 422);
  }

  const tileResults = computeStepTiles(prevWord, word, daily.targetWord);
  const updatedSteps = [...currentSteps, word];

  const isWon = word === daily.targetWord;
  const isLost = !isWon && updatedSteps.length >= MAX_STEPS;
  const newStatus = isWon ? "won" : isLost ? "lost" : "in_progress";
  const completedAt = newStatus !== "in_progress" ? new Date() : null;

  let streakUpdate: Awaited<ReturnType<typeof recordDailyPlay>> | null = null;
  if (newStatus === "in_progress") {
    if (!existing) {
      const [claimed] = await db
        .insert(chainapanSessions)
        .values({
          userId,
          dailyId: daily.id,
          date: today,
          steps: updatedSteps,
          status: newStatus,
          completedAt,
        })
        .onConflictDoNothing({ target: [chainapanSessions.userId, chainapanSessions.date] })
        .returning({ id: chainapanSessions.id });
      if (!claimed) {
        return c.json({ error: "Game already completed for today" }, 409);
      }
    } else {
      await db
        .update(chainapanSessions)
        .set({ steps: updatedSteps, status: newStatus, completedAt })
        .where(eq(chainapanSessions.id, existing.id));
    }
  } else {
    const gameId = await getChainapanGameId();
    const minSteps = (daily.solution?.length ?? 2) - 1;
    const claimed = await db.transaction(async (tx) => {
      let ownsSession: boolean;
      if (!existing) {
        const [row] = await tx
          .insert(chainapanSessions)
          .values({
            userId,
            dailyId: daily.id,
            date: today,
            steps: updatedSteps,
            status: newStatus,
            completedAt,
          })
          .onConflictDoNothing({ target: [chainapanSessions.userId, chainapanSessions.date] })
          .returning({ id: chainapanSessions.id });
        ownsSession = !!row;
      } else {
        const [row] = await tx
          .update(chainapanSessions)
          .set({ steps: updatedSteps, status: newStatus, completedAt })
          .where(
            and(eq(chainapanSessions.id, existing.id), eq(chainapanSessions.status, "in_progress")),
          )
          .returning({ id: chainapanSessions.id });
        ownsSession = !!row;
      }

      if (ownsSession && gameId) {
        await tx
          .insert(leaderboardEntries)
          .values({
            userId,
            gameId,
            date: today,
            score: isWon ? updatedSteps.length - minSteps + 1 : null,
          })
          .onConflictDoNothing();
      }
      return ownsSession;
    });

    if (!claimed) {
      return c.json({ error: "Game already completed for today" }, 409);
    }
    streakUpdate = await recordDailyPlay(userId);
  }

  return c.json({
    step: { word, tileResults },
    status: newStatus,
    stepsLeft: MAX_STEPS - updatedSteps.length,
    ...(streakUpdate?.newMilestone ? { streakMilestone: streakUpdate.newMilestone } : {}),
  });
});

/**
 * DELETE /api/chainapan/session
 * Dev-only. Wipes the authenticated user's session and leaderboard entry for today.
 */
chainapan.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(chainapanSessions)
    .where(and(eq(chainapanSessions.userId, userId), eq(chainapanSessions.date, today)));

  const gameId = await getChainapanGameId();
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

export { chainapan };
