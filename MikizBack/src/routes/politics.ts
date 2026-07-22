import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { games, leaderboardEntries, politicsDaily, politicsSessions } from "../db/schema";
import { todayDate } from "../lib/date";
import {
  type Tentative,
  comparePoliticians,
  getDeputeInfo,
  getMEPInfo,
  getPolitician,
  searchPoliticians,
} from "../lib/politics";
import { recordDailyPlay } from "../lib/streak";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";

const MAX_TENTATIVES = 10;

// ─── Daily politician ─────────────────────────────────────────────────────────

let dailyCache: { dateStr: string; index: number } | null = null;

async function getDailyPoliticianIndex(): Promise<number | null> {
  const dateStr = todayDate();
  if (dailyCache?.dateStr === dateStr) return dailyCache.index;

  const row = await db.query.politicsDaily.findFirst({
    where: eq(politicsDaily.date, dateStr),
  });
  if (!row) return null;

  dailyCache = { dateStr, index: row.politicianIndex };
  return row.politicianIndex;
}

// ─── Game ID helper ───────────────────────────────────────────────────────────

let politicsGameId: string | null = null;
async function getPoliticsGameId(): Promise<string | null> {
  if (politicsGameId) return politicsGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "politeki") });
  if (game) politicsGameId = game.id;
  return politicsGameId;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const guessSchema = z.object({
  politicianIndex: z.number().int().nonnegative(),
});

const dailySchema = z.object({
  politicianIndex: z.number().int().nonnegative(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const politics = new Hono();

/**
 * GET /api/politics/search?q=...
 * Public. Autocomplete sur les politiciens devinables.
 */
politics.get("/search", (c) => {
  const q = c.req.query("q") ?? "";
  const results = searchPoliticians(q);
  return c.json(
    results.map((p) => ({
      index: p.index,
      prenom: p.prenom,
      nom: p.nom,
      currentOrLastParti: p.currentOrLastParti,
      popularityScore: p.popularityScore,
      deces: p.deces ?? null,
    })),
  );
});

/**
 * GET /api/politics/session
 * Protégé. État courant de la partie du joueur pour aujourd'hui.
 */
politics.get("/session", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId") as string | undefined;

  if (!userId) return c.json({ session: null });

  const today = todayDate();

  const targetIndex = await getDailyPoliticianIndex();
  if (targetIndex === null) return c.json({ error: "Politicien·ne du jour non configuré·e" }, 503);

  const session = await db.query.politicsSessions.findFirst({
    where: and(eq(politicsSessions.userId, userId), eq(politicsSessions.date, today)),
  });

  const target = getPolitician(targetIndex);
  if (!target) return c.json({ error: "Politicien·ne introuvable" }, 500);

  if (!session) return c.json({ session: null });

  return c.json({
    session: {
      statut: session.status,
      tentatives: session.tentatives as Tentative[],
      tentativesRestantes: MAX_TENTATIVES - (session.tentatives as unknown[]).length,
      politicienCible: session.status !== "in_progress" ? target : null,
    },
  });
});

/**
 * POST /api/politics/guess
 * Protégé. Soumet un politicien. Body : { politicianIndex: number }
 */
politics.post("/guess", optionalAuthMiddleware, zValidator("json", guessSchema), async (c) => {
  const userId = c.get("userId") as string | undefined;
  const today = todayDate();

  const { politicianIndex } = c.req.valid("json");

  const targetIndex = await getDailyPoliticianIndex();
  if (targetIndex === null) return c.json({ error: "Politicien·ne du jour non configuré·e" }, 503);

  const guess = getPolitician(politicianIndex);
  const target = getPolitician(targetIndex);

  if (!guess) return c.json({ error: "Politicien·ne introuvable" }, 404);
  if (!target) return c.json({ error: "Erreur serveur" }, 500);

  const correct = politicianIndex === targetIndex;
  const comparison = comparePoliticians(guess, target);

  const nouvelleTentative: Tentative = {
    politicianIndex,
    politicien: { prenom: guess.prenom, nom: guess.nom },
    comparison,
    deputeInfo: getDeputeInfo(guess),
    mepInfo: getMEPInfo(guess) ?? null,
  };

  if (userId) {
    const session = await db.query.politicsSessions.findFirst({
      where: and(eq(politicsSessions.userId, userId), eq(politicsSessions.date, today)),
    });

    if (session && session.status !== "in_progress") {
      return c.json({ error: "Partie déjà terminée aujourd'hui" }, 409);
    }

    const tentativesPrev = (session?.tentatives ?? []) as Tentative[];

    if (tentativesPrev.some((t) => t.politicianIndex === politicianIndex)) {
      return c.json({ error: "Politicien déjà soumis" }, 400);
    }

    const nouvellesTentatives = [...tentativesPrev, nouvelleTentative];
    const estPerdu = !correct && nouvellesTentatives.length >= MAX_TENTATIVES;
    const nouveauStatut = correct ? "won" : estPerdu ? "lost" : "in_progress";
    const completedAt = nouveauStatut !== "in_progress" ? new Date() : null;

    if (!session) {
      await db.insert(politicsSessions).values({
        userId,
        date: today,
        tentatives: nouvellesTentatives,
        status: nouveauStatut,
        completedAt,
      });
    } else {
      await db
        .update(politicsSessions)
        .set({ tentatives: nouvellesTentatives, status: nouveauStatut, completedAt })
        .where(eq(politicsSessions.id, session.id));
    }

    let streakUpdate: Awaited<ReturnType<typeof recordDailyPlay>> | null = null;
    if (nouveauStatut !== "in_progress") {
      const gameId = await getPoliticsGameId();
      if (gameId) {
        await db
          .insert(leaderboardEntries)
          .values({
            userId,
            gameId,
            date: today,
            score: correct ? nouvellesTentatives.length : null,
          })
          .onConflictDoNothing();
      }
      streakUpdate = await recordDailyPlay(userId);
    }

    return c.json({
      correct,
      comparison,
      deputeInfo: nouvelleTentative.deputeInfo ?? null,
      mepInfo: nouvelleTentative.mepInfo ?? null,
      tentativesRestantes: MAX_TENTATIVES - nouvellesTentatives.length,
      statut: nouveauStatut,
      politicienCible: nouveauStatut !== "in_progress" ? target : null,
      ...(streakUpdate?.newMilestone ? { streakMilestone: streakUpdate.newMilestone } : {}),
    });
  }

  // Guest: no DB, statut computed client-side from tentatives count (unknown server-side)
  return c.json({
    correct,
    comparison,
    deputeInfo: nouvelleTentative.deputeInfo ?? null,
    mepInfo: nouvelleTentative.mepInfo ?? null,
    tentativesRestantes: null,
    statut: null,
    politicienCible: correct ? target : null,
  });
});

/**
 * POST /api/politics/daily
 * Dev uniquement. Définit le politicien du jour.
 */
politics.post("/daily", zValidator("json", dailySchema), async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }

  const { politicianIndex, date } = c.req.valid("json");
  const targetDate = date ?? todayDate();

  const politician = getPolitician(politicianIndex);
  if (!politician) return c.json({ error: "Politicien·ne introuvable" }, 404);

  await db
    .insert(politicsDaily)
    .values({ date: targetDate, politicianIndex })
    .onConflictDoUpdate({ target: politicsDaily.date, set: { politicianIndex } });

  dailyCache = null;
  return c.json({ ok: true, politicien: { prenom: politician.prenom, nom: politician.nom } });
});

/**
 * DELETE /api/politics/session
 * Dev uniquement. Réinitialise la session du joueur.
 */
politics.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(politicsSessions)
    .where(and(eq(politicsSessions.userId, userId), eq(politicsSessions.date, today)));

  const gameId = await getPoliticsGameId();
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

export { politics };
