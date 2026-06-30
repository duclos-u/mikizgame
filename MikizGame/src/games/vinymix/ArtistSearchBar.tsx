import { useEffect, useRef, useState } from 'react'
import { type VinymixSearchResult, api } from '../../api/client'
import { artistColors } from '../../utils/artistColors'

type Props = {
  onGuess: (artistId: string) => void
  disabled?: boolean
  alreadyGuessed?: string[]
}

export function ArtistSearchBar({ onGuess, disabled = false, alreadyGuessed = [] }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<VinymixSearchResult[]>([])
  const [selected, setSelected] = useState<VinymixSearchResult | null>(null)
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
        const results = await api.vinymix.search(query)
        setSuggestions(results)
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

  function pick(artist: VinymixSearchResult) {
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
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="vinymix-search">
      <div className="vinymix-search-row">
        <div className="vinymix-search-wrap">
          <svg className="vinymix-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="vinymix-input"
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
          {loading && <span className="vinymix-search-spinner" />}

          {open && suggestions.length > 0 && (
            <ul className="vinymix-dropdown" role="listbox">
              {suggestions.map((artist, i) => {
                const deja = alreadyGuessed.includes(artist.id)
                return (
                  <li
                    key={artist.id}
                    role="option"
                    aria-selected={i === activeIdx}
                    className={[
                      'vinymix-dropdown-item',
                      i === activeIdx ? 'vinymix-dropdown-active' : '',
                      deja ? 'vinymix-dropdown-deja' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseDown={() => pick(artist)}
                  >
                    {artist.imageUrl ? (
                      <img
                        src={artist.imageUrl}
                        alt=""
                        className="vinymix-dropdown-avatar"
                        width={36}
                        height={36}
                      />
                    ) : (() => {
                      const { avBg, avFg } = artistColors(artist.name)
                      return (
                        <span
                          className="vinymix-dropdown-avatar vinymix-dropdown-avatar-placeholder"
                          style={{ background: avBg, color: avFg }}
                        >
                          {artist.name[0]}
                        </span>
                      )
                    })()}
                    <span className="vinymix-dropdown-name">{artist.name}</span>
                    <span className="vinymix-dropdown-genres">
                      {artist.genres.slice(0, 2).join(', ')}
                    </span>
                    {deja && <span className="vinymix-dropdown-badge">Déjà joué</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="vinymix-btn-submit"
          disabled={!selected || disabled}
          onClick={submit}
        >
          Deviner
        </button>
      </div>
    </div>
  )
}
