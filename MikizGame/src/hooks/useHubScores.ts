import { useCallback } from 'react'

type HubScoreEntry = {
  username: string
  score: number | null
  timestamp: number
}

function storageKey(gameId: string) {
  const date = new Date().toISOString().slice(0, 10)
  return `hub_scores_${gameId}_${date}`
}

function readEntries(gameId: string): HubScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(gameId)) ?? '[]') as HubScoreEntry[]
  } catch {
    return []
  }
}

export function useHubScores() {
  const saveScore = useCallback((gameId: string, username: string, score: number | null) => {
    const key = storageKey(gameId)
    const entries = readEntries(gameId).filter((e) => e.username !== username)
    entries.push({ username, score, timestamp: Date.now() })
    localStorage.setItem(key, JSON.stringify(entries))
  }, [])

  return { saveScore }
}
