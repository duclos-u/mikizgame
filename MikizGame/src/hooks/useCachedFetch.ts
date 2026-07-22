import { useEffect, useState } from 'react'

interface UseCachedFetchResult<T> {
  data: T | null
  loading: boolean
  error: boolean
}

// In-memory, session-scoped cache (resets on hard reload, survives route navigation).
const memoryCache = new Map<string, unknown>()

// Stale-while-revalidate: paint the last-known result for `key` immediately (no
// loading flash), then always refetch in the background and swap in the fresh
// result when it lands. Pass `enabled: false` to skip fetching altogether while
// still showing whatever was last cached for `key` (e.g. a tab that isn't active).
export function useCachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  deps: unknown[],
  options: { enabled?: boolean } = {},
): UseCachedFetchResult<T> {
  const enabled = options.enabled ?? true
  const hasCached = memoryCache.has(key)
  const [data, setData] = useState<T | null>(() => (hasCached ? (memoryCache.get(key) as T) : null))
  const [loading, setLoading] = useState(enabled && !hasCached)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    fetchFn()
      .then((result) => {
        if (cancelled) return
        memoryCache.set(key, result)
        setData(result)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, ...deps])

  return { data, loading: enabled && loading, error }
}
