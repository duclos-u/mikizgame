import { useCallback, useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../constants/storage'

export type Jdj2State = {
  done: string[]
}

function loadState(): Jdj2State {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.JDJ2_STATE)
    if (!raw) return { done: [] }
    const parsed = JSON.parse(raw) as Partial<Jdj2State>
    return {
      done: Array.isArray(parsed.done) ? parsed.done : [],
    }
  } catch {
    return { done: [] }
  }
}

function persistState(state: Jdj2State) {
  localStorage.setItem(STORAGE_KEYS.JDJ2_STATE, JSON.stringify(state))
}

export function useJdj2State() {
  const [state, setState] = useState<Jdj2State>(loadState)

  useEffect(() => {
    persistState(state)
  }, [state])

  const markGameDone = useCallback((id: string) => {
    setState((s) => {
      if (s.done.includes(id)) return s
      return { done: [...s.done, id] }
    })
  }, [])

  return { state, markGameDone }
}
