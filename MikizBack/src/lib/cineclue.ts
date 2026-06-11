/**
 * Logique métier du jeu CinéClue (comparaison, indices).
 * Les données film viennent de TMDB via lib/tmdb.ts.
 */

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
  acteurs: string[];
  realisateurRevele: boolean;
  anneeMin: number | null;
  anneeMax: number | null;
  dureeMin: number | null;
  dureeMax: number | null;
  langue: string | null;
};

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
  const genresCommuns = soumis.genres.filter((g) => cible.genres.includes(g));
  const genres = Array.from(new Set([...indicesCourants.genres, ...genresCommuns]));

  const paysCommuns = soumis.pays.filter((p) => cible.pays.includes(p));
  const pays = Array.from(new Set([...indicesCourants.pays, ...paysCommuns]));

  const nomsCible = new Set(cible.acteurs.map((a) => a.nom));
  const acteursCommuns = soumis.acteurs
    .filter((a) => nomsCible.has(a.nom))
    .map((a) => a.nom);
  const acteurs = Array.from(new Set([...indicesCourants.acteurs, ...acteursCommuns]));

  const realisateurRevele =
    indicesCourants.realisateurRevele ||
    soumis.realisateurs.some((r) =>
      cible.realisateurs.some((cr) => cr.nom === r.nom),
    );

  let { anneeMin, anneeMax } = indicesCourants;
  if (soumis.annee > cible.annee) {
    anneeMax = anneeMax === null ? soumis.annee : Math.min(anneeMax, soumis.annee);
  } else if (soumis.annee < cible.annee) {
    anneeMin = anneeMin === null ? soumis.annee : Math.max(anneeMin, soumis.annee);
  }

  let { dureeMin, dureeMax } = indicesCourants;
  if (soumis.duree > 0 && cible.duree > 0) {
    if (soumis.duree > cible.duree) {
      dureeMax = dureeMax === null ? soumis.duree : Math.min(dureeMax, soumis.duree);
    } else if (soumis.duree < cible.duree) {
      dureeMin = dureeMin === null ? soumis.duree : Math.max(dureeMin, soumis.duree);
    }
  }

  const langue =
    indicesCourants.langue ?? (soumis.langue === cible.langue ? cible.langue : null);

  return {
    genres,
    pays,
    acteurs,
    realisateurRevele,
    anneeMin,
    anneeMax,
    dureeMin,
    dureeMax,
    langue,
  };
}

/**
 * Indices complets révélés quand la partie se termine (gagnée ou perdue).
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
