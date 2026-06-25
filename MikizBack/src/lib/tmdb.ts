import type { Film } from "./cinemaxd";

const BASE = "https://api.themoviedb.org/3";
const cache = new Map<number, Film>();

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

export async function fetchFilmById(id: number): Promise<Film | null> {
  if (cache.has(id)) return cache.get(id)!;

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
