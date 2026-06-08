import { useEffect, useRef, useState } from 'react'
import type { CineclueFilm } from '../../api/client'
import { api } from '../../api/client'

type Props = {
  onGuess: (film: CineclueFilm) => void
  disabled?: boolean
  /** IDs déjà soumis pour les griser dans le dropdown */
  dejaJoues?: number[]
}

export function SearchBar({ onGuess, disabled = false, dejaJoues = [] }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CineclueFilm[]>([])
  const [selected, setSelected] = useState<CineclueFilm | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Debounce 300ms sur la recherche
  useEffect(() => {
    if (selected) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const { films } = await api.cineclue.search(query)
        setSuggestions(films)
        setOpen(films.length > 0)
        setActiveIdx(-1)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected])

  function pick(film: CineclueFilm) {
    setSelected(film)
    setQuery(film.titre)
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  function submit() {
    if (!selected || disabled) return
    onGuess(selected)
    setSelected(null)
    setQuery('')
    setSuggestions([])
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIdx >= 0) {
        pick(suggestions[activeIdx])
      } else {
        submit()
      }
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

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
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {loading && <span className="cineclue-search-spinner" />}

          {open && (
            <ul ref={listRef} className="cineclue-dropdown" role="listbox">
              {suggestions.map((film, i) => {
                const deja = dejaJoues.includes(film.id)
                return (
                  <li
                    key={film.id}
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
                    <span className="cineclue-dropdown-titre">{film.titre}</span>
                    <span className="cineclue-dropdown-annee">{film.annee || '—'}</span>
                    {deja && <span className="cineclue-dropdown-badge">Déjà joué</span>}
                  </li>
                )
              })}
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
