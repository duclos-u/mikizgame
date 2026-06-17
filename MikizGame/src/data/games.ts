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
  },
  {
    id: 'spotle',
    name: 'Spotle',
    desc: 'Devine l\'artiste du jour en 6 essais.',
    icon: '🎵',
    cat: 'musique',
    tag: 'tag-musique',
    tagLabel: 'Musique',
    accent: 'oklch(0.62 0.18 290)',
    status: 'live',
    players: 0,
    avgTries: 0,
    route: internalGamePath('spotle'),
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
