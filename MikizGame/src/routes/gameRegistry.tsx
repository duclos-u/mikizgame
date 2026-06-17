import { createElement } from 'react'
import type { ComponentType, ReactNode } from 'react'
import CineClue from '../games/cineclue'
import Motivex from '../games/motivex'
import Spotle from '../games/spotle'

const GAME_COMPONENTS: Record<string, ComponentType> = {
  motivex: Motivex,
  cineclue: CineClue,
  spotle: Spotle,
}

export function renderGame(gameId: string | undefined): ReactNode | null {
  if (!gameId) return null
  const Component = GAME_COMPONENTS[gameId]
  return Component ? createElement(Component) : null
}
