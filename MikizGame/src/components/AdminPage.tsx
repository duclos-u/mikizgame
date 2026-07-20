import { useEffect, useRef, useState } from 'react'
import {
  type PoliticsSearchResult,
  type ScheduledEntry,
  type TmdbFilmResult,
  type YearboxEventSuggestion,
  api,
  searchFilms,
} from '../api/client'
import { useAuth } from '../context/AuthContext'

// ─── Suggestions ─────────────────────────────────────────────────────────────

type StatusFilter = 'pending' | 'approved' | 'rejected'

const STATUS_LABELS: Record<StatusFilter, string> = {
  pending: 'En attente',
  approved: 'Approuvées',
  rejected: 'Rejetées',
}

const DOMAIN_ICONS: Record<string, string> = {
  cinema: '🎬',
  musique: '🎵',
  sport: '⚽',
  politique: '🏛️',
  tech: '💻',
}

function SuggestionRow({
  suggestion,
  onReviewed,
}: {
  suggestion: YearboxEventSuggestion
  onReviewed: () => void
}) {
  const [noteInput, setNoteInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function review(status: 'approved' | 'rejected') {
    setLoading(true)
    try {
      await api.admin.reviewSuggestion(suggestion.id, {
        status,
        adminNote: noteInput.trim() || undefined,
      })
      onReviewed()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div className="admin-suggestion-row">
      <div className="admin-suggestion-meta">
        <span className="admin-suggestion-domain">{DOMAIN_ICONS[suggestion.domain] ?? '📌'} {suggestion.domain}</span>
        <span className="admin-suggestion-year">{suggestion.year}</span>
        <span className="admin-suggestion-user">@{suggestion.username}</span>
        <span className="admin-suggestion-date">{new Date(suggestion.createdAt).toLocaleDateString('fr-FR')}</span>
      </div>
      <p className="admin-suggestion-text">{suggestion.text}</p>
      {suggestion.adminNote && (
        <p className="admin-suggestion-note">Note : {suggestion.adminNote}</p>
      )}
      {suggestion.status === 'pending' && (
        <div className="admin-suggestion-actions">
          <input
            type="text"
            placeholder="Note optionnelle…"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            className="admin-note-input"
            disabled={loading}
          />
          <button
            type="button"
            className="admin-btn-approve"
            onClick={() => void review('approved')}
            disabled={loading}
          >
            Approuver
          </button>
          <button
            type="button"
            className="admin-btn-reject"
            onClick={() => void review('rejected')}
            disabled={loading}
          >
            Rejeter
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

type GameKey = 'yearbox' | 'politeki' | 'motivex' | 'chainapan' | 'cinemaxd'

const SCHEDULE_GAMES: { key: GameKey; label: string }[] = [
  { key: 'yearbox', label: 'Yearbox' },
  { key: 'politeki', label: 'Politeki' },
  { key: 'motivex', label: 'Motivex' },
  { key: 'chainapan', label: 'Chainapan' },
  { key: 'cinemaxd', label: 'Cinemaxd' },
]

function getDaysRange(days = 30): string[] {
  const result: string[] = []
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    result.push(`${yyyy}-${mm}-${dd}`)
  }
  return result
}

function YearboxForm({ date, onSaved, onCancel }: { date: string; onSaved: (entry: ScheduledEntry) => void; onCancel: () => void }) {
  const [year, setYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const y = parseInt(year)
    if (!y) return
    setLoading(true)
    setError('')
    try {
      const res = await api.admin.setSchedule('yearbox', { date, year: y })
      onSaved(res.entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <form className="schedule-form" onSubmit={(e) => void submit(e)}>
      <input
        type="number"
        min={1900}
        max={2030}
        placeholder="Année (ex: 1969)"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        className="schedule-input"
        autoFocus
      />
      {error && <span className="schedule-error">{error}</span>}
      <div className="schedule-form-actions">
        <button type="submit" className="admin-btn-approve" disabled={loading || !year}>Enregistrer</button>
        <button type="button" className="admin-btn-page" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}

function MotivexForm({ date, onSaved, onCancel }: { date: string; onSaved: (entry: ScheduledEntry) => void; onCancel: () => void }) {
  const [word, setWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!word.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.admin.setSchedule('motivex', { date, word: word.trim().toUpperCase() })
      onSaved(res.entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <form className="schedule-form" onSubmit={(e) => void submit(e)}>
      <input
        type="text"
        placeholder="MOT (ex: SOLEIL)"
        value={word}
        onChange={(e) => setWord(e.target.value.toUpperCase())}
        className="schedule-input"
        autoFocus
      />
      {error && <span className="schedule-error">{error}</span>}
      <div className="schedule-form-actions">
        <button type="submit" className="admin-btn-approve" disabled={loading || !word.trim()}>Enregistrer</button>
        <button type="button" className="admin-btn-page" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}

function ChainapanForm({ date, onSaved, onCancel }: { date: string; onSaved: (entry: ScheduledEntry) => void; onCancel: () => void }) {
  const [startWord, setStartWord] = useState('')
  const [targetWord, setTargetWord] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!startWord.trim() || !targetWord.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await api.admin.setSchedule('chainapan', {
        date,
        startWord: startWord.trim().toUpperCase(),
        targetWord: targetWord.trim().toUpperCase(),
      })
      onSaved(res.entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <form className="schedule-form" onSubmit={(e) => void submit(e)}>
      <div className="schedule-chainapan-inputs">
        <input
          type="text"
          maxLength={4}
          placeholder="Départ (4 lettres)"
          value={startWord}
          onChange={(e) => setStartWord(e.target.value.toUpperCase())}
          className="schedule-input schedule-input-short"
          autoFocus
        />
        <span className="schedule-arrow">→</span>
        <input
          type="text"
          maxLength={4}
          placeholder="Cible (4 lettres)"
          value={targetWord}
          onChange={(e) => setTargetWord(e.target.value.toUpperCase())}
          className="schedule-input schedule-input-short"
        />
      </div>
      {error && <span className="schedule-error">{error}</span>}
      <div className="schedule-form-actions">
        <button type="submit" className="admin-btn-approve" disabled={loading || !startWord.trim() || !targetWord.trim()}>Enregistrer</button>
        <button type="button" className="admin-btn-page" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}

function PolitikiForm({ date, onSaved, onCancel }: { date: string; onSaved: (entry: ScheduledEntry) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PoliticsSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await api.politics.search(query)
        setResults(r.slice(0, 6))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  async function pick(p: PoliticsSearchResult) {
    setLoading(true)
    setError('')
    try {
      const res = await api.admin.setSchedule('politeki', { date, politicianIndex: p.index })
      onSaved(res.entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <div className="schedule-form">
      <input
        type="text"
        placeholder="Rechercher un politicien…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="schedule-input"
        autoFocus
        disabled={loading}
      />
      {searching && <span className="schedule-searching">Recherche…</span>}
      {results.length > 0 && (
        <ul className="schedule-search-results">
          {results.map((p) => (
            <li key={p.index}>
              <button
                type="button"
                className="schedule-result-btn"
                onClick={() => void pick(p)}
                disabled={loading}
              >
                {p.prenom} {p.nom}
                {p.currentOrLastParti && <span className="schedule-result-sub">{p.currentOrLastParti}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="schedule-error">{error}</span>}
      <div className="schedule-form-actions">
        <button type="button" className="admin-btn-page" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  )
}

function CinemaxdForm({ date, onSaved, onCancel }: { date: string; onSaved: (entry: ScheduledEntry) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbFilmResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchFilms(query)
        setResults(r.slice(0, 6))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  async function pick(film: TmdbFilmResult) {
    setLoading(true)
    setError('')
    try {
      const res = await api.admin.setSchedule('cinemaxd', { date, tmdbId: film.tmdbId })
      onSaved(res.entry)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <div className="schedule-form">
      <input
        type="text"
        placeholder="Rechercher un film…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="schedule-input"
        autoFocus
        disabled={loading}
      />
      {searching && <span className="schedule-searching">Recherche…</span>}
      {results.length > 0 && (
        <ul className="schedule-search-results">
          {results.map((f) => (
            <li key={f.tmdbId}>
              <button
                type="button"
                className="schedule-result-btn"
                onClick={() => void pick(f)}
                disabled={loading}
              >
                {f.titre}
                {f.annee && <span className="schedule-result-sub">{f.annee}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="schedule-error">{error}</span>}
      <div className="schedule-form-actions">
        <button type="button" className="admin-btn-page" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  )
}

function ScheduleForm({
  game,
  date,
  onSaved,
  onCancel,
}: {
  game: GameKey
  date: string
  onSaved: (entry: ScheduledEntry) => void
  onCancel: () => void
}) {
  if (game === 'yearbox') return <YearboxForm date={date} onSaved={onSaved} onCancel={onCancel} />
  if (game === 'motivex') return <MotivexForm date={date} onSaved={onSaved} onCancel={onCancel} />
  if (game === 'chainapan') return <ChainapanForm date={date} onSaved={onSaved} onCancel={onCancel} />
  if (game === 'politeki') return <PolitikiForm date={date} onSaved={onSaved} onCancel={onCancel} />
  if (game === 'cinemaxd') return <CinemaxdForm date={date} onSaved={onSaved} onCancel={onCancel} />
  return null
}

function ScheduleSection() {
  const [game, setGame] = useState<GameKey>('yearbox')
  const [entries, setEntries] = useState<Record<string, ScheduledEntry>>({})
  const [loading, setLoading] = useState(false)
  const [showSolutions, setShowSolutions] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)

  const days = getDaysRange(30)

  async function fetchSchedule(g: GameKey) {
    setLoading(true)
    setEntries({})
    try {
      const data = await api.admin.getSchedule(g)
      const map: Record<string, ScheduledEntry> = {}
      for (const e of data.entries) map[e.date] = e
      setEntries(map)
    } catch {
      setEntries({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setEditingDate(null)
    void fetchSchedule(game)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  function handleSaved(entry: ScheduledEntry) {
    setEntries((prev) => ({ ...prev, [entry.date]: entry }))
    setEditingDate(null)
  }

  async function handleDelete(date: string) {
    setDeletingDate(date)
    try {
      await api.admin.deleteSchedule(game, date)
      setEntries((prev) => {
        const next = { ...prev }
        delete next[date]
        return next
      })
    } catch {
      // ignore
    } finally {
      setDeletingDate(null)
    }
  }

  return (
    <section className="admin-section" style={{ marginTop: '1.5rem' }}>
      <h2 className="admin-section-title">Planning des jeux</h2>

      <div className="admin-tabs">
        {SCHEDULE_GAMES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`admin-tab${game === key ? ' admin-tab-active' : ''}`}
            onClick={() => setGame(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="schedule-reveal-row">
        <label className="schedule-reveal-label">
          <input
            type="checkbox"
            checked={showSolutions}
            onChange={(e) => setShowSolutions(e.target.checked)}
          />
          Afficher les solutions
        </label>
      </div>

      {loading ? (
        <p className="admin-loading">Chargement…</p>
      ) : (
        <div className="schedule-list">
          {days.map((date) => {
            const entry = entries[date]
            const isEditing = editingDate === date
            const isDeleting = deletingDate === date

            return (
              <div key={date} className={`schedule-row${entry ? ' schedule-row-filled' : ''}`}>
                <div className="schedule-row-header">
                  <span className="schedule-date">{date}</span>
                  {entry ? (
                    <span
                      className={`schedule-label${showSolutions ? ' schedule-label-visible' : ''}`}
                    >
                      {entry.label}
                    </span>
                  ) : (
                    <span className="schedule-empty">— non programmé</span>
                  )}
                  <div className="schedule-row-actions">
                    <button
                      type="button"
                      className="schedule-btn-edit"
                      onClick={() => setEditingDate(isEditing ? null : date)}
                    >
                      {isEditing ? 'Fermer' : entry ? 'Modifier' : 'Ajouter'}
                    </button>
                    {entry && (
                      <button
                        type="button"
                        className="schedule-btn-delete"
                        onClick={() => void handleDelete(date)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? '…' : 'Suppr.'}
                      </button>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <ScheduleForm
                    game={game}
                    date={date}
                    onSaved={handleSaved}
                    onCancel={() => setEditingDate(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [suggestions, setSuggestions] = useState<YearboxEventSuggestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const PAGE_SIZE = 20

  async function fetchSuggestions() {
    setLoading(true)
    try {
      const data = await api.admin.getSuggestions(statusFilter, page)
      setSuggestions(data.suggestions)
      setTotal(data.total)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.isAdmin) void fetchSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, user])

  if (authLoading) {
    return (
      <div className="admin-shell">
        <p className="admin-loading">Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="admin-shell">
        <p className="admin-denied">Connecte-toi pour accéder à cette page.</p>
      </div>
    )
  }

  if (!user.isAdmin) {
    return (
      <div className="admin-shell">
        <p className="admin-denied">Accès refusé.</p>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <h1 className="admin-title">Backoffice</h1>

      <section className="admin-section">
        <h2 className="admin-section-title">Suggestions Yearbox</h2>

        <div className="admin-tabs">
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`admin-tab${statusFilter === s ? ' admin-tab-active' : ''}`}
              onClick={() => { setStatusFilter(s); setPage(1) }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="admin-loading">Chargement…</p>
        ) : suggestions.length === 0 ? (
          <p className="admin-empty">Aucune suggestion {STATUS_LABELS[statusFilter].toLowerCase()}.</p>
        ) : (
          <div className="admin-suggestions-list">
            {suggestions.map((s) => (
              <SuggestionRow
                key={s.id}
                suggestion={s}
                onReviewed={() => void fetchSuggestions()}
              />
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="admin-pagination">
            <button
              type="button"
              className="admin-btn-page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ←
            </button>
            <span className="admin-page-info">Page {page} / {Math.ceil(total / PAGE_SIZE)}</span>
            <button
              type="button"
              className="admin-btn-page"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / PAGE_SIZE)}
            >
              →
            </button>
          </div>
        )}
      </section>

      <ScheduleSection />
    </div>
  )
}
