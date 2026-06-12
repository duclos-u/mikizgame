import { createElement } from 'react'
import type { ComponentType, ReactNode } from 'react'
import CineClue from '../games/cineclue'
import Motivex from '../games/motivex'

const GAME_COMPONENTS: Record<string, ComponentType> = {
  motivex: Motivex,
  cineclue: CineClue,
}

export function renderGame(gameId: string | undefined): ReactNode | null {
  if (!gameId) return null
  const Component = GAME_COMPONENTS[gameId]
  return Component ? createElement(Component) : null
}
