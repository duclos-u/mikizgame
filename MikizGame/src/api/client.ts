const BASE = '/api'

export type User = { id: string; username: string; email: string; streak: number }
export type AuthResponse = { user: User; token: string }

export type TileResult = 'correct' | 'present' | 'absent'
export type GuessResult = { guess: string; result: TileResult[] }

export type SutomSession = {
  status: 'in_progress' | 'won' | 'lost'
  attempts: GuessResult[]
  wordLength: number
  firstLetter: string
  word?: string
}

export type GuessResponse = {
  result: GuessResult
  status: 'in_progress' | 'won' | 'lost'
  attemptsLeft: number
  word?: string
}

export type LeaderboardEntry = {
  username: string
  score: number | null
  points: number
  completedAt: string
}

export type LeaderboardResponse = {
  date: string
  game: string
  total: number
  entries: LeaderboardEntry[]
}

export type SutomAllTimeEntry = {
  username: string
  wins: number
  avgAttempts: number | null
  totalPoints: number
}

export type SutomAllTimeResponse = {
  game: string
  total: number
  entries: SutomAllTimeEntry[]
}

export type DailyCountsResponse = {
  date: string
  counts: Record<string, number>
}

export type CrossGameBreakdown = {
  rank: number
  score: number | null
  points: number
}

export type CrossGameEntry = {
  username: string
  total: number
  breakdown: Record<string, CrossGameBreakdown>
}

export type CrossLeaderboardResponse = {
  date: string
  games: string[]
  entries: CrossGameEntry[]
}

export type DailyInfo = {
  date: string
  wordLength: number
  firstLetter: string
}

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
  anneeMin: number | null
  anneeMax: number | null
  dureeMin: number | null
  dureeMax: number | null
}

export type CineclueStatut = 'in_progress' | 'won' | 'lost'

export type CineclueTentative = {
  tmdbId: number
  filmSoumis: CineclueFilm
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
  sutom: {
    daily: () => request<DailyInfo>('/sutom/daily'),
    session: () => request<{ session: SutomSession | null }>('/sutom/session'),
    guess: (guess: string) =>
      request<GuessResponse>('/sutom/guess', {
        method: 'POST',
        body: JSON.stringify({ guess }),
      }),
    reset: () => request<{ ok: boolean }>('/sutom/session', { method: 'DELETE' }),
  },
  cineclue: {
    session: () => request<{ session: CineclueSession | null }>('/filmdujour/session'),
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
      request<SutomAllTimeResponse>(`/leaderboard/${game}/stats`),
    getCross: (date?: string) =>
      request<CrossLeaderboardResponse>(`/leaderboard/cross${date ? `?date=${date}` : ''}`),
    getCounts: (date?: string) =>
      request<DailyCountsResponse>(`/leaderboard/counts${date ? `?date=${date}` : ''}`),
  },
}
