import { Suspense, createElement } from 'react'
import type { ReactNode } from 'react'
import { GAMES } from '../data/games'

function GameFallback() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--muted)' }}>
      Chargement…
    </div>
  )
}

export function renderGame(gameId: string | undefined): ReactNode | null {
  if (!gameId) return null
  const game = GAMES.find((g) => g.id === gameId)
  if (!game?.component) return null
  return (
    <Suspense fallback={<GameFallback />}>
      {createElement(game.component)}
    </Suspense>
  )
}
