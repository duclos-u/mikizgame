/**
 * Game logic for Footix — comparison-based footballer guessing game.
 */

import rawData from "../data/footballers.json";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Confederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";
export type Poste = "Gardien" | "Défenseur" | "Milieu" | "Attaquant";
export type MatchResult = "exact" | "proche" | "wrong";

export type Footballer = {
  index: number;
  prenom: string;
  nom: string;
  nationalite: string;
  confederation: Confederation;
  poste: Poste;
  club: string;
  ligue: string;
  naissance: number;
  popularityScore: number;
};

export type FootixComparison = {
  nationalite: {
    value: string;
    confederation: Confederation;
    match: "exact" | "meme-confederation" | "wrong";
  };
  poste: {
    value: Poste;
    match: "exact" | "wrong";
  };
  naissance: {
    value: number;
    direction: "exact" | "plus-vieux" | "plus-jeune";
    proche: boolean;
  };
  club: {
    value: string;
    ligue: string;
    match: "exact" | "meme-ligue" | "wrong";
  };
};

export type FootixTentative = {
  footballerIndex: number;
  footballer: { prenom: string; nom: string };
  comparison: FootixComparison;
};

// ─── Data loading ─────────────────────────────────────────────────────────────

const ALL_FOOTBALLERS: Footballer[] = (rawData as { joueurs: unknown[] }).joueurs.map(
  (j: unknown, i: number) => ({ ...(j as object), index: i }) as Footballer,
);

export function getFootballer(index: number): Footballer | null {
  return ALL_FOOTBALLERS[index] ?? null;
}

export function getAllFootballers(): Footballer[] {
  return ALL_FOOTBALLERS;
}

const DIACRITICS = /[̀-ͯ]/g;

const NORMALIZED = ALL_FOOTBALLERS.map((f) => ({
  f,
  normalized: `${f.prenom} ${f.nom}`.normalize("NFD").replace(DIACRITICS, "").toLowerCase(),
}));

export function searchFootballers(q: string): Footballer[] {
  const norm = q.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim();
  if (norm.length < 2) return [];
  return NORMALIZED.filter(({ normalized }) => normalized.includes(norm))
    .map(({ f }) => f)
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 20);
}

// ─── Comparison ───────────────────────────────────────────────────────────────

export function compareFootballers(guess: Footballer, target: Footballer): FootixComparison {
  // Nationality
  const nationaliteMatch =
    guess.nationalite === target.nationalite
      ? "exact"
      : guess.confederation === target.confederation
        ? "meme-confederation"
        : "wrong";

  // Position
  const posteMatch: "exact" | "wrong" = guess.poste === target.poste ? "exact" : "wrong";

  // Birth year
  const gYear = guess.naissance;
  const tYear = target.naissance;
  let direction: FootixComparison["naissance"]["direction"] = "exact";
  if (gYear < tYear) direction = "plus-jeune";
  else if (gYear > tYear) direction = "plus-vieux";
  const proche = direction !== "exact" && Math.abs(gYear - tYear) <= 3;

  // Club
  const clubMatch: "exact" | "meme-ligue" | "wrong" =
    guess.club === target.club ? "exact" : guess.ligue === target.ligue ? "meme-ligue" : "wrong";

  return {
    nationalite: {
      value: guess.nationalite,
      confederation: guess.confederation,
      match: nationaliteMatch,
    },
    poste: {
      value: guess.poste,
      match: posteMatch,
    },
    naissance: {
      value: gYear,
      direction,
      proche,
    },
    club: {
      value: guess.club,
      ligue: guess.ligue,
      match: clubMatch,
    },
  };
}
