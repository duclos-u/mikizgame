import confetti from 'canvas-confetti'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type YearboxCible,
  type YearboxDirection,
  type YearboxDomain,
  type YearboxFact,
  type YearboxStatus,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { STORAGE_KEYS } from '../../constants/storage'
import { useAuth } from '../../context/AuthContext'
import { useMilestoneToast } from '../../context/MilestoneToastContext'
import { today } from '../../utils/date'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_GUESSES = 5
const RANK_POINTS = [25, 18, 15, 12, 10]

const DOMAIN_ICON: Record<string, string> = {
  cinema: '🎬',
  musique: '🎵',
  sport: '⚽',
  politique: '🏛️',
  tech: '💻',
}

const DOMAIN_LABEL: Record<string, string> = {
  cinema: 'Cinéma',
  musique: 'Musique',
  sport: 'Sport',
  politique: 'Politique',
  tech: 'Technologie',
}

const DOMAIN_COLOR: Record<string, string> = {
  cinema: 'oklch(0.62 0.16 292)',
  musique: 'oklch(0.60 0.18 290)',
  sport: 'oklch(0.60 0.18 145)',
  politique: 'oklch(0.56 0.20 22)',
  tech: 'oklch(0.55 0.16 230)',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GuessEntry = { year: number; direction: YearboxDirection }

type LocalState = {
  guesses: GuessEntry[]
  factsRevealed: YearboxFact[]
  statut: YearboxStatus
  cible: YearboxCible | null
}

// ─── localStorage ─────────────────────────────────────────────────────────────

function loadLocal(): LocalState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.YEARBOX_STATE(today()))
    if (!raw) return null
    return JSON.parse(raw) as LocalState
  } catch {
    return null
  }
}

function saveLocal(s: LocalState) {
  try {
    localStorage.setItem(STORAGE_KEYS.YEARBOX_STATE(today()), JSON.stringify(s))
  } catch {}
}

// ─── Fact card ────────────────────────────────────────────────────────────────

function FactCard({ fact, animate }: { fact: YearboxFact; animate?: boolean }) {
  return (
    <div
      className={`yearbox-fact${animate ? ' yearbox-fact-reveal' : ''}`}
      style={{ borderLeftColor: DOMAIN_COLOR[fact.domain] ?? 'oklch(0.6 0.1 240)' }}
    >
      <div className="yearbox-fact-header">
        <span className="yearbox-fact-icon">{DOMAIN_ICON[fact.domain] ?? '📌'}</span>
        <span className="yearbox-fact-domain">{DOMAIN_LABEL[fact.domain] ?? fact.domain}</span>
      </div>
      <p className="yearbox-fact-text">{fact.text}</p>
    </div>
  )
}

// ─── Guess row ────────────────────────────────────────────────────────────────

function GuessRow({ entry, num }: { entry: GuessEntry; num: number }) {
  const { year, direction } = entry
  const isExact = direction === 'exact'
  const arrow = direction === 'trop-tot' ? '↑' : direction === 'trop-tard' ? '↓' : '✓'
  const label = direction === 'trop-tot' ? 'Trop tôt' : direction === 'trop-tard' ? 'Trop tard' : 'Exact !'
  const color = isExact
    ? 'oklch(0.74 0.14 150)'
    : 'oklch(0.72 0.10 28)'

  return (
    <div className="yearbox-guess-row">
      <span className="yearbox-guess-num">{num}</span>
      <span className="yearbox-guess-year">{year}</span>
      <span
        className="yearbox-guess-badge"
        style={{ background: color, color: '#fff' }}
      >
        {arrow} {label}
      </span>
    </div>
  )
}

// ─── Suggestion form ──────────────────────────────────────────────────────────

type SuggestState = 'idle' | 'open' | 'loading' | 'done' | 'error'

const DOMAINS: { value: YearboxDomain; label: string }[] = [
  { value: 'cinema', label: 'Cinéma' },
  { value: 'musique', label: 'Musique' },
  { value: 'sport', label: 'Sport' },
  { value: 'politique', label: 'Politique' },
  { value: 'tech', label: 'Technologie' },
]

function SuggestionForm({ targetYear }: { targetYear: number | null }) {
  const currentYear = new Date().getFullYear()
  const [state, setState] = useState<SuggestState>('idle')
  const [domain, setDomain] = useState<YearboxDomain>('cinema')
  const [year, setYear] = useState(String(targetYear ?? ''))
  const [text, setText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const y = parseInt(year, 10)
    if (Number.isNaN(y) || y < 1900 || y > currentYear) {
      setErrorMsg(`Année invalide (1900–${currentYear}).`)
      return
    }
    if (text.trim().length === 0) {
      setErrorMsg('Le texte ne peut pas être vide.')
      return
    }
    setState('loading')
    try {
      await api.yearbox.suggest({ year: y, domain, text: text.trim() })
      setState('done')
    } catch {
      setErrorMsg('Une erreur est survenue.')
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        className="yearbox-suggest-toggle"
        onClick={() => setState('open')}
      >
        Suggérer un événement +
      </button>
    )
  }

  if (state === 'done') {
    return <p className="yearbox-suggest-done">Merci pour ta suggestion !</p>
  }

  return (
    <form className="yearbox-suggest-form" onSubmit={(e) => void handleSubmit(e)}>
      <p className="yearbox-suggest-label">Suggérer un événement pour une année</p>
      <div className="yearbox-suggest-row">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value as YearboxDomain)}
          className="yearbox-suggest-select"
        >
          {DOMAINS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <input
          type="number"
          min={1900}
          max={currentYear}
          value={year}
          onChange={(e) => { setYear(e.target.value); setErrorMsg('') }}
          placeholder="Année"
          className="yearbox-suggest-year"
        />
      </div>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setErrorMsg('') }}
        placeholder="Décris l'événement en une phrase…"
        maxLength={500}
        rows={2}
        className="yearbox-suggest-text"
      />
      {(state === 'error' || errorMsg) && (
        <p className="yearbox-error">{errorMsg}</p>
      )}
      <button
        type="submit"
        className="yearbox-btn-secondary"
        disabled={state === 'loading'}
      >
        {state === 'loading' ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  )
}

// ─── Result modal ─────────────────────────────────────────────────────────────

function ResultModal({
  statut,
  cible,
  guesses,
  onClose,
}: {
  statut: YearboxStatus
  cible: YearboxCible | null
  guesses: GuessEntry[]
  onClose: () => void
}) {
  const { user } = useAuth()
  const [shared, setShared] = useState(false)
  const won = statut === 'won'
  const points = won ? (RANK_POINTS[guesses.length - 1] ?? 1) : 0

  function share() {
    const lines = guesses.map((g) => {
      if (g.direction === 'exact') return `${g.year} ✅`
      return `${g.year} ${g.direction === 'trop-tot' ? '↑ Trop tôt' : '↓ Trop tard'}`
    })
    const head = `Yearbox 📅 ${won ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}`
    try {
      navigator.clipboard.writeText(`${head}\n${lines.join('\n')}`)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  return (
    <div className="yearbox-modal-overlay" onClick={onClose}>
      <div
        className="yearbox-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="yearbox-modal-title"
          style={{ color: won ? 'oklch(0.55 0.13 150)' : 'oklch(0.58 0.18 25)' }}
        >
          {won ? 'Bonne année ! 🎉' : 'Raté…'}
        </div>

        <div className="yearbox-modal-points">
          <span className="yearbox-modal-points-value">{points}</span>
          <span className="yearbox-modal-points-label">pts</span>
          {won && (
            <span className="yearbox-modal-points-detail">
              en {guesses.length} essai{guesses.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {cible && (
          <div className="yearbox-modal-answer">
            <div className="yearbox-modal-year">{cible.year}</div>
            <div className="yearbox-modal-facts">
              {cible.facts.map((f, i) => (
                <div key={i} className="yearbox-modal-fact-line">
                  <span>{DOMAIN_ICON[f.domain]}</span>
                  <span>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="yearbox-modal-actions">
          <button type="button" className="yearbox-btn-secondary" onClick={share}>
            {shared ? 'Copié ✓' : 'Partager'}
          </button>
          <a href="/leaderboard" className="yearbox-btn-secondary">
            Classement
          </a>
        </div>

        {user && (
          <div className="yearbox-suggest-section">
            <SuggestionForm targetYear={cible?.year ?? null} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Yearbox() {
  const { token, loading: authLoading } = useAuth()
  const { notifyMilestone } = useMilestoneToast()

  const [guesses, setGuesses] = useState<GuessEntry[]>([])
  const [factsRevealed, setFactsRevealed] = useState<YearboxFact[]>([])
  const [statut, setStatut] = useState<YearboxStatus>('in_progress')
  const [cible, setCible] = useState<YearboxCible | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [yearInput, setYearInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [newFactCount, setNewFactCount] = useState(0)

  const initialized = useRef(false)
  const gameOver = statut !== 'in_progress'

  const persist = useCallback(
    (g: GuessEntry[], f: YearboxFact[], s: YearboxStatus, c: YearboxCible | null) => {
      saveLocal({ guesses: g, factsRevealed: f, statut: s, cible: c })
    },
    [],
  )

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const local = loadLocal()
    if (local) {
      setGuesses(local.guesses)
      setFactsRevealed(local.factsRevealed)
      setStatut(local.statut)
      setCible(local.cible)
      setLoading(false)

      api.yearbox
        .session()
        .then(({ session }) => {
          if (!session) return
          const synced: GuessEntry[] = session.guesses.map((y) => {
            const existing = local.guesses.find((g) => g.year === y)
            if (existing) return existing
            return {
              year: y,
              direction:
                y === session.cible?.year
                  ? 'exact'
                  : y < (session.cible?.year ?? 0)
                    ? 'trop-tot'
                    : 'trop-tard',
            }
          })
          setGuesses(synced)
          setFactsRevealed(session.factsRevealed)
          setStatut(session.statut)
          setCible(session.cible)
          persist(synced, session.factsRevealed, session.statut, session.cible)
        })
        .catch(() => {})
      return
    }

    const loadInitial = async () => {
      try {
        const { session } = await api.yearbox.session()
        if (session) {
          const recovered: GuessEntry[] = session.guesses.map((y) => ({
            year: y,
            direction:
              y === session.cible?.year
                ? 'exact'
                : y < (session.cible?.year ?? 0)
                  ? 'trop-tot'
                  : 'trop-tard',
          }))
          setGuesses(recovered)
          setFactsRevealed(session.factsRevealed)
          setStatut(session.statut)
          setCible(session.cible)
          persist(recovered, session.factsRevealed, session.statut, session.cible)
          return
        }
        const { factsRevealed: initial } = await api.yearbox.daily()
        setFactsRevealed(initial)
      } catch {}
    }

    loadInitial().finally(() => setLoading(false))
  }, [persist])

  // ── Guess submission ──────────────────────────────────────────────────────

  const handleGuess = useCallback(async () => {
    if (gameOver || submitting) return
    const year = parseInt(yearInput, 10)
    if (Number.isNaN(year) || year < 1900 || year > 2030) {
      setError('Saisis une année valide entre 1900 et 2030.')
      return
    }
    if (guesses.some((g) => g.year === year)) {
      setError('Tu as déjà proposé cette année.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await api.yearbox.guess(year)

      const newEntry: GuessEntry = { year, direction: result.direction }
      const newGuesses = [...guesses, newEntry]

      const prevFactCount = factsRevealed.length
      const nextFactCount = result.factsRevealed.length
      setNewFactCount(Math.max(0, nextFactCount - prevFactCount))

      const newStatut = result.statut

      setGuesses(newGuesses)
      setFactsRevealed(result.factsRevealed)
      setStatut(newStatut)
      setCible(result.cible)
      setYearInput('')
      persist(newGuesses, result.factsRevealed, newStatut, result.cible)

      if (result.streakMilestone) notifyMilestone(result.streakMilestone)

      if (newStatut === 'won') {
        confetti({ particleCount: 170, spread: 72, origin: { y: 0.6 } })
        setTimeout(() => setShowModal(true), 1050)
      } else if (newStatut === 'lost') {
        setTimeout(() => setShowModal(true), 650)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        msg.toLowerCase().includes('configuré')
          ? "Aucun puzzle configuré pour aujourd'hui."
          : 'Une erreur est survenue. Réessaie.',
      )
    } finally {
      setSubmitting(false)
    }
  }, [gameOver, submitting, yearInput, guesses, factsRevealed, persist, notifyMilestone])

  // ── Dev reset ─────────────────────────────────────────────────────────────

  async function handleReset() {
    try {
      if (token) await api.yearbox.reset()
      localStorage.removeItem(STORAGE_KEYS.YEARBOX_STATE(today()))
    } catch {}

    const { factsRevealed: initial } = await api.yearbox.daily().catch(() => ({ factsRevealed: [] }))
    setGuesses([])
    setFactsRevealed(initial)
    setStatut('in_progress')
    setCible(null)
    setShowModal(false)
    setError(null)
    setYearInput('')
    setNewFactCount(0)
  }

  // ─────────────────────────────────────────────────────────────────────────

  const guessCount = guesses.length
  const guessesLeft = MAX_GUESSES - guessCount

  let message = ''
  let messageColor = 'oklch(0.48 0.02 62)'
  if (statut === 'won') {
    message = `Bravo ! C'était ${cible?.year ?? '…'}.`
    messageColor = 'oklch(0.55 0.13 150)'
  } else if (statut === 'lost') {
    message = `Raté… C'était ${cible?.year ?? '…'}.`
    messageColor = 'oklch(0.58 0.18 25)'
  } else if (guessCount > 0) {
    message = `${guessesLeft} essai${guessesLeft > 1 ? 's' : ''} restant${guessesLeft > 1 ? 's' : ''}.`
  }

  if (!authLoading && !token) {
    return (
      <div className="game-shell">
        <GameHeader title="Yearbox" subtitle="Devine l'année mystère en 5 essais" />
        <main className="container">
          <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: '3rem' }}>
            Connecte-toi pour jouer.
          </p>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="game-shell">
        <GameHeader title="Yearbox" subtitle="Devine l'année mystère en 5 essais" />
        <main className="container">
          <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: '3rem' }}>
            Chargement…
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="game-shell">
      <GameHeader title="Yearbox" subtitle="Devine l'année mystère en 5 essais" />

      <main className="container">
        <div className="yearbox-game">

          {/* ── Facts ────────────────────────────────────────────────────── */}
          <section className="yearbox-facts">
            <div className="yearbox-facts-title">
              <span>Indices</span>
              <span className="yearbox-facts-count">{factsRevealed.length} / 5</span>
            </div>
            <div className="yearbox-facts-list">
              {factsRevealed.map((fact, i) => (
                <FactCard
                  key={`${fact.domain}-${i}`}
                  fact={fact}
                  animate={i >= factsRevealed.length - newFactCount}
                />
              ))}
            </div>
          </section>

          {/* ── Status ───────────────────────────────────────────────────── */}
          {(guessCount > 0 || statut !== 'in_progress') && (
            <div className="yearbox-status">
              <span style={{ fontSize: '14.5px', fontWeight: 600, color: messageColor }}>
                {message}
              </span>
              <div className="yearbox-dots">
                {Array.from({ length: MAX_GUESSES }, (_, i) => (
                  <span
                    key={i}
                    className="yearbox-dot"
                    style={{
                      background: i < guessCount ? 'oklch(0.62 0.17 60)' : 'oklch(0.885 0.014 80)',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Input ────────────────────────────────────────────────────── */}
          {!gameOver && (
            <div className="yearbox-input-wrap">
              <div className="yearbox-input-row">
                <input
                  type="number"
                  min={1900}
                  max={2030}
                  value={yearInput}
                  onChange={(e) => {
                    setYearInput(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleGuess()
                    }
                  }}
                  placeholder="Ex. 1994"
                  disabled={submitting}
                  className="yearbox-input"
                />
                <button
                  type="button"
                  onClick={() => void handleGuess()}
                  disabled={submitting || yearInput.trim() === ''}
                  className="yearbox-btn-primary"
                >
                  Deviner
                </button>
              </div>
              {error && <p className="yearbox-error">{error}</p>}
            </div>
          )}

          {/* ── Guess history ─────────────────────────────────────────────── */}
          {guessCount > 0 && (
            <div className="yearbox-history">
              <div className="yearbox-history-title">Tes propositions</div>
              {[...guesses].reverse().map((entry, i) => (
                <GuessRow key={entry.year} entry={entry} num={guesses.length - i} />
              ))}
            </div>
          )}

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="yearbox-footer">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Une nouvelle année à deviner chaque jour.
            </span>
            {import.meta.env.DEV && (
              <button type="button" className="yearbox-dev-reset" onClick={() => void handleReset()}>
                [dev] réinitialiser
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && statut !== 'in_progress' && (
        <ResultModal
          statut={statut}
          cible={cible}
          guesses={guesses}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
