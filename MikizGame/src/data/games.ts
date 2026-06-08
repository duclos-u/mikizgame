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
}

export function internalGamePath(gameId: string) {
  return `/games/${gameId}`
}

export const GAMES: Game[] = [
  {
    id: 'sutom',
    name: 'Sutom',
    desc: 'Devine le mot du jour en 6 essais.',
    icon: '🔤',
    cat: 'mots',
    tag: 'tag-mots',
    tagLabel: 'Mots',
    accent: 'oklch(0.66 0.15 152)',
    status: 'live',
    players: 6390,
    avgTries: 4,
    route: internalGamePath('sutom'),
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
    players: 3517,
    avgTries: 5,
    route: internalGamePath('cineclue'),
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
  {
    id: 'sondle',
    name: 'Sondle',
    desc: 'Devine le titre à l\'oreille.',
    icon: '🎵',
    cat: 'musique',
    tag: 'tag-musique',
    tagLabel: 'Musique',
    accent: 'oklch(0.66 0.18 352)',
    status: 'soon',
    players: 0,
    avgTries: 0,
  },
]
