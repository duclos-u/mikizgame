import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { cineclueDaily, cineclueSessions, games, leaderboardEntries } from "../db/schema";
import {
  applyTimeGatedClues,
  compareFilms,
  indicesFinaux,
  indicesVides,
  type Film,
  type IndicesReveles,
} from "../lib/cineclue";
import { todayDate } from "../lib/date";
import { fetchFilmById } from "../lib/tmdb";
import { authMiddleware } from "../middleware/auth";

const MAX_TENTATIVES = 10;

// ─── Film du jour ─────────────────────────────────────────────────────────────

let dailyCache: { dateStr: string; film: Film } | null = null;

async function getDailyFilm(): Promise<Film | null> {
  const dateStr = todayDate();
  if (dailyCache?.dateStr === dateStr) return dailyCache.film;

  const row = await db.query.cineclueDaily.findFirst({
    where: eq(cineclueDaily.date, dateStr),
  });
  if (!row) return null;

  const film = await fetchFilmById(row.tmdbId);
  if (film) dailyCache = { dateStr, film };
  return film;
}

// ─── Game ID helper ───────────────────────────────────────────────────────────

let cineclueGameId: string | null = null;
async function getCineclueGameId(): Promise<string | null> {
  if (cineclueGameId) return cineclueGameId;
  const game = await db.query.games.findFirst({ where: eq(games.slug, "cineclue") });
  if (game) cineclueGameId = game.id;
  return cineclueGameId;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const filmdujour = new Hono();

/**
 * GET /api/filmdujour/session
 * Protégé. Retourne l'état courant de la partie du joueur pour aujourd'hui.
 */
filmdujour.get("/session", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const today = todayDate();

  const cible = await getDailyFilm();
  if (!cible) return c.json({ error: "Film du jour non configuré" }, 503);

  const session = await db.query.cineclueSessions.findFirst({
    where: and(
      eq(cineclueSessions.userId, userId),
      eq(cineclueSessions.date, today),
    ),
  });

  const totalIndices = {
    genres: cible.genres.length,
    pays: cible.pays.length,
    acteurs: cible.acteurs.length,
  };

  if (!session) return c.json({ session: null, totalIndices });

  return c.json({
    session: {
      statut: session.status,
      tentatives: session.tentatives,
      indices: session.indices,
      tentativesRestantes:
        MAX_TENTATIVES - (session.tentatives as unknown[]).length,
      filmCible: session.status !== "in_progress" ? cible : null,
    },
    totalIndices,
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

  const [filmSoumis, cible] = await Promise.all([
    fetchFilmById(body.tmdbId),
    getDailyFilm(),
  ]);

  if (!filmSoumis) return c.json({ error: "Film introuvable" }, 404);
  if (!cible) return c.json({ error: "Film du jour non configuré" }, 503);

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

  const nouvelleTentative = {
    tmdbId: filmSoumis.id,
    filmSoumis: filmSoumis satisfies Film,
    anneeProche: Math.abs(filmSoumis.annee - cible.annee) <= 5,
    dureeProche: cible.duree > 0 && filmSoumis.duree > 0 && Math.abs(filmSoumis.duree - cible.duree) <= 15,
  };

  const nouvellesTentatives = [...tentativesPrev, nouvelleTentative];

  const afterCompare = compareFilms(filmSoumis, cible, indicesCourants);
  const afterPity = applyTimeGatedClues(afterCompare, cible, nouvellesTentatives.length);

  const pityCluesRevealed: string[] = [];
  if (afterPity.langue !== null && afterCompare.langue === null) pityCluesRevealed.push("langue");
  if (afterPity.genres.length > afterCompare.genres.length) pityCluesRevealed.push("genre");
  if (afterPity.realisateurRevele && !afterCompare.realisateurRevele)
    pityCluesRevealed.push("realisateur");

  const nouveauxIndices: IndicesReveles = correct ? indicesFinaux(cible) : afterPity;
  const estPerdu = !correct && nouvellesTentatives.length >= MAX_TENTATIVES;
  const nouveauStatut: "in_progress" | "won" | "lost" = correct
    ? "won"
    : estPerdu
      ? "lost"
      : "in_progress";
  const completedAt = nouveauStatut !== "in_progress" ? new Date() : null;

  if (!session) {
    await db.insert(cineclueSessions).values({
      userId,
      date: today,
      tentatives: nouvellesTentatives,
      indices: nouveauxIndices,
      status: nouveauStatut,
      completedAt,
    });
  } else {
    await db
      .update(cineclueSessions)
      .set({
        tentatives: nouvellesTentatives,
        indices: nouveauxIndices,
        status: nouveauStatut,
        completedAt,
      })
      .where(eq(cineclueSessions.id, session.id));
  }

  if (nouveauStatut !== "in_progress") {
    const gameId = await getCineclueGameId();
    if (gameId) {
      await db.insert(leaderboardEntries).values({
        userId,
        gameId,
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
    totalIndices: {
      genres: cible.genres.length,
      pays: cible.pays.length,
      acteurs: cible.acteurs.length,
    },
    pityCluesRevealed,
  });
});

/**
 * POST /api/filmdujour/daily
 * Dev uniquement. Définit le film du jour. Body : { tmdbId: number; date?: string }
 */
filmdujour.post("/daily", async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Indisponible en production" }, 403);
  }

  const { tmdbId, date } = await c.req.json<{ tmdbId: number; date?: string }>();
  if (!tmdbId) return c.json({ error: "tmdbId requis" }, 400);

  const targetDate = date ?? todayDate();

  const film = await fetchFilmById(tmdbId);
  if (!film) return c.json({ error: "Film TMDB introuvable" }, 404);

  await db
    .insert(cineclueDaily)
    .values({ date: targetDate, tmdbId })
    .onConflictDoUpdate({ target: cineclueDaily.date, set: { tmdbId } });

  dailyCache = null;
  return c.json({ ok: true, film });
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

  const gameId = await getCineclueGameId();
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

export { filmdujour };

// ─── Route search TMDB ────────────────────────────────────────────────────────

/**
 * GET /api/cineclue/search?q=...
 * Public. Autocomplete via l'API TMDB (min 3 caractères, max 20 résultats).
 */
export const cineclueSearch = new Hono();

cineclueSearch.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  if (q.length < 3) {
    return c.json({ error: "q doit faire au moins 3 caractères" }, 400);
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return c.json({ error: "TMDB non configuré" }, 502);

  try {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&language=fr-FR&page=1&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);

    const data = (await res.json()) as {
      results: Array<{
        id: number;
        title: string;
        release_date: string;
        poster_path: string | null;
      }>;
    };

    const films = data.results.slice(0, 20).map((m) => ({
      tmdbId: m.id,
      titre: m.title,
      annee: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w92${m.poster_path}`
        : null,
    }));

    return c.json(films);
  } catch (err) {
    console.error("[cineclue/search] TMDB error:", err);
    return c.json({ error: "Erreur TMDB" }, 502);
  }
});
