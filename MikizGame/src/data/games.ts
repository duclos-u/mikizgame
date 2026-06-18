import type { ComponentType } from 'react'
import { STORAGE_KEYS } from '../constants/storage'
import { today } from '../utils/date'

export type GameCategory = 'mots' | 'geo' | 'musique' | 'cinema' | 'culture'
export type GameStatus = 'live' | 'soon'

export type Game = {
  id: string
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

// Imports are at the bottom to avoid circular-dependency confusion.
import Motivex from '../games/motivex'
import CineClue from '../games/cineclue'
import Vinymix from '../games/vinymix'

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
    id: 'cineclue',
    name: 'CinéClue',
    desc: 'Devine le film du jour en 10 tentatives.',
    icon: '🎬',
    cat: 'cinema',
    tag: 'tag-cinema',
    tagLabel: 'Cinéma',
    accent: 'oklch(0.62 0.16 292)',
    status: 'live',
    players: 9,
    avgTries: 5,
    route: internalGamePath('cineclue'),
    maxAttempts: 10,
    component: CineClue,
    checkDoneToday: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.CINECLUE_STATE(today()))
        if (!raw) return false
        // Stored as { session: CineclueSession | null; totalIndices: ... }
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
    status: 'soon',
    players: 0,
    avgTries: 0,
    route: internalGamePath('vinymix'),
    component: Vinymix,
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
