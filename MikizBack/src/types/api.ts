// Canonical API response types — source of truth for both backend and frontend.
// Frontend copy lives at MikizGame/src/api/shared-types.ts (synced via prebuild script).

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type User = { id: string; username: string; email: string; streak: number };
export type AuthResponse = { user: User; token: string };

// ─── Motivex ──────────────────────────────────────────────────────────────────

export type TileResult = "correct" | "present" | "absent";
export type GuessResult = { guess: string; result: TileResult[] };

export type MotivexSession = {
  status: "in_progress" | "won" | "lost";
  attempts: GuessResult[];
  wordLength: number;
  firstLetter: string;
  word?: string;
};

export type GuessResponse = {
  result: GuessResult;
  status: "in_progress" | "won" | "lost";
  attemptsLeft: number;
  word?: string;
};

export type DailyInfo = {
  date: string;
  wordLength: number;
  firstLetter: string;
};

// ─── Cinemaxd ─────────────────────────────────────────────────────────────────

export type CinemaxdActeur = { nom: string; photo: string | null };
export type CinemaxdReal = { nom: string; photo: string | null };

export type CinemaxdFilm = {
  id: number;
  titre: string;
  annee: number;
  duree: number;
  genres: string[];
  pays: string[];
  langue: string;
  realisateurs: CinemaxdReal[];
  acteurs: CinemaxdActeur[];
  recompenses: string[];
};

export type CinemaxdIndices = {
  genres: string[];
  pays: string[];
  acteurs: string[];
  realisateurRevele: boolean;
  realisateurInfo?: { nom: string; photo: string | null } | null;
  anneeMin: number | null;
  anneeMax: number | null;
  dureeMin: number | null;
  dureeMax: number | null;
  langue: string | null;
};

export type CinemaxdStatut = "in_progress" | "won" | "lost";

export type CinemaxdTotaux = {
  genres: number;
  pays: number;
  acteurs: number;
};

export type CinemaxdTentative = {
  tmdbId: number;
  filmSoumis: CinemaxdFilm;
  anneeProche?: boolean;
  dureeProche?: boolean;
};

export type CinemaxdSession = {
  statut: CinemaxdStatut;
  tentatives: CinemaxdTentative[];
  indices: CinemaxdIndices;
  tentativesRestantes: number;
  filmCible: CinemaxdFilm | null;
};

export type CinemaxdGuessResponse = {
  correct: boolean;
  filmSoumis: CinemaxdFilm;
  anneeProche: boolean;
  dureeProche: boolean;
  indicesReveles: CinemaxdIndices;
  tentativesRestantes: number;
  statut: CinemaxdStatut;
  filmCible: CinemaxdFilm | null;
  totalIndices: CinemaxdTotaux;
  pityCluesRevealed: string[];
};

export type TmdbFilmResult = {
  tmdbId: number;
  titre: string;
  annee: number | null;
  poster: string | null;
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  username: string;
  score: number | null;
  points: number;
  completedAt: string;
};

export type LeaderboardResponse = {
  date: string;
  game: string;
  total: number;
  entries: LeaderboardEntry[];
};

export type AllTimeEntry = {
  username: string;
  wins: number;
  avgAttempts: number | null;
  totalPoints: number;
};

export type AllTimeResponse = {
  game: string;
  total: number;
  entries: AllTimeEntry[];
};

export type DailyCountsResponse = {
  date: string;
  counts: Record<string, number>;
  avgTries: Record<string, number | null>;
};

export type CrossGameBreakdown = {
  rank: number;
  score: number | null;
  points: number;
};

export type CrossGameEntry = {
  username: string;
  total: number;
  breakdown: Record<string, CrossGameBreakdown>;
};

export type CrossLeaderboardResponse = {
  date: string;
  games: string[];
  entries: CrossGameEntry[];
};

export type CrossAllTimeBreakdown = { points: number };

export type CrossAllTimeEntry = {
  username: string;
  total: number;
  breakdown: Record<string, CrossAllTimeBreakdown>;
};

export type CrossAllTimeResponse = { games: string[]; entries: CrossAllTimeEntry[] };
