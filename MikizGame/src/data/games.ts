import { type ComponentType, lazy } from 'react'
import { STORAGE_KEYS } from '../constants/storage'
import { today } from '../utils/date'

export type GameCategory = 'mots' | 'geo' | 'musique' | 'cinema' | 'culture' | 'politique'
export type GameStatus = 'live' | 'soon'

export type Game = {
  id: string
  slug?: string  // backend DB slug when it differs from id
  name: string
  desc: string
  icon: string
  cat: GameCategory
  tag: string
  tagLabel: string
  accent: string
  status: GameStatus
  players: number
  avgTries: number
  url?: string
  route?: string
  // Per-game config (only present for live games)
  maxAttempts?: number
  checkDoneToday?: () => boolean
  component?: ComponentType
}

export function internalGamePath(gameId: string) {
  return `/games/${gameId}`
}

// Lazy-loaded to enable code splitting: each game is a separate chunk.
const Motivex = lazy(() => import('../games/motivex')) as ComponentType
const Cinemaxd = lazy(() => import('../games/cinemaxd')) as ComponentType
const Vinymix = lazy(() => import('../games/vinymix')) as ComponentType
const Politeki = lazy(() => import('../games/politics')) as ComponentType

export const GAMES: Game[] = [
  {
    id: 'motivex',
    name: 'Motivex',
    desc: 'Devine le mot du jour en 6 essais.',
    icon: '🔤',
    cat: 'mots',
    tag: 'tag-mots',
    tagLabel: 'Mots',
    accent: 'oklch(0.66 0.15 152)',
    status: 'live',
    players: 8,
    avgTries: 4,
    route: internalGamePath('motivex'),
    maxAttempts: 6,
    component: Motivex,
    checkDoneToday: () => {
      try {
        return localStorage.getItem(STORAGE_KEYS.MOTIVEX_STATE(today())) === '1'
      } catch {
        return false
      }
    },
  },
  {
    id: 'cinemaxd',
    name: 'Cinemaxd',
    desc: 'Devine le film du jour en 10 tentatives.',
    icon: '🎬',
    cat: 'cinema',
    tag: 'tag-cinema',
    tagLabel: 'Cinéma',
    accent: 'oklch(0.62 0.16 292)',
    status: 'live',
    players: 9,
    avgTries: 5,
    route: internalGamePath('cinemaxd'),
    maxAttempts: 10,
    component: Cinemaxd,
    checkDoneToday: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.CINEMAXD_STATE(today()))
        if (!raw) return false
        const parsed = JSON.parse(raw) as { session?: { statut?: string } }
        const statut = parsed.session?.statut
        return statut === 'won' || statut === 'lost'
      } catch {
        return false
      }
    },
  },
  {
    id: 'vinymix',
    name: 'Vinymix',
    desc: 'Devine l\'artiste du jour en 6 essais.',
    icon: '🎵',
    cat: 'musique',
    tag: 'tag-musique',
    tagLabel: 'Musique',
    accent: 'oklch(0.62 0.18 290)',
    status: 'live',
    players: 0,
    avgTries: 0,
    route: internalGamePath('vinymix'),
    maxAttempts: 6,
    component: Vinymix,
    checkDoneToday: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.VINYMIX_STATE(today()))
        if (!raw) return false
        const parsed = JSON.parse(raw) as { status?: string }
        return parsed.status === 'won' || parsed.status === 'lost'
      } catch {
        return false
      }
    },
  },
  {
    id: 'politics',
    slug: 'politeki',
    name: 'Politeki',
    desc: 'Devine le politicien du jour en 10 essais.',
    icon: '🗳️',
    cat: 'politique',
    tag: 'tag-politique',
    tagLabel: 'Politique',
    accent: 'oklch(0.56 0.20 22)',
    status: 'live',
    players: 0,
    avgTries: 0,
    route: internalGamePath('politics'),
    maxAttempts: 10,
    component: Politeki,
    checkDoneToday: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.POLITICS_STATE(today()))
        if (!raw) return false
        const parsed = JSON.parse(raw) as { statut?: string }
        return parsed.statut === 'won' || parsed.statut === 'lost'
      } catch {
        return false
      }
    },
  },
  {
    id: 'geodle',
    name: 'Géodle',
    desc: 'Le pays mystère du jour.',
    icon: '🗺️',
    cat: 'geo',
    tag: 'tag-geo',
    tagLabel: 'Géographie',
    accent: 'oklch(0.62 0.15 232)',
    status: 'soon',
    players: 0,
    avgTries: 0,
  },
]
