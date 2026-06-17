import { createElement } from 'react'
import type { ReactNode } from 'react'
import { GAMES } from '../data/games'

export function renderGame(gameId: string | undefined): ReactNode | null {
  if (!gameId) return null
  const game = GAMES.find((g) => g.id === gameId)
  return game?.component ? createElement(game.component) : null
}
