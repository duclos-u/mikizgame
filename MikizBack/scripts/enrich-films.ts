/**
 * Script one-shot d'enrichissement des films via l'API TMDB.
 * Usage : bun run scripts/enrich-films.ts
 * Requiert TMDB_API_KEY dans l'environnement (ou .env).
 *
 * Lit src/data/films-enriched.json, complète les champs manquants (annee, duree, photos)
 * en appelant TMDB, et réécrit le fichier.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) {
  console.error("❌ TMDB_API_KEY manquante dans l'environnement");
  process.exit(1);
}

const BASE = "https://api.themoviedb.org/3";
const LANG = "language=fr-FR";
const DATA_PATH = join(import.meta.dir, "../src/data/films-enriched.json");

type FilmRaw = {
  id: number;
  titre: string;
  annee: number;
  duree: number;
  genres: string[];
  pays: string[];
  langue: string;
  realisateurs: { nom: string; photo: string | null }[];
  acteurs: { nom: string; photo: string | null }[];
  recompenses: string[];
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichFilm(film: FilmRaw): Promise<FilmRaw> {
  // Film déjà enrichi si annee > 1000 et duree > 0 et au moins une photo d'acteur
  const dejàEnrichi =
    film.annee > 1000 &&
    film.duree > 0 &&
    film.acteurs.some((a) => a.photo !== null);
  if (dejàEnrichi) return film;

  try {
    const [details, credits] = await Promise.all([
      fetchJson(`${BASE}/movie/${film.id}?api_key=${API_KEY}&${LANG}`) as Promise<{
        release_date?: string;
        runtime?: number;
      }>,
      fetchJson(`${BASE}/movie/${film.id}/credits?api_key=${API_KEY}&${LANG}`) as Promise<{
        cast?: { name: string; profile_path: string | null; order: number }[];
        crew?: { name: string; job: string; profile_path: string | null }[];
      }>,
    ]);

    // Année exacte
    const annee = details.release_date ? Number(details.release_date.slice(0, 4)) : film.annee;

    // Durée en minutes
    const duree = details.runtime ?? film.duree;

    // Réalisateurs avec photo (depuis credits)
    const realisateursTMDB = (credits.crew ?? [])
      .filter((c) => c.job === "Director")
      .map((c) => ({ nom: c.name, photo: c.profile_path ?? null }));

    // Croiser avec nos réalisateurs connus (pour garder les noms FR si différents)
    const realisateurs = film.realisateurs.map((r) => {
      const match = realisateursTMDB.find(
        (d) => d.nom.toLowerCase() === r.nom.toLowerCase(),
      );
      return match ?? r;
    });
    // Ajouter ceux non présents dans notre liste
    if (realisateurs.length === 0 && realisateursTMDB.length > 0) {
      realisateurs.push(...realisateursTMDB.slice(0, 2));
    }

    // Acteurs avec photo (les 8 premiers du casting)
    const castTMDB = (credits.cast ?? [])
      .sort((a, b) => a.order - b.order)
      .slice(0, 8);

    const acteurs = film.acteurs.map((a) => {
      const match = castTMDB.find(
        (c) => c.name.toLowerCase() === a.nom.toLowerCase(),
      );
      return match ? { nom: a.nom, photo: match.profile_path ?? null } : a;
    });

    return { ...film, annee, duree, realisateurs, acteurs };
  } catch (err) {
    console.warn(`  ⚠️  ${film.titre} (${film.id}) — ${(err as Error).message}`);
    return film;
  }
}

async function main() {
  const films: FilmRaw[] = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  console.log(`📽️  ${films.length} films à enrichir…`);

  const enrichis: FilmRaw[] = [];
  let done = 0;

  for (const film of films) {
    const enrichi = await enrichFilm(film);
    enrichis.push(enrichi);
    done++;
    // Pause pour respecter le rate-limit TMDB (40 req/10s)
    if (done % 20 === 0) {
      console.log(`  ${done}/${films.length}`);
      await sleep(500);
    }
  }

  writeFileSync(DATA_PATH, JSON.stringify(enrichis, null, 2));
  console.log(`✅  Terminé — ${enrichis.length} films enrichis`);
}

main();
