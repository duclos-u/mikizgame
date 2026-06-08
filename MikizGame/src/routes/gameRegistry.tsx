import { createElement } from 'react'
import type { ReactNode } from 'react'
import CineClue from '../games/cineclue'
import Motivex from '../games/motivex'
import Sutom from '../games/sutom'

const GAME_COMPONENTS: Record<string, () => ReactNode> = {
  motivex: () => createElement(Motivex),
  sutom: () => createElement(Sutom),
  cineclue: () => createElement(CineClue),
}

export function renderGame(gameId: string | undefined): ReactNode | null {
  if (!gameId) return null
  return GAME_COMPONENTS[gameId]?.() ?? null
}
