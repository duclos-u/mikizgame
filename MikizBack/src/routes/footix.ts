import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db";
import { footixDaily, footixSessions, games, leaderboardEntries } from "../db/schema";
import { todayDate } from "../lib/date";
import {
  type FootixTentative,
  compareFootballers,
  getFootballer,
  searchFootballers,
} from "../lib/footix";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";

const MAX_TENTATIVES = 8;

// ─── Daily footballer ─────────────────────────────────────────────────────────

let dailyCache: { dateStr: string; index: number } | null = null;

async function getDailyFootballerIndex(): Promise<number | null> {
  const dateStr = todayDate();
  if (dailyCache?.dateStr === dateStr) return dailyCache.index;

  const row = await db.query.footixDaily.findFirst({
    where: eq(footixDaily.date, dateStr),
  });
  if (!row) return null;

  dailyCache = { dateStr, index: row.footballerIndex };
  return row.footballerIndex;
}

// ─── Game ID helper ───────────────────────────────────────────────────────────

let footixGameId: string | null = null;
async function getFootixGameId(): Promise<string | null> {
  if (footixGameId) return footixGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "footix") });
  if (game) footixGameId = game.id;
  return footixGameId;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const guessSchema = z.object({
  footballerIndex: z.number().int().nonnegative(),
});

const dailySchema = z.object({
  footballerIndex: z.number().int().nonnegative(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const footix = new Hono();

/**
 * GET /api/footix/search?q=...
 * Public. Autocomplete sur les footballeurs.
 */
footix.get("/search", (c) => {
  const q = c.req.query("q") ?? "";
  const results = searchFootballers(q);
  return c.json(
    results.map((f) => ({
      index: f.index,
      prenom: f.prenom,
      nom: f.nom,
      club: f.club,
      ligue: f.ligue,
      nationalite: f.nationalite,
      poste: f.poste,
      popularityScore: f.popularityScore,
    })),
  );
});

/**
 * GET /api/footix/session
 * Protégé. État courant de la partie du joueur pour aujourd'hui.
 */
footix.get("/session", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId") as string | undefined;

  if (!userId) return c.json({ session: null });

  const today = todayDate();

  const targetIndex = await getDailyFootballerIndex();
  if (targetIndex === null) return c.json({ error: "Footballeur du jour non configuré" }, 503);

  const session = await db.query.footixSessions.findFirst({
    where: and(eq(footixSessions.userId, userId), eq(footixSessions.date, today)),
  });

  const target = getFootballer(targetIndex);
  if (!target) return c.json({ error: "Footballeur introuvable" }, 500);

  if (!session) return c.json({ session: null });

  return c.json({
    session: {
      statut: session.status,
      tentatives: session.tentatives as FootixTentative[],
      tentativesRestantes: MAX_TENTATIVES - (session.tentatives as unknown[]).length,
      footballeurCible: session.status !== "in_progress" ? target : null,
    },
  });
});

/**
 * POST /api/footix/guess
 * Protégé. Soumet un footballeur. Body : { footballerIndex: number }
 */
footix.post("/guess", optionalAuthMiddleware, zValidator("json", guessSchema), async (c) => {
  const userId = c.get("userId") as string | undefined;
  const today = todayDate();

  const { footballerIndex } = c.req.valid("json");

  const targetIndex = await getDailyFootballerIndex();
  if (targetIndex === null) return c.json({ error: "Footballeur du jour non configuré" }, 503);

  const guess = getFootballer(footballerIndex);
  const target = getFootballer(targetIndex);

  if (!guess) return c.json({ error: "Footballeur introuvable" }, 404);
  if (!target) return c.json({ error: "Erreur serveur" }, 500);

  const correct = footballerIndex === targetIndex;
  const comparison = compareFootballers(guess, target);

  const nouvelleTentative: FootixTentative = {
    footballerIndex,
    footballer: { prenom: guess.prenom, nom: guess.nom },
    comparison,
  };

  if (userId) {
    const session = await db.query.footixSessions.findFirst({
      where: and(eq(footixSessions.userId, userId), eq(footixSessions.date, today)),
    });

    if (session && session.status !== "in_progress") {
      return c.json({ error: "Partie déjà terminée aujourd'hui" }, 409);
    }

    const tentativesPrev = (session?.tentatives ?? []) as FootixTentative[];

    if (tentativesPrev.some((t) => t.footballerIndex === footballerIndex)) {
      return c.json({ error: "Footballeur déjà soumis" }, 400);
    }

    const nouvellesTentatives = [...tentativesPrev, nouvelleTentative];
    const estPerdu = !correct && nouvellesTentatives.length >= MAX_TENTATIVES;
    const nouveauStatut = correct ? "won" : estPerdu ? "lost" : "in_progress";
    const completedAt = nouveauStatut !== "in_progress" ? new Date() : null;

    if (!session) {
      await db.insert(footixSessions).values({
        userId,
        date: today,
        tentatives: nouvellesTentatives,
        status: nouveauStatut,
        completedAt,
      });
    } else {
      await db
        .update(footixSessions)
        .set({ tentatives: nouvellesTentatives, status: nouveauStatut, completedAt })
        .where(eq(footixSessions.id, session.id));
    }

    if (nouveauStatut !== "in_progress") {
      const gameId = await getFootixGameId();
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
    }

    return c.json({
      correct,
      comparison,
      tentativesRestantes: MAX_TENTATIVES - nouvellesTentatives.length,
      statut: nouveauStatut,
      footballeurCible: nouveauStatut !== "in_progress" ? target : null,
    });
  }

  // Guest: no DB, statut computed client-side
  return c.json({
    correct,
    comparison,
    tentativesRestantes: null,
    statut: null,
    footballeurCible: correct ? target : null,
  });
});

/**
 * POST /api/footix/daily
 * Dev uniquement. Définit le footballeur du jour.
 */
footix.post("/daily", zValidator("json", dailySchema), async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }

  const { footballerIndex, date } = c.req.valid("json");
  const targetDate = date ?? todayDate();

  const footballer = getFootballer(footballerIndex);
  if (!footballer) return c.json({ error: "Footballeur introuvable" }, 404);

  await db
    .insert(footixDaily)
    .values({ date: targetDate, footballerIndex })
    .onConflictDoUpdate({ target: footixDaily.date, set: { footballerIndex } });

  dailyCache = null;
  return c.json({ ok: true, footballeur: { prenom: footballer.prenom, nom: footballer.nom } });
});

/**
 * DELETE /api/footix/session
 * Dev uniquement. Réinitialise la session du joueur.
 */
footix.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(footixSessions)
    .where(and(eq(footixSessions.userId, userId), eq(footixSessions.date, today)));

  const gameId = await getFootixGameId();
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

export { footix };
