export type {
  User,
  AuthResponse,
  TileResult,
  GuessResult,
  MotivexSession,
  GuessResponse,
  DailyInfo,
  CineclueActeur,
  CineclueReal,
  CineclueFilm,
  CineclueIndices,
  CineclueStatut,
  CineclueTotaux,
  CineclueTentative,
  CineclueSession,
  CineclueGuessResponse,
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
} from './shared-types'

import type {
  User,
  AuthResponse,
  MotivexSession,
  GuessResponse,
  DailyInfo,
  CineclueFilm,
  CineclueSession,
  CineclueGuessResponse,
  CineclueTotaux,
  TmdbFilmResult,
  LeaderboardResponse,
  AllTimeResponse,
  DailyCountsResponse,
  CrossLeaderboardResponse,
  CrossAllTimeResponse,
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

// ─── CinéClue ────────────────────────────────────────────────────────────────

export type CineclueActeur = { nom: string; photo: string | null }
export type CineclueReal = { nom: string; photo: string | null }

export type CineclueFilm = {
  id: number
  titre: string
  annee: number
  duree: number
  genres: string[]
  pays: string[]
  langue: string
  realisateurs: CineclueReal[]
  acteurs: CineclueActeur[]
  recompenses: string[]
}

export type CineclueIndices = {
  genres: string[]
  pays: string[]
  acteurs: string[]
  realisateurRevele: boolean
  realisateurInfo?: { nom: string; photo: string | null } | null
  anneeMin: number | null
  anneeMax: number | null
  dureeMin: number | null
  dureeMax: number | null
  langue: string | null
}

export type CineclueStatut = 'in_progress' | 'won' | 'lost'

export type CineclueTotaux = {
  genres: number
  pays: number
  acteurs: number
}

export type CineclueTentative = {
  tmdbId: number
  filmSoumis: CineclueFilm
  anneeProche?: boolean
  dureeProche?: boolean
}

export type CineclueSession = {
  statut: CineclueStatut
  tentatives: CineclueTentative[]
  indices: CineclueIndices
  tentativesRestantes: number
  filmCible: CineclueFilm | null
}

export type CineclueGuessResponse = {
  correct: boolean
  filmSoumis: CineclueFilm
  indicesReveles: CineclueIndices
  tentativesRestantes: number
  statut: CineclueStatut
  filmCible: CineclueFilm | null
  totalIndices: CineclueTotaux
  pityCluesRevealed: string[]
}

export type TmdbFilmResult = {
  tmdbId: number
  titre: string
  annee: number | null
  poster: string | null
}

export function searchFilms(q: string): Promise<TmdbFilmResult[]> {
  return request<TmdbFilmResult[]>(`/cineclue/search?q=${encodeURIComponent(q)}`)
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
  genres: string[]
  country: string | null
  vocalType: string | null
  primaryLanguage: string | null
  mostFamousSong: { title: string; spotifyStreams: number } | null
  instrumentation: string | null
  appearsOnSoundtracksWith: string[]
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
  cineclue: {
    session: () =>
      request<{ session: CineclueSession | null; totalIndices: CineclueTotaux }>('/filmdujour/session'),
    guess: (tmdbId: number) =>
      request<CineclueGuessResponse>('/filmdujour/guess', {
        method: 'POST',
        body: JSON.stringify({ tmdbId }),
      }),
    reset: () => request<{ ok: boolean }>('/filmdujour/session', { method: 'DELETE' }),
    search: (q: string) =>
      request<{ films: CineclueFilm[] }>(`/films/search?q=${encodeURIComponent(q)}`),
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
    reset: () => request<{ ok: boolean }>('/vinymix/session', { method: 'DELETE' }),
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
