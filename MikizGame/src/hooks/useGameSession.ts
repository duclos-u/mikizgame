import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

interface UseGameSessionOptions<T> {
  fetch: () => Promise<T>
  // localStorage key for offline-first caching; omit to skip caching
  cacheKey?: string
  // When true, loading resolves immediately if unauthenticated (no guest mode)
  requireAuth?: boolean
}

interface UseGameSessionResult<T> {
  data: T | null
  setData: (d: T | null) => void
  loading: boolean
  error: string | null
  authenticated: boolean
}

function readCache<T>(key: string | undefined): T | null {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeCache<T>(key: string | undefined, value: T | null) {
  if (!key) return
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function useGameSession<T>({
  fetch,
  cacheKey,
  requireAuth = false,
}: UseGameSessionOptions<T>): UseGameSessionResult<T> {
  const { token } = useAuth()
  const fetched = useRef(false)

  const [data, setDataState] = useState<T | null>(() => readCache(cacheKey))

  // Start loading only if we'll actually make an API call:
  //   - authenticated (token exists)
  //   - AND no cached data to show immediately
  const [loading, setLoading] = useState(!!token && data === null)
  const [error, setError] = useState<string | null>(null)

  function setData(d: T | null) {
    setDataState(d)
    writeCache(cacheKey, d)
  }

  useEffect(() => {
    if (fetched.current) return
    fetched.current = true

    // No-op cases: resolve loading immediately without an API call
    if (requireAuth && !token) { setLoading(false); return }
    if (!token) { setLoading(false); return }

    // Authenticated fetch.
    // If cached data is visible, do a silent refresh (no loading spinner).
    fetch()
      .then((result) => {
        setDataState(result)
        writeCache(cacheKey, result)
      })
      .catch((e) => {
        // Surface the error only if there's nothing to show.
        if (data === null) setError(e instanceof Error ? e.message : 'Erreur de chargement')
      })
      .finally(() => setLoading(false))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, setData, loading, error, authenticated: !!token }
}
