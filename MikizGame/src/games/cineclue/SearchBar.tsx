import { useEffect, useRef, useState } from 'react'
import { type TmdbFilmResult, searchFilms } from '../../api/client'

type Props = {
  onGuess: (film: { id: number }) => void
  disabled?: boolean
  /** IDs déjà soumis pour les griser dans le dropdown */
  dejaJoues?: number[]
}

export function SearchBar({ onGuess, disabled = false, dejaJoues = [] }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<TmdbFilmResult[]>([])
  const [visibleCount, setVisibleCount] = useState(3)
  const [selected, setSelected] = useState<TmdbFilmResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)

  // Debounce 300ms sur la recherche
  useEffect(() => {
    if (selected) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const films = await searchFilms(query)
        setSuggestions(films)
        setVisibleCount(3)
        setOpen(true)
        setActiveIdx(-1)
      } catch {
        setSuggestions([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected])

  // IntersectionObserver sur le sentinel pour charger plus d'items
  useEffect(() => {
    if (!sentinelRef.current || !listRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < suggestions.length) {
          setVisibleCount((prev) => Math.min(prev + 5, suggestions.length))
        }
      },
      { root: listRef.current, threshold: 0 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [visibleCount, suggestions.length])

  function pick(film: TmdbFilmResult) {
    setSelected(film)
    setQuery(film.titre)
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  function submit() {
    if (!selected || disabled) return
    onGuess({ id: selected.tmdbId })
    setSelected(null)
    setQuery('')
    setSuggestions([])
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIdx >= 0 && suggestions[activeIdx]) {
        pick(suggestions[activeIdx])
      } else {
        submit()
      }
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, Math.min(visibleCount, suggestions.length) - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const visible = suggestions.slice(0, visibleCount)
  const hasMore = visibleCount < suggestions.length

  return (
    <div className="cineclue-search">
      <div className="cineclue-search-row">
        <div className="cineclue-search-wrap">
          <input
            ref={inputRef}
            type="text"
            className="cineclue-input"
            placeholder="Tape un titre de film…"
            value={query}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
            }}
            onKeyDown={handleKey}
            onFocus={() => open && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {loading && <span className="cineclue-search-spinner" />}

          {open && (
            <ul ref={listRef} className="cineclue-dropdown" role="listbox">
              {suggestions.length === 0 ? (
                <li className="cineclue-dropdown-item" role="option" aria-selected={false}>
                  Aucun film trouvé
                </li>
              ) : (
                <>
                  {visible.map((film, i) => {
                    const deja = dejaJoues.includes(film.tmdbId)
                    return (
                      <li
                        key={film.tmdbId}
                        role="option"
                        aria-selected={i === activeIdx}
                        className={[
                          'cineclue-dropdown-item',
                          i === activeIdx ? 'cineclue-dropdown-active' : '',
                          deja ? 'cineclue-dropdown-deja' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onMouseDown={() => pick(film)}
                      >
                        {film.poster && (
                          <img
                            src={film.poster}
                            alt=""
                            className="cineclue-dropdown-poster"
                            width={32}
                            height={48}
                          />
                        )}
                        <span className="cineclue-dropdown-titre">{film.titre}</span>
                        <span className="cineclue-dropdown-annee">{film.annee ?? '—'}</span>
                        {deja && <span className="cineclue-dropdown-badge">Déjà joué</span>}
                      </li>
                    )
                  })}
                  {hasMore && (
                    <li
                      ref={sentinelRef}
                      className="cineclue-dropdown-item"
                      style={{ justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}
                      aria-hidden="true"
                    >
                      ↓ plus de résultats
                    </li>
                  )}
                </>
              )}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="cineclue-btn-submit"
          disabled={!selected || disabled}
          onClick={submit}
        >
          Deviner
        </button>
      </div>
    </div>
  )
}
