import { useCallback } from 'react'
import { STORAGE_KEYS } from '../constants/storage'
import { today } from '../utils/date'

type HubScoreEntry = {
  username: string
  score: number | null
  timestamp: number
}

function readEntries(gameId: string): HubScoreEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.HUB_SCORES(gameId, today())) ?? '[]') as HubScoreEntry[]
  } catch {
    return []
  }
}

export function useHubScores() {
  const saveScore = useCallback((gameId: string, username: string, score: number | null) => {
    const key = STORAGE_KEYS.HUB_SCORES(gameId, today())
    const entries = readEntries(gameId).filter((e) => e.username !== username)
    entries.push({ username, score, timestamp: Date.now() })
    localStorage.setItem(key, JSON.stringify(entries))
  }, [])

  return { saveScore }
}
