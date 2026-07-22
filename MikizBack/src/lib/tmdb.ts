import type { Film } from "./cinemaxd";
import { todayDate } from "./date";

const BASE = "https://api.themoviedb.org/3";
const cache = new Map<number, Film>();
let cacheDate = todayDate();

function getCache(id: number): Film | undefined {
  const today = todayDate();
  if (today !== cacheDate) {
    cache.clear();
    cacheDate = today;
  }
  return cache.get(id);
}

type TmdbDetails = {
  id: number;
  title: string;
  release_date: string;
  runtime: number | null;
  genres: { name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  original_language: string;
};

type TmdbCredits = {
  cast: { name: string; profile_path: string | null; order: number }[];
  crew: { name: string; job: string; profile_path: string | null }[];
};

export type TmdbSearchResult = {
  tmdbId: number;
  titre: string;
  annee: number | null;
  poster: string | null;
};

const SEARCH_CACHE_TTL_MS = 90_000;
const SEARCH_CACHE_MAX_SIZE = 200;
const searchCache = new Map<string, { results: TmdbSearchResult[]; expiresAt: number }>();

function pruneSearchCache() {
  const now = Date.now();
  for (const [key, entry] of searchCache) {
    if (entry.expiresAt <= now) searchCache.delete(key);
  }
}

export async function searchTmdbMovies(q: string): Promise<TmdbSearchResult[]> {
  const key = q.trim().toLowerCase();

  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB non configuré");

  const url = `${BASE}/search/movie?query=${encodeURIComponent(q)}&language=fr-FR&page=1&api_key=${apiKey}`;
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

  const results: TmdbSearchResult[] = data.results.slice(0, 20).map((m) => ({
    tmdbId: m.id,
    titre: m.title,
    annee: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : null,
  }));

  pruneSearchCache();
  if (searchCache.size >= SEARCH_CACHE_MAX_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
  return results;
}

export async function fetchFilmById(id: number): Promise<Film | null> {
  const cached = getCache(id);
  if (cached) return cached;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const [details, credits] = await Promise.all([
      fetch(`${BASE}/movie/${id}?language=fr-FR&api_key=${apiKey}`).then((r) =>
        r.ok ? (r.json() as Promise<TmdbDetails>) : Promise.reject(r.status),
      ),
      fetch(`${BASE}/movie/${id}/credits?language=fr-FR&api_key=${apiKey}`).then((r) =>
        r.ok ? (r.json() as Promise<TmdbCredits>) : Promise.reject(r.status),
      ),
    ]);

    const film: Film = {
      id: details.id,
      titre: details.title,
      annee: details.release_date ? Number(details.release_date.slice(0, 4)) : 0,
      duree: details.runtime ?? 0,
      genres: details.genres.map((g) => g.name),
      pays: details.production_countries.map((c) => c.iso_3166_1),
      langue: details.original_language,
      realisateurs: credits.crew
        .filter((c) => c.job === "Director")
        .map((c) => ({ nom: c.name, photo: c.profile_path ?? null })),
      acteurs: credits.cast
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ nom: c.name, photo: c.profile_path ?? null })),
      recompenses: [],
    };

    cache.set(id, film);
    return film;
  } catch (err) {
    console.error(`[tmdb] fetchFilmById(${id}):`, err);
    return null;
  }
}
