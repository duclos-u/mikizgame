import { useEffect, useRef, useState } from 'react'
import { type SpotleSearchResult, api } from '../../api/client'

type Props = {
  onGuess: (artistId: string) => void
  disabled?: boolean
  alreadyGuessed?: string[]
}

export function ArtistSearchBar({ onGuess, disabled = false, alreadyGuessed = [] }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SpotleSearchResult[]>([])
  const [selected, setSelected] = useState<SpotleSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
        const results = await api.spotle.search(query)
        setSuggestions(results)
        setOpen(true)
        setActiveIdx(-1)
      } catch {
        setSuggestions([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 280)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected])

  function pick(artist: SpotleSearchResult) {
    if (!artist.inPool) return
    setSelected(artist)
    setQuery(artist.name)
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  function submit() {
    if (!selected || disabled) return
    onGuess(selected.id)
    setSelected(null)
    setQuery('')
    setSuggestions([])
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIdx >= 0 && suggestions[activeIdx]?.inPool) {
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
    <div className="spotle-search">
      <div className="spotle-search-row">
        <div className="spotle-search-wrap">
          <input
            ref={inputRef}
            type="text"
            className="spotle-input"
            placeholder="Cherche un artiste…"
            value={query}
            disabled={disabled}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(null)
            }}
            onKeyDown={handleKey}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {loading && <span className="spotle-search-spinner" />}

          {open && suggestions.length > 0 && (
            <ul className="spotle-dropdown" role="listbox">
              {suggestions.map((artist, i) => {
                const deja = alreadyGuessed.includes(artist.id)
                const notAvailable = !artist.inPool
                return (
                  <li
                    key={artist.id}
                    role="option"
                    aria-selected={i === activeIdx}
                    className={[
                      'spotle-dropdown-item',
                      i === activeIdx ? 'spotle-dropdown-active' : '',
                      deja ? 'spotle-dropdown-deja' : '',
                      notAvailable ? 'spotle-dropdown-unavailable' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseDown={() => !notAvailable && pick(artist)}
                  >
                    {artist.imageUrl ? (
                      <img
                        src={artist.imageUrl}
                        alt=""
                        className="spotle-dropdown-avatar"
                        width={36}
                        height={36}
                      />
                    ) : (
                      <span className="spotle-dropdown-avatar spotle-dropdown-avatar-placeholder">
                        {artist.name[0]}
                      </span>
                    )}
                    <span className="spotle-dropdown-name">{artist.name}</span>
                    <span className="spotle-dropdown-genres">
                      {artist.genres.slice(0, 2).join(', ')}
                    </span>
                    {deja && <span className="spotle-dropdown-badge">Déjà joué</span>}
                    {notAvailable && <span className="spotle-dropdown-badge">Non disponible</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="spotle-btn-submit"
          disabled={!selected || disabled}
          onClick={submit}
        >
          Deviner
        </button>
      </div>
    </div>
  )
}
