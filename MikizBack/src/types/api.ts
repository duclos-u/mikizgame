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

// ─── CinéClue ─────────────────────────────────────────────────────────────────

export type CineclueActeur = { nom: string; photo: string | null };
export type CineclueReal = { nom: string; photo: string | null };

export type CineclueFilm = {
  id: number;
  titre: string;
  annee: number;
  duree: number;
  genres: string[];
  pays: string[];
  langue: string;
  realisateurs: CineclueReal[];
  acteurs: CineclueActeur[];
  recompenses: string[];
};

export type CineclueIndices = {
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

export type CineclueStatut = "in_progress" | "won" | "lost";

export type CineclueTotaux = {
  genres: number;
  pays: number;
  acteurs: number;
};

export type CineclueTentative = {
  tmdbId: number;
  filmSoumis: CineclueFilm;
  anneeProche?: boolean;
  dureeProche?: boolean;
};

export type CineclueSession = {
  statut: CineclueStatut;
  tentatives: CineclueTentative[];
  indices: CineclueIndices;
  tentativesRestantes: number;
  filmCible: CineclueFilm | null;
};

export type CineclueGuessResponse = {
  correct: boolean;
  filmSoumis: CineclueFilm;
  anneeProche: boolean;
  dureeProche: boolean;
  indicesReveles: CineclueIndices;
  tentativesRestantes: number;
  statut: CineclueStatut;
  filmCible: CineclueFilm | null;
  totalIndices: CineclueTotaux;
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
