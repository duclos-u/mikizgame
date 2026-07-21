// Canonical API response types — source of truth for both backend and frontend.
// Frontend copy lives at MikizGame/src/api/shared-types.ts (synced via prebuild script).

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  username: string;
  email: string;
  streak: number;
  longestStreak: number;
  isAdmin: boolean;
};
export type AuthResponse = { user: User; token: string };

// ─── Profile ──────────────────────────────────────────────────────────────────

export type ProfileHistoryEntry = { date: string; game: string; score: number | null };

export type ProfileGameRank = { rank: number; totalPlayers: number; percentile: number };

export type ProfileGameStats = {
  game: string;
  name: string;
  played: number;
  wins: number;
  avgAttempts: number | null;
  // Win counts keyed by attempt count, e.g. { 1: 2, 2: 5 }. Object keys are strings over JSON.
  distribution: Record<number, number>;
  losses: number;
  rank: ProfileGameRank | null;
};

export type ProfileSummaryResponse = {
  memberSince: string;
  history: ProfileHistoryEntry[];
  games: ProfileGameStats[];
  crossRank: ProfileGameRank | null;
};

export type UpdateUsernameResponse = { user: User; token: string };

// ─── Streak ───────────────────────────────────────────────────────────────────

export type StreakDay = { date: string; played: boolean };
export type StreakHistoryResponse = { days: StreakDay[] };

export type StreakMilestoneEntry = {
  milestone: number;
  achievedAt: string;
  shownAt: string | null;
};
export type StreakMilestonesResponse = { achieved: StreakMilestoneEntry[]; next: number | null };

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
  streakMilestone?: number;
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
  streakMilestone?: number;
};

export type TmdbFilmResult = {
  tmdbId: number;
  titre: string;
  annee: number | null;
  poster: string | null;
};

// ─── Footix ───────────────────────────────────────────────────────────────────

export type FootixConfederation = "UEFA" | "CONMEBOL" | "CONCACAF" | "CAF" | "AFC" | "OFC";
export type FootixPoste = "Gardien" | "Défenseur" | "Milieu" | "Attaquant";
export type FootixMatchResult = "exact" | "proche" | "wrong";
export type FootixStatus = "in_progress" | "won" | "lost";

export type FootixComparison = {
  nationalite: {
    value: string;
    confederation: FootixConfederation;
    match: "exact" | "meme-confederation" | "wrong";
  };
  poste: {
    value: FootixPoste;
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

export type FootixCible = {
  prenom: string;
  nom: string;
  nationalite: string;
  confederation: FootixConfederation;
  poste: FootixPoste;
  club: string;
  ligue: string;
  naissance: number;
};

export type FootixSearchResult = {
  index: number;
  prenom: string;
  nom: string;
  club: string;
  ligue: string;
  nationalite: string;
  poste: FootixPoste;
  popularityScore: number;
};

export type FootixGuessResponse = {
  correct: boolean;
  comparison: FootixComparison;
  tentativesRestantes: number | null;
  statut: FootixStatus | null;
  footballeurCible: FootixCible | null;
  streakMilestone?: number;
};

export type FootixSessionResponse = {
  session: {
    statut: FootixStatus;
    tentatives: FootixTentative[];
    tentativesRestantes: number;
    footballeurCible: FootixCible | null;
  } | null;
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

// ─── Yearbox ──────────────────────────────────────────────────────────────────

export type YearboxDomain = "cinema" | "musique" | "sport" | "politique" | "tech";
export type YearboxFact = { domain: YearboxDomain; text: string };
export type YearboxStatus = "in_progress" | "won" | "lost";
export type YearboxDirection = "exact" | "trop-tot" | "trop-tard";
export type YearboxCible = { year: number; facts: YearboxFact[] };

export type YearboxGuessResponse = {
  direction: YearboxDirection;
  factsRevealed: YearboxFact[];
  tentativesRestantes: number;
  statut: YearboxStatus;
  cible: YearboxCible | null;
  streakMilestone?: number;
};

export type YearboxSessionResponse = {
  session: {
    statut: YearboxStatus;
    guesses: number[];
    factsRevealed: YearboxFact[];
    tentativesRestantes: number;
    cible: YearboxCible | null;
  } | null;
};

// ─── Chainapan ────────────────────────────────────────────────────────────────

export type StepTileResult = "correct" | "changed" | "neutral";

export type ChainapanStep = {
  word: string;
  tileResults: StepTileResult[];
};

export type ChainapanDailyInfo = {
  date: string;
  wordLength: number;
  startWord: string;
  targetWord: string;
  maxSteps: number;
  minSteps: number;
};

export type ChainapanSession = {
  status: "in_progress" | "won" | "lost";
  steps: ChainapanStep[];
  stepsLeft: number;
  startWord: string;
  targetWord: string;
  wordLength: number;
};

export type ChainapanStepResponse = {
  step: ChainapanStep;
  status: "in_progress" | "won" | "lost";
  stepsLeft: number;
  streakMilestone?: number;
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export type YearboxSuggestionStatus = "pending" | "approved" | "rejected";

export type YearboxEventSuggestion = {
  id: string;
  userId: string;
  username: string;
  year: number;
  domain: YearboxDomain;
  text: string;
  status: YearboxSuggestionStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type SuggestYearboxEventRequest = { year: number; domain: YearboxDomain; text: string };
export type SuggestYearboxEventResponse = { id: string; status: YearboxSuggestionStatus };

export type AdminSuggestionsResponse = {
  suggestions: YearboxEventSuggestion[];
  total: number;
  page: number;
};

export type AdminReviewSuggestionRequest = {
  status: "approved" | "rejected";
  adminNote?: string;
};

export type ScheduledEntry = {
  date: string;
  label: string;
  payload: Record<string, unknown>;
};

export type AdminScheduleResponse = {
  game: string;
  entries: ScheduledEntry[];
};
