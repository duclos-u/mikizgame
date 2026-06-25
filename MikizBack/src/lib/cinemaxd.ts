/**
 * Logique métier du jeu Cinemaxd (comparaison, indices).
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
  realisateurInfo: Realisateur | null;
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
    realisateurInfo: null,
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
  const acteursCommuns = soumis.acteurs.filter((a) => nomsCible.has(a.nom)).map((a) => a.nom);
  const acteurs = Array.from(new Set([...indicesCourants.acteurs, ...acteursCommuns]));

  const directorMatched =
    !indicesCourants.realisateurRevele &&
    soumis.realisateurs.some((r) => cible.realisateurs.some((cr) => cr.nom === r.nom));
  const realisateurRevele = indicesCourants.realisateurRevele || directorMatched;
  const realisateurInfo =
    indicesCourants.realisateurInfo ?? (directorMatched ? (cible.realisateurs[0] ?? null) : null);

  let { anneeMin, anneeMax } = indicesCourants;
  if (soumis.annee > cible.annee) {
    anneeMax = anneeMax === null ? soumis.annee : Math.min(anneeMax, soumis.annee);
  } else if (soumis.annee < cible.annee) {
    anneeMin = anneeMin === null ? soumis.annee : Math.max(anneeMin, soumis.annee);
  } else {
    // same year: pin both bounds so SlotDate detects the unique year (anneeMax - anneeMin === 2)
    anneeMin = anneeMin === null ? soumis.annee - 1 : Math.max(anneeMin, soumis.annee - 1);
    anneeMax = anneeMax === null ? soumis.annee + 1 : Math.min(anneeMax, soumis.annee + 1);
  }

  let { dureeMin, dureeMax } = indicesCourants;
  if (soumis.duree > 0 && cible.duree > 0) {
    if (soumis.duree > cible.duree) {
      dureeMax = dureeMax === null ? soumis.duree : Math.min(dureeMax, soumis.duree);
    } else if (soumis.duree < cible.duree) {
      dureeMin = dureeMin === null ? soumis.duree : Math.max(dureeMin, soumis.duree);
    } else {
      // same duration: pin both bounds so SlotDuree detects the unique value (dureeMax - dureeMin === 2)
      dureeMin = dureeMin === null ? soumis.duree - 1 : Math.max(dureeMin, soumis.duree - 1);
      dureeMax = dureeMax === null ? soumis.duree + 1 : Math.min(dureeMax, soumis.duree + 1);
    }
  }

  const langue = indicesCourants.langue ?? (soumis.langue === cible.langue ? cible.langue : null);

  return {
    genres,
    pays,
    acteurs,
    realisateurRevele,
    realisateurInfo,
    anneeMin,
    anneeMax,
    dureeMin,
    dureeMax,
    langue,
  };
}

/**
 * Garantit des révélations progressives indépendamment des correspondances :
 * - ≥3 tentatives : langue révélée
 * - ≥5 tentatives : au moins un genre révélé
 * - ≥7 tentatives : réalisateur révélé
 */
export function applyTimeGatedClues(
  indices: IndicesReveles,
  cible: Film,
  attemptCount: number,
): IndicesReveles {
  const updated = { ...indices };

  if (attemptCount >= 3 && updated.langue === null) {
    updated.langue = cible.langue;
  }

  if (attemptCount >= 5 && updated.genres.length === 0 && cible.genres.length > 0) {
    updated.genres = [cible.genres[0]];
  }

  if (attemptCount >= 7 && !updated.realisateurRevele) {
    updated.realisateurRevele = true;
    updated.realisateurInfo = cible.realisateurs[0] ?? null;
  }

  return updated;
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
    realisateurInfo: cible.realisateurs[0] ?? null,
    anneeMin: null,
    anneeMax: null,
    dureeMin: null,
    dureeMax: null,
    langue: cible.langue,
  };
}
