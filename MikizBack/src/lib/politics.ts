/**
 * Game logic for Mikiz Politics — comparison-based politician guessing game.
 */

import rawData from "../data/politics.json";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Condamnation = {
  affaire: string | null;
  date: number | null;
  prison: string | null;
  amende: string | null;
  ineligibilite: string | null;
};

export type Politician = {
  index: number;
  prenom: string;
  nom: string;
  politiscore: number | null;
  mandats: Array<{
    code_fonction: string;
    groupe?: string;
    departementNom?: string;
    scoreParticipation?: number;
    scoreParticipationSpecialite?: number;
    scoreLoyaute?: number;
    date_fin_fonction?: string | null;
  }>;
  partis: string[] | null;
  currentOrLastParti: string | null;
  originRegion: string | null;
  naissance: string | null;
  deces?: string | null;
  genre: string | null;
  condamnation: Condamnation[] | null;
  popularityScore: number;
};

export type MandatType =
  | "Président de la République"
  | "Premier ministre"
  | "Ministre"
  | "Député"
  | "Eurodéputé"
  | "Sénateur"
  | "Chef de parti";

export type OrientationLabel =
  | "gauche"
  | "centre-gauche"
  | "centre"
  | "droite"
  | "extrême droite";

export type MatchResult = "exact" | "wrong";

export type Comparison = {
  genre: { value: string | null; match: MatchResult };
  originRegion: { value: string | null; match: MatchResult };
  currentOrLastParti: { value: string | null; match: MatchResult | "meme-famille" };
  fonctionActuelle: {
    value: MandatType[];
    matching: MandatType[];
  };
  anciennesFonctions: {
    value: MandatType[];
    matching: MandatType[];
  };
  naissance: {
    value: string | null;
    deces: string | null;
    direction: "exact" | "plus-age" | "plus-jeune";
    proche: boolean;
  };
  orientation: {
    value: OrientationLabel;
    score: number;
    match: MatchResult;
    direction?: "plus-gauche" | "plus-droite";
  };
  condamnation: {
    condamne: boolean;
    match: MatchResult;
    affaires?: Array<{
      affaire: string | null;
      prison: string | null;
      amende: string | null;
      date: number | null;
    }>;
  };
};

export type DeputeInfo = {
  scoreParticipation: number | null;
  scoreParticipationSpecialite: number | null;
  scoreLoyaute: number | null;
  groupe: string | undefined;
  departementNom: string | undefined;
};

export type Tentative = {
  politicianIndex: number;
  politicien: { prenom: string; nom: string };
  comparison: Comparison;
  deputeInfo?: DeputeInfo;
  mepInfo?: DeputeInfo | null;
};

// ─── Data loading ─────────────────────────────────────────────────────────────

const ALL_POLITICIANS: Politician[] = (rawData as { membres: unknown[] }).membres.map(
  (m: unknown, i: number) => ({ ...(m as object), index: i }) as Politician,
);

const GUESSABLE: Politician[] = ALL_POLITICIANS.filter(
  (p) => p.naissance && p.genre && p.currentOrLastParti && p.politiscore !== null,
);

export function getPolitician(index: number): Politician | null {
  return ALL_POLITICIANS[index] ?? null;
}

export function getGuessablePool(): Politician[] {
  return GUESSABLE;
}

export function searchPoliticians(q: string): Politician[] {
  // biome-ignore lint/suspicious/noMisleadingCharacterClass: NFD decomposition range
  const diacritics = /[\u0300-\u036f]/g;
  const norm = q.normalize("NFD").replace(diacritics, "").toLowerCase().trim();
  if (norm.length < 2) return [];
  return GUESSABLE.filter((p) => {
    const full = `${p.prenom} ${p.nom}`.normalize("NFD").replace(diacritics, "").toLowerCase();
    return full.includes(norm);
  }).slice(0, 20);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function birthYear(p: Politician): number | null {
  if (!p.naissance) return null;
  return Number(p.naissance.slice(0, 4));
}

function currentFonctions(p: Politician): MandatType[] {
  // PR, PM, Ministre are constitutionally exclusive — short-circuit if present
  // DEP, ED, SEN, CP can coexist simultaneously
  const activeCodes = new Set(
    p.mandats
      .filter((m) => !("date_fin_fonction" in m) || m.date_fin_fonction === null)
      .map((m) => m.code_fonction),
  );
  if (activeCodes.has("PR")) return ["Président de la République"];
  if (activeCodes.has("PM") || activeCodes.has("PE")) return ["Premier ministre"];
  if (["ME", "M", "MD", "MC", "SE"].some((c) => activeCodes.has(c))) return ["Ministre"];
  const result: MandatType[] = [];
  if (activeCodes.has("DEP")) result.push("Député");
  if (activeCodes.has("ED")) result.push("Eurodéputé");
  if (activeCodes.has("SEN")) result.push("Sénateur");
  if (activeCodes.has("CP")) result.push("Chef de parti");
  if (result.length === 0) return ["Député"]; // fallback for legacy entries
  return result;
}

function pastFonctions(p: Politician, currents: MandatType[]): MandatType[] {
  const allCodes = new Set(p.mandats.map((m) => m.code_fonction));
  const result: MandatType[] = [];
  if (!currents.includes("Président de la République") && allCodes.has("PR"))
    result.push("Président de la République");
  if (!currents.includes("Premier ministre") && (allCodes.has("PM") || allCodes.has("PE")))
    result.push("Premier ministre");
  if (
    !currents.includes("Ministre") &&
    ["ME", "M", "MD", "MC", "SE"].some((c) => allCodes.has(c))
  )
    result.push("Ministre");
  if (!currents.includes("Député") && allCodes.has("DEP")) result.push("Député");
  if (!currents.includes("Eurodéputé") && allCodes.has("ED")) result.push("Eurodéputé");
  if (!currents.includes("Sénateur") && allCodes.has("SEN")) result.push("Sénateur");
  if (!currents.includes("Chef de parti") && allCodes.has("CP")) result.push("Chef de parti");
  return result;
}

export function getDeputeInfo(p: Politician): DeputeInfo | undefined {
  const dep = p.mandats.find((m) => m.code_fonction === "DEP");
  if (!dep) return undefined;
  return {
    scoreParticipation: dep.scoreParticipation ?? null,
    scoreParticipationSpecialite: dep.scoreParticipationSpecialite ?? null,
    scoreLoyaute: dep.scoreLoyaute ?? null,
    groupe: dep.groupe,
    departementNom: dep.departementNom,
  };
}

export function getMEPInfo(p: Politician): DeputeInfo | undefined {
  const mep = p.mandats.find((m) => m.code_fonction === "ED" && m.date_fin_fonction === null);
  if (!mep) return undefined;
  return {
    scoreParticipation: mep.scoreParticipation ?? null,
    scoreParticipationSpecialite: null,
    scoreLoyaute: mep.scoreLoyaute ?? null,
    groupe: mep.groupe,
    departementNom: undefined,
  };
}

function orientation(score: number): OrientationLabel {
  if (score <= 25) return "gauche";
  if (score <= 44) return "centre-gauche";
  if (score <= 55) return "centre";
  if (score <= 70) return "droite";
  return "extrême droite";
}

const ORIENTATION_ORDER: OrientationLabel[] = [
  "gauche",
  "centre-gauche",
  "centre",
  "droite",
  "extrême droite",
];

// ─── Comparison ───────────────────────────────────────────────────────────────

export function comparePoliticians(guess: Politician, target: Politician): Comparison {
  // Genre
  const genre: Comparison["genre"] = {
    value: guess.genre,
    match: guess.genre === target.genre ? "exact" : "wrong",
  };

  // Region
  const originRegion: Comparison["originRegion"] = {
    value: guess.originRegion,
    match: guess.originRegion && target.originRegion && guess.originRegion === target.originRegion
      ? "exact"
      : "wrong",
  };

  // Party
  const guessOrientation = orientation(guess.politiscore ?? 50);
  const targetOrientation = orientation(target.politiscore ?? 50);
  const sameParti = guess.currentOrLastParti === target.currentOrLastParti;
  const sameFamille = !sameParti && guessOrientation === targetOrientation;
  const currentOrLastParti: Comparison["currentOrLastParti"] = {
    value: guess.currentOrLastParti,
    match: sameParti ? "exact" : sameFamille ? "meme-famille" : "wrong",
  };

  // Fonctions actuelles (can be multiple) + anciennes fonctions
  const gCurrents = currentFonctions(guess);
  const tCurrents = currentFonctions(target);
  const gPast = pastFonctions(guess, gCurrents);
  const tPast = pastFonctions(target, tCurrents);
  const fonctionActuelleResult: Comparison["fonctionActuelle"] = {
    value: gCurrents,
    matching: gCurrents.filter((f) => tCurrents.includes(f)),
  };
  const anciennesFonctionsResult: Comparison["anciennesFonctions"] = {
    value: gPast,
    matching: gPast.filter((f) => tPast.includes(f)),
  };

  // Naissance
  const gYear = birthYear(guess);
  const tYear = birthYear(target);
  let naissanceDir: Comparison["naissance"]["direction"] = "exact";
  let proche = false;
  if (gYear !== null && tYear !== null) {
    if (gYear > tYear) naissanceDir = "plus-age";        // guess younger, target is older
    else if (gYear < tYear) naissanceDir = "plus-jeune"; // guess older, target is younger
    proche = Math.abs(gYear - tYear) <= 5;
  }
  const naissance: Comparison["naissance"] = {
    value: guess.naissance,
    deces: guess.deces ?? null,
    direction: naissanceDir,
    proche,
  };

  // Orientation — direction is score-based so the frontend can narrow with exact precision
  const gScore = guess.politiscore ?? 50;
  const tScore = target.politiscore ?? 50;
  const orientationResult: Comparison["orientation"] = {
    value: guessOrientation,
    score: gScore,
    match: guessOrientation === targetOrientation ? "exact" : "wrong",
    direction: gScore > tScore ? "plus-gauche" : gScore < tScore ? "plus-droite" : undefined,
  };

  // Condamnation
  const guessCondamne = Array.isArray(guess.condamnation) && guess.condamnation.length > 0;
  const targetCondamne = Array.isArray(target.condamnation) && target.condamnation.length > 0;
  const condamnationMatch: MatchResult = guessCondamne === targetCondamne ? "exact" : "wrong";

  const affaires = guessCondamne
    ? (guess.condamnation ?? []).map((c) => ({
        affaire: c.affaire,
        prison: c.prison,
        amende: c.amende,
        date: c.date,
      }))
    : undefined;

  const condamnation: Comparison["condamnation"] = {
    condamne: guessCondamne,
    match: condamnationMatch,
    affaires,
  };

  return {
    genre,
    originRegion,
    currentOrLastParti,
    fonctionActuelle: fonctionActuelleResult,
    anciennesFonctions: anciennesFonctionsResult,
    naissance,
    orientation: orientationResult,
    condamnation,
  };
}
