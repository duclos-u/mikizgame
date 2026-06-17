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

export function searchFilms(q: string): Promise<TmdbFilmResult[]> {
  return request<TmdbFilmResult[]>(`/cineclue/search?q=${encodeURIComponent(q)}`)
}

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
