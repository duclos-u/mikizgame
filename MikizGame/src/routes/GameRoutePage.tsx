import { Navigate, useParams } from 'react-router-dom'
import { renderGame } from './gameRegistry'

export function GameRoutePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const element = renderGame(gameId)

  if (!element) {
    return <Navigate to="/" replace />
  }

  return element
}
