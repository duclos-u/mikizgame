/**
 * Logique métier du jeu CinéClue :
 * - Chargement + sélection déterministe du film du jour
 * - Comparaison film soumis / film cible → indices révélés
 * - Autocomplete sur la liste locale
 */

import filmsData from "../data/films-enriched.json";

export type Realisateur = { nom: string; photo: string | null };
export type Acteur = { nom: string; photo: string | null };

export type Film = {
  id: number;
  titre: string;
  annee: number;
  duree: number;
  genres: string[];
  pays: string[];
  langue: string;
  realisateurs: Realisateur[];
  acteurs: Acteur[];
  recompenses: string[];
};

export type IndicesReveles = {
  genres: string[];
  pays: string[];
  // Noms des acteurs communs révélés
  acteurs: string[];
  realisateurRevele: boolean;
  // Fourchette année : borne inférieure (dernier soumis < cible)
  anneeMin: number | null;
  // Fourchette année : borne supérieure (dernier soumis > cible)
  anneeMax: number | null;
  // Fourchette durée : borne inférieure (dernier soumis < cible)
  dureeMin: number | null;
  // Fourchette durée : borne supérieure (dernier soumis > cible)
  dureeMax: number | null;
  langue: string | null;
};

const FILMS = filmsData as Film[];
const FILMS_BY_ID = new Map<number, Film>(FILMS.map((f) => [f.id, f]));

// Hash string → entier positif (pour la sélection déterministe)
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Cache mémoire invalidé à minuit (toDateString change chaque jour)
let cache: { dateStr: string; film: Film } | null = null;

export function getFilmDuJour(): Film {
  const dateStr = new Date().toDateString();
  if (cache?.dateStr === dateStr) return cache.film;
  const index = hashCode(dateStr) % FILMS.length;
  cache = { dateStr, film: FILMS[index] };
  return cache.film;
}

export function getFilmById(id: number): Film | undefined {
  return FILMS_BY_ID.get(id);
}

export function searchFilms(query: string, limit = 10): Film[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return FILMS.filter((f) => f.titre.toLowerCase().includes(q)).slice(0, limit);
}

export function indicesVides(): IndicesReveles {
  return {
    genres: [],
    pays: [],
    acteurs: [],
    realisateurRevele: false,
    anneeMin: null,
    anneeMax: null,
    dureeMin: null,
    dureeMax: null,
    langue: null,
  };
}

/**
 * Compare le film soumis avec le film cible et retourne les nouveaux indices
 * cumulés (fusion avec les indices déjà révélés).
 */
export function compareFilms(
  soumis: Film,
  cible: Film,
  indicesCourants: IndicesReveles,
): IndicesReveles {
  // Genres communs
  const genresCommuns = soumis.genres.filter((g) => cible.genres.includes(g));
  const genres = Array.from(new Set([...indicesCourants.genres, ...genresCommuns]));

  // Pays communs
  const paysCommuns = soumis.pays.filter((p) => cible.pays.includes(p));
  const pays = Array.from(new Set([...indicesCourants.pays, ...paysCommuns]));

  // Acteurs communs (comparaison par nom)
  const nomsCible = new Set(cible.acteurs.map((a) => a.nom));
  const acteursCommuns = soumis.acteurs
    .filter((a) => nomsCible.has(a.nom))
    .map((a) => a.nom);
  const acteurs = Array.from(new Set([...indicesCourants.acteurs, ...acteursCommuns]));

  // Réalisateur : révélé si au moins un nom commun
  const realisateurRevele =
    indicesCourants.realisateurRevele ||
    soumis.realisateurs.some((r) =>
      cible.realisateurs.some((cr) => cr.nom === r.nom),
    );

  // Fourchette année : on resserre les bornes à chaque tentative
  let { anneeMin, anneeMax } = indicesCourants;
  if (soumis.annee > cible.annee) {
    // Le film soumis est plus récent → borne supérieure se resserre vers le bas
    anneeMax = anneeMax === null ? soumis.annee : Math.min(anneeMax, soumis.annee);
  } else if (soumis.annee < cible.annee) {
    // Le film soumis est plus ancien → borne inférieure se resserre vers le haut
    anneeMin = anneeMin === null ? soumis.annee : Math.max(anneeMin, soumis.annee);
  }
  // Si annee égale : les bornes ne bougent pas (la partie est gagnée ou le slot sera révélé à la fin)

  // Fourchette durée : même logique
  let { dureeMin, dureeMax } = indicesCourants;
  // On ignore les durées inconnues (= 0 dans les données non-enrichies)
  if (soumis.duree > 0 && cible.duree > 0) {
    if (soumis.duree > cible.duree) {
      dureeMax = dureeMax === null ? soumis.duree : Math.min(dureeMax, soumis.duree);
    } else if (soumis.duree < cible.duree) {
      dureeMin = dureeMin === null ? soumis.duree : Math.max(dureeMin, soumis.duree);
    }
  }

  const langue = indicesCourants.langue ?? (soumis.langue === cible.langue ? cible.langue : null);

  return { genres, pays, acteurs, realisateurRevele, anneeMin, anneeMax, dureeMin, dureeMax, langue };
}

/**
 * Indices complets révélés quand la partie se termine (gagnée ou perdue).
 * Révèle tout ce qui correspond entre le film soumis et la cible.
 */
export function indicesFinaux(cible: Film): IndicesReveles {
  return {
    genres: [...cible.genres],
    pays: [...cible.pays],
    acteurs: cible.acteurs.map((a) => a.nom),
    realisateurRevele: true,
    anneeMin: null,
    anneeMax: null,
    dureeMin: null,
    dureeMax: null,
    langue: cible.langue,
  };
}
