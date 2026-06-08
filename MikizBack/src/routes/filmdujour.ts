import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { cineclueSessions, games, leaderboardEntries } from "../db/schema";
import {
  compareFilms,
  getFilmById,
  getFilmDuJour,
  indicesFinaux,
  indicesVides,
  searchFilms,
  type Film,
  type IndicesReveles,
} from "../lib/cineclue";
import { authMiddleware } from "../middleware/auth";

const MAX_TENTATIVES = 10;

const filmdujour = new Hono();

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * GET /api/filmdujour/session
 * Protégé. Retourne l'état courant de la partie du joueur pour aujourd'hui.
 */
filmdujour.get("/session", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const session = await db.query.cineclueSessions.findFirst({
    where: and(
      eq(cineclueSessions.userId, userId),
      eq(cineclueSessions.date, today),
    ),
  });

  if (!session) return c.json({ session: null });

  const cible = getFilmDuJour();

  return c.json({
    session: {
      statut: session.status,
      tentatives: session.tentatives,
      indices: session.indices,
      tentativesRestantes:
        MAX_TENTATIVES - (session.tentatives as unknown[]).length,
      filmCible: session.status !== "in_progress" ? cible : null,
    },
  });
});

/**
 * POST /api/filmdujour/guess
 * Protégé. Soumet un film. Body : { tmdbId: number }
 */
filmdujour.post("/guess", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const body = await c.req.json<{ tmdbId?: number }>();
  if (!body.tmdbId) return c.json({ error: "tmdbId requis" }, 400);

  const filmSoumis = getFilmById(body.tmdbId);
  if (!filmSoumis) return c.json({ error: "Film introuvable dans la liste" }, 404);

  const cible = getFilmDuJour();

  const session = await db.query.cineclueSessions.findFirst({
    where: and(
      eq(cineclueSessions.userId, userId),
      eq(cineclueSessions.date, today),
    ),
  });

  if (session && session.status !== "in_progress") {
    return c.json({ error: "Partie déjà terminée aujourd'hui" }, 409);
  }

  const tentativesPrev = (session?.tentatives ?? []) as Array<{ tmdbId: number }>;
  const indicesCourants = (session?.indices ?? indicesVides()) as IndicesReveles;

  if (tentativesPrev.some((t) => t.tmdbId === body.tmdbId)) {
    return c.json({ error: "Film déjà soumis" }, 400);
  }

  const correct = filmSoumis.id === cible.id;

  // Révèle tout si correct, sinon calcule les indices communs
  const nouveauxIndices: IndicesReveles = correct
    ? indicesFinaux(cible)
    : compareFilms(filmSoumis, cible, indicesCourants);

  const nouvelleTentative = {
    tmdbId: filmSoumis.id,
    filmSoumis: filmSoumis satisfies Film,
  };

  const nouvellesTentatives = [...tentativesPrev, nouvelleTentative];
  const estPerdu = !correct && nouvellesTentatives.length >= MAX_TENTATIVES;
  const nouveauStatut = correct ? "won" : estPerdu ? "lost" : "in_progress";
  const completedAt = nouveauStatut !== "in_progress" ? new Date() : null;

  if (!session) {
    await db.insert(cineclueSessions).values({
      userId,
      date: today,
      tentatives: nouvellesTentatives,
      indices: nouveauxIndices,
      status: nouveauStatut as "in_progress" | "won" | "lost",
      completedAt,
    });
  } else {
    await db
      .update(cineclueSessions)
      .set({
        tentatives: nouvellesTentatives,
        indices: nouveauxIndices,
        status: nouveauStatut as "in_progress" | "won" | "lost",
        completedAt,
      })
      .where(eq(cineclueSessions.id, session.id));
  }

  // Enregistrement au classement en fin de partie
  if (nouveauStatut !== "in_progress") {
    const game = await db.query.games.findFirst({
      where: eq(games.slug, "cineclue"),
    });
    if (game) {
      await db.insert(leaderboardEntries).values({
        userId,
        gameId: game.id,
        date: today,
        score: correct ? nouvellesTentatives.length : null,
      });
    }
  }

  return c.json({
    correct,
    filmSoumis: nouvelleTentative.filmSoumis,
    indicesReveles: nouveauxIndices,
    tentativesRestantes: MAX_TENTATIVES - nouvellesTentatives.length,
    statut: nouveauStatut,
    filmCible: nouveauStatut !== "in_progress" ? cible : null,
  });
});

/**
 * DELETE /api/filmdujour/session
 * Dev uniquement. Réinitialise la session du joueur.
 */
filmdujour.delete("/session", authMiddleware, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }
  const userId = c.get("userId") as string;
  const today = todayDate();

  await db
    .delete(cineclueSessions)
    .where(
      and(
        eq(cineclueSessions.userId, userId),
        eq(cineclueSessions.date, today),
      ),
    );

  const game = await db.query.games.findFirst({ where: eq(games.slug, "cineclue") });
  if (game) {
    await db
      .delete(leaderboardEntries)
      .where(
        and(
          eq(leaderboardEntries.userId, userId),
          eq(leaderboardEntries.gameId, game.id),
          eq(leaderboardEntries.date, today),
        ),
      );
  }

  return c.json({ ok: true });
});

export { filmdujour };

// ─── Route search séparée ─────────────────────────────────────────────────────

/**
 * GET /api/films/search?q=...
 * Public. Autocomplete sur la liste locale uniquement.
 */
export const filmsSearch = new Hono();

filmsSearch.get("/search", (c) => {
  const q = c.req.query("q") ?? "";
  return c.json({ films: searchFilms(q) });
});
