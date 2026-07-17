export type {
  User,
  AuthResponse,
  TileResult,
  GuessResult,
  MotivexSession,
  GuessResponse,
  DailyInfo,
  CinemaxdActeur,
  CinemaxdReal,
  CinemaxdFilm,
  CinemaxdIndices,
  CinemaxdStatut,
  CinemaxdTotaux,
  CinemaxdTentative,
  CinemaxdSession,
  CinemaxdGuessResponse,
  TmdbFilmResult,
  LeaderboardEntry,
  LeaderboardResponse,
  AllTimeEntry,
  AllTimeResponse,
  DailyCountsResponse,
  CrossGameBreakdown,
  CrossGameEntry,
  CrossLeaderboardResponse,
  CrossAllTimeBreakdown,
  CrossAllTimeEntry,
  CrossAllTimeResponse,
  StepTileResult,
  ChainapanStep,
  ChainapanDailyInfo,
  ChainapanSession,
  ChainapanStepResponse,
} from './shared-types'

import type {
  User,
  AuthResponse,
  MotivexSession,
  GuessResponse,
  DailyInfo,
  CinemaxdFilm,
  CinemaxdSession,
  CinemaxdGuessResponse,
  CinemaxdTotaux,
  TmdbFilmResult,
  LeaderboardResponse,
  AllTimeResponse,
  DailyCountsResponse,
  CrossLeaderboardResponse,
  CrossAllTimeResponse,
  ChainapanDailyInfo,
  ChainapanSession,
  ChainapanStepResponse,
} from './shared-types'

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Cinemaxd ────────────────────────────────────────────────────────────────

export function searchFilms(q: string): Promise<TmdbFilmResult[]> {
  return request<TmdbFilmResult[]>(`/cinemaxd/search?q=${encodeURIComponent(q)}`)
}

// ─── Vinymix ───────────────────────────────────────────────────────────────────

export type VinymixMatchStatus = 'match' | 'close' | 'miss' | 'info' | 'unknown'

export type VinymixClue = {
  key: string
  label: string
  value: string
  status: VinymixMatchStatus
  direction?: 'up' | 'down'
}

export type VinymixArtist = {
  id: string
  name: string
  imageUrl: string | null
  creationYear: number | null
  memberCount: number
  spotifyFollowers: number
  spotifyPopularity: number
  genres: string[]
  gender: string | null
  country: string | null
}

export type VinymixGuess = {
  artist: VinymixArtist
  clues: VinymixClue[]
}

export type VinymixStatus = 'in_progress' | 'won' | 'lost'

export type VinymixGuessResponse = {
  guess: VinymixGuess
  status: VinymixStatus
  guessesLeft: number
  targetArtist: VinymixArtist | null
}

export type VinymixSessionResponse = {
  session: {
    guesses: VinymixGuess[]
    status: VinymixStatus
    guessesLeft: number
    targetArtist: VinymixArtist | null
  } | null
}

export type VinymixSearchResult = {
  id: string
  name: string
  imageUrl: string | null
  genres: string[]
  followers: number
}

// ─── Politics ─────────────────────────────────────────────────────────────────

export type PoliticsMatchResult = 'exact' | 'wrong'
export type PoliticsMandatType =
  | 'Président de la République'
  | 'Premier ministre'
  | 'Ministre'
  | 'Député'
  | 'Eurodéputé'
  | 'Sénateur'
  | 'Chef de parti'
export type PoliticsOrientation =
  | 'gauche'
  | 'centre-gauche'
  | 'centre'
  | 'droite'
  | 'extrême droite'

export type PoliticsComparison = {
  genre: { value: string | null; match: PoliticsMatchResult }
  originRegion: { value: string | null; match: PoliticsMatchResult }
  currentOrLastParti: { value: string | null; match: PoliticsMatchResult | 'meme-famille' }
  fonctionActuelle: { value: PoliticsMandatType[]; matching: PoliticsMandatType[] }
  anciennesFonctions: { value: PoliticsMandatType[]; matching: PoliticsMandatType[] }
  naissance: {
    value: string | null
    deces: string | null
    direction: 'exact' | 'plus-age' | 'plus-jeune'
    proche: boolean
  }
  orientation: {
    value: PoliticsOrientation
    score: number
    match: PoliticsMatchResult
    direction?: 'plus-gauche' | 'plus-droite'
  }
  condamnation: {
    condamne: boolean
    match: PoliticsMatchResult
    affaires?: Array<{
      affaire: string | null
      prison: string | null
      amende: string | null
      date: number | null
    }>
  }
}

export type PoliticsDeputeInfo = {
  scoreParticipation: number | null
  scoreParticipationSpecialite: number | null
  scoreLoyaute: number | null
  groupe: string | undefined
  departementNom: string | undefined
}

export type PoliticsTentative = {
  politicianIndex: number
  politicien: { prenom: string; nom: string }
  comparison: PoliticsComparison
  deputeInfo?: PoliticsDeputeInfo | null
  mepInfo?: PoliticsDeputeInfo | null
}

export type PoliticsStatus = 'in_progress' | 'won' | 'lost'

export type PoliticsCible = {
  prenom: string
  nom: string
  currentOrLastParti: string | null
  originRegion: string | null
  naissance: string | null
  deces?: string | null
  genre: string | null
  politiscore: number
}

export type PoliticsSearchResult = {
  index: number
  prenom: string
  nom: string
  currentOrLastParti: string | null
  popularityScore: number
  deces: string | null
}

export type PoliticsGuessResponse = {
  correct: boolean
  comparison: PoliticsComparison
  deputeInfo: PoliticsDeputeInfo | null
  mepInfo: PoliticsDeputeInfo | null
  tentativesRestantes: number | null
  statut: PoliticsStatus | null
  politicienCible: PoliticsCible | null
}

export type PoliticsSessionResponse = {
  session: {
    statut: PoliticsStatus
    tentatives: PoliticsTentative[]
    tentativesRestantes: number
    politicienCible: PoliticsCible | null
  } | null
}

// ─── Footix ───────────────────────────────────────────────────────────────────

export type FootixConfederation = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC'
export type FootixPoste = 'Gardien' | 'Défenseur' | 'Milieu' | 'Attaquant'
export type FootixStatus = 'in_progress' | 'won' | 'lost'

export type FootixComparison = {
  nationalite: {
    value: string
    confederation: FootixConfederation
    match: 'exact' | 'meme-confederation' | 'wrong'
  }
  poste: {
    value: FootixPoste
    match: 'exact' | 'wrong'
  }
  naissance: {
    value: number
    direction: 'exact' | 'plus-vieux' | 'plus-jeune'
    proche: boolean
  }
  club: {
    value: string
    ligue: string
    match: 'exact' | 'meme-ligue' | 'wrong'
  }
}

export type FootixTentative = {
  footballerIndex: number
  footballer: { prenom: string; nom: string }
  comparison: FootixComparison
}

export type FootixCible = {
  prenom: string
  nom: string
  nationalite: string
  confederation: FootixConfederation
  poste: FootixPoste
  club: string
  ligue: string
  naissance: number
}

export type FootixSearchResult = {
  index: number
  prenom: string
  nom: string
  club: string
  ligue: string
  nationalite: string
  poste: FootixPoste
  popularityScore: number
}

export type FootixGuessResponse = {
  correct: boolean
  comparison: FootixComparison
  tentativesRestantes: number | null
  statut: FootixStatus | null
  footballeurCible: FootixCible | null
}

export type FootixSessionResponse = {
  session: {
    statut: FootixStatus
    tentatives: FootixTentative[]
    tentativesRestantes: number
    footballeurCible: FootixCible | null
  } | null
}

// ─── Yearbox ──────────────────────────────────────────────────────────────────

export type YearboxDomain = 'cinema' | 'musique' | 'sport' | 'politique' | 'tech'
export type YearboxFact = { domain: YearboxDomain; text: string }
export type YearboxStatus = 'in_progress' | 'won' | 'lost'
export type YearboxDirection = 'exact' | 'trop-tot' | 'trop-tard'
export type YearboxCible = { year: number; facts: YearboxFact[] }

export type YearboxGuessResponse = {
  direction: YearboxDirection
  factsRevealed: YearboxFact[]
  tentativesRestantes: number | null
  statut: YearboxStatus | null
  cible: YearboxCible | null
}

export type YearboxSessionResponse = {
  session: {
    statut: YearboxStatus
    guesses: number[]
    factsRevealed: YearboxFact[]
    tentativesRestantes: number
    cible: YearboxCible | null
  } | null
}

// ─────────────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    register: (username: string, email: string, password: string) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      }),
    login: (email: string, password: string) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: User }>('/auth/me'),
    forgotPassword: (email: string) =>
      request<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, newPassword: string) =>
      request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
  },
  motivex: {
    daily: () => request<DailyInfo>('/motivex/daily'),
    session: () => request<{ session: MotivexSession | null }>('/motivex/session'),
    guess: (guess: string) =>
      request<GuessResponse>('/motivex/guess', {
        method: 'POST',
        body: JSON.stringify({ guess }),
      }),
    reset: () => request<{ ok: boolean }>('/motivex/session', { method: 'DELETE' }),
  },
  cinemaxd: {
    session: () =>
      request<{ session: CinemaxdSession | null; totalIndices: CinemaxdTotaux }>('/filmdujour/session'),
    guess: (tmdbId: number) =>
      request<CinemaxdGuessResponse>('/filmdujour/guess', {
        method: 'POST',
        body: JSON.stringify({ tmdbId }),
      }),
    reset: () => request<{ ok: boolean }>('/filmdujour/session', { method: 'DELETE' }),
    search: (q: string) =>
      request<{ films: CinemaxdFilm[] }>(`/films/search?q=${encodeURIComponent(q)}`),
  },
  vinymix: {
    session: () => request<VinymixSessionResponse>('/vinymix/session'),
    guess: (artistId: string) =>
      request<VinymixGuessResponse>('/vinymix/guess', {
        method: 'POST',
        body: JSON.stringify({ artistId }),
      }),
    search: (q: string) =>
      request<VinymixSearchResult[]>(`/vinymix/search?q=${encodeURIComponent(q)}`),
    today: () => request<{ targetArtist: VinymixArtist }>('/vinymix/today'),
    reset: () => request<{ ok: boolean }>('/vinymix/session', { method: 'DELETE' }),
  },
  politics: {
    session: () => request<PoliticsSessionResponse>('/politics/session'),
    guess: (politicianIndex: number) =>
      request<PoliticsGuessResponse>('/politics/guess', {
        method: 'POST',
        body: JSON.stringify({ politicianIndex }),
      }),
    search: (q: string) =>
      request<PoliticsSearchResult[]>(`/politics/search?q=${encodeURIComponent(q)}`),
    reset: () => request<{ ok: boolean }>('/politics/session', { method: 'DELETE' }),
  },
  footix: {
    session: () => request<FootixSessionResponse>('/footix/session'),
    guess: (footballerIndex: number) =>
      request<FootixGuessResponse>('/footix/guess', {
        method: 'POST',
        body: JSON.stringify({ footballerIndex }),
      }),
    search: (q: string) =>
      request<FootixSearchResult[]>(`/footix/search?q=${encodeURIComponent(q)}`),
    reset: () => request<{ ok: boolean }>('/footix/session', { method: 'DELETE' }),
  },
  yearbox: {
    daily: () => request<{ factsRevealed: YearboxFact[] }>('/yearbox/daily'),
    session: () => request<YearboxSessionResponse>('/yearbox/session'),
    guess: (year: number, wrongGuessesSoFar?: number) =>
      request<YearboxGuessResponse>('/yearbox/guess', {
        method: 'POST',
        body: JSON.stringify({ year, wrongGuessesSoFar }),
      }),
    reset: () => request<{ ok: boolean }>('/yearbox/session', { method: 'DELETE' }),
  },
  chainapan: {
    daily: () => request<ChainapanDailyInfo>('/chainapan/daily'),
    session: () => request<{ session: ChainapanSession | null }>('/chainapan/session'),
    step: (word: string) =>
      request<ChainapanStepResponse>('/chainapan/step', {
        method: 'POST',
        body: JSON.stringify({ word }),
      }),
    reset: () => request<{ ok: boolean }>('/chainapan/session', { method: 'DELETE' }),
  },
  leaderboard: {
    get: (game: string, date?: string) =>
      request<LeaderboardResponse>(`/leaderboard/${game}${date ? `?date=${date}` : ''}`),
    getStats: (game: string) =>
      request<AllTimeResponse>(`/leaderboard/${game}/stats`),
    getCross: (date?: string) =>
      request<CrossLeaderboardResponse>(`/leaderboard/cross${date ? `?date=${date}` : ''}`),
    getCrossStats: () =>
      request<CrossAllTimeResponse>('/leaderboard/cross/stats'),
    getCounts: (date?: string) =>
      request<DailyCountsResponse>(`/leaderboard/counts${date ? `?date=${date}` : ''}`),
  },
}
