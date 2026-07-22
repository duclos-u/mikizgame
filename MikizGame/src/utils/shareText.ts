import { GAMES } from '../data/games'

function formatShareDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Builds the first two lines shared by every game's clipboard export:
 *   {GameName} {emoji} — {DD/MM/YYYY}
 *   {score/attempts line}
 *
 * `gameId` must match an id in GAMES (src/data/games.ts) — emoji is looked up
 * from that registry, never hardcoded by the caller.
 */
export function buildShareHeader(gameId: string, scoreLine: string, date: Date = new Date()): string {
  const game = GAMES.find((g) => g.id === gameId)
  const name = game?.name ?? gameId
  const emoji = game?.icon ?? ''
  return `${name} ${emoji} — ${formatShareDate(date)}\n${scoreLine}`
}
