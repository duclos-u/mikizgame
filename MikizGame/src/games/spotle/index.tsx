import confetti from 'canvas-confetti'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type SpotleArtist,
  type SpotleGuess,
  type SpotleStatus,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { useAuth } from '../../context/AuthContext'
import { ArtistSearchBar } from './ArtistSearchBar'
import { GuessHistoryTable } from './GuessHistoryTable'
import { ResultModal } from './ResultModal'

const MAX_GUESSES = 6

const CLUE_LABELS: Record<string, string> = {
  creationYear: 'Année',
  memberCount: 'Membres',
  popularity: 'Popularité',
  genres: 'Genres',
  country: 'Pays',
  vocalType: 'Voix',
  language: 'Langue',
  soundtrack: 'Collab',
  famousSong: 'Hit',
  instrumentation: 'Son',
}

// ─── localStorage persistence ─────────────────────────────────────────────────

function todayKey() {
  return `spotlestate_${new Date().toISOString().slice(0, 10)}`
}

type LocalState = {
  guesses: SpotleGuess[]
  status: SpotleStatus
  targetArtist: SpotleArtist | null
}

function loadLocal(): LocalState | null {
  try {
    const raw = localStorage.getItem(todayKey())
    if (!raw) return null
    return JSON.parse(raw) as LocalState
  } catch {
    return null
  }
}

function saveLocal(state: LocalState) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(state))
  } catch {
    // localStorage unavailable in private browsing
  }
}

// ─── Streak persistence ───────────────────────────────────────────────────────

function loadStreak(): number {
  try {
    return Number(localStorage.getItem('spotle_streak') ?? 0)
  } catch {
    return 0
  }
}

function updateStreak(won: boolean): number {
  try {
    const prev = loadStreak()
    const next = won ? prev + 1 : 0
    localStorage.setItem('spotle_streak', String(next))
    return next
  } catch {
    return 0
  }
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children, streak }: { children: React.ReactNode; streak: number }) {
  return (
    <div className="game-shell">
      <GameHeader
        title="Spotle"
        subtitle="Devine l'artiste du jour en 6 essais"
        trailing={
          streak > 0 ? (
            <span className="streak-chip">
              <span className="streak-flame">🔥</span>
              <span className="streak-num">{streak}</span>
            </span>
          ) : undefined
        }
      />
      <main className="container">
        <div className="spotle-game">{children}</div>
      </main>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Spotle() {
  const { token } = useAuth()

  const [guesses, setGuesses] = useState<SpotleGuess[]>([])
  const [status, setStatus] = useState<SpotleStatus>('in_progress')
  const [targetArtist, setTargetArtist] = useState<SpotleArtist | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [streak, setStreak] = useState(loadStreak)

  const initialized = useRef(false)
  const gameOver = status !== 'in_progress'

  const persist = useCallback((g: SpotleGuess[], s: SpotleStatus, t: SpotleArtist | null) => {
    saveLocal({ guesses: g, status: s, targetArtist: t })
  }, [])

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const local = loadLocal()
    if (local) {
      setGuesses(local.guesses)
      setStatus(local.status)
      setTargetArtist(local.targetArtist)
      setStreak(loadStreak())
      if (local.status === 'won') setMessage('Bravo, tu as trouvé l\'artiste !')
      else if (local.status === 'lost')
        setMessage(`Perdu. L'artiste était : ${local.targetArtist?.name ?? '?'}`)
      else setMessage(`${MAX_GUESSES - local.guesses.length} essai(s) restant(s).`)
      setLoading(false)

      if (token) {
        api.spotle
          .session()
          .then(({ session }) => {
            if (!session) return
            setGuesses(session.guesses)
            setStatus(session.status)
            setTargetArtist(session.targetArtist)
            persist(session.guesses, session.status, session.targetArtist)
          })
          .catch(() => {})
      }
      return
    }

    if (token) {
      api.spotle
        .session()
        .then(({ session }) => {
          if (!session) {
            setMessage(`${MAX_GUESSES} essais pour trouver l'artiste.`)
          } else {
            setGuesses(session.guesses)
            setStatus(session.status)
            setTargetArtist(session.targetArtist)
            persist(session.guesses, session.status, session.targetArtist)
            if (session.status === 'won') setMessage('Bravo, tu as trouvé l\'artiste !')
            else if (session.status === 'lost')
              setMessage(`Perdu. L'artiste était : ${session.targetArtist?.name ?? '?'}`)
            else setMessage(`${session.guessesLeft} essai(s) restant(s).`)
          }
        })
        .catch(() => {
          setMessage(`${MAX_GUESSES} essais pour trouver l'artiste.`)
        })
        .finally(() => setLoading(false))
    } else {
      setMessage(`${MAX_GUESSES} essais pour trouver l'artiste.`)
      setLoading(false)
    }
  }, [token, persist])

  // ── Guess submission ──────────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (artistId: string) => {
      if (gameOver || submitting) return

      // Guest: enforce limit client-side
      if (!token && guesses.length >= MAX_GUESSES) {
        setMessage('Plus d\'essais disponibles.')
        return
      }

      setSubmitting(true)
      setMessage('')

      try {
        const result = await api.spotle.guess(artistId)

        const newGuesses = [...guesses, result.guess]

        // For guests: compute status client-side (server is stateless)
        let newStatus = result.status
        if (!token) {
          const correct = result.status === 'won'
          const lost = !correct && newGuesses.length >= MAX_GUESSES
          newStatus = correct ? 'won' : lost ? 'lost' : 'in_progress'
        }

        setGuesses(newGuesses)
        setStatus(newStatus)
        setTargetArtist(result.targetArtist)
        persist(newGuesses, newStatus, result.targetArtist)

        if (newStatus === 'won') {
          const newStreak = updateStreak(true)
          setStreak(newStreak)
          setMessage('Bravo, tu as trouvé l\'artiste !')
          confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } })
          setTimeout(() => setShowModal(true), 1200)
        } else if (newStatus === 'lost') {
          updateStreak(false)
          setStreak(0)
          setMessage(`Perdu. L'artiste était : ${result.targetArtist?.name ?? '?'}`)
          setTimeout(() => setShowModal(true), 800)
        } else {
          const left = token ? result.guessesLeft : MAX_GUESSES - newGuesses.length
          setMessage(`${left} essai(s) restant(s).`)
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Erreur réseau')
      } finally {
        setSubmitting(false)
      }
    },
    [gameOver, submitting, token, guesses, persist],
  )

  // ── Dev reset ─────────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      if (token) await api.spotle.reset()
      localStorage.removeItem(todayKey())
      setGuesses([])
      setStatus('in_progress')
      setTargetArtist(null)
      setShowModal(false)
      setMessage(`${MAX_GUESSES} essais pour trouver l'artiste.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur reset')
    } finally {
      setResetting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Shell streak={streak}>
        <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
          <p style={{ color: 'var(--muted)' }}>Chargement…</p>
        </div>
      </Shell>
    )
  }

  const guessedIds = guesses.map((g) => g.artist.id)

  return (
    <Shell streak={streak}>
      {/* Status bar */}
      <div className="spotle-status">
        <span className="spotle-message">{message}</span>
        <div className="spotle-status-right">
          <div className="spotle-dots">
            {Array.from({ length: MAX_GUESSES }, (_, i) => (
              <span
                key={i}
                className={`spotle-dot${i < guesses.length ? (status === 'won' && i === guesses.length - 1 ? ' won' : ' used') : ''}`}
              />
            ))}
          </div>
          <span className="spotle-counter">
            {guesses.length} / {MAX_GUESSES}
          </span>
        </div>
      </div>

      {/* Search input */}
      {!gameOver && (
        <ArtistSearchBar
          onGuess={handleGuess}
          disabled={submitting}
          alreadyGuessed={guessedIds}
        />
      )}

      {gameOver && !showModal && (
        <div className="spotle-gameover-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            Voir le résultat
          </button>
        </div>
      )}

      {/* Legend */}
      {guesses.length > 0 && (
        <div className="spotle-legend">
          <span className="spotle-legend-item">
            <span className="spotle-legend-swatch match" />
            Correct
          </span>
          <span className="spotle-legend-item">
            <span className="spotle-legend-swatch close" />
            Proche
          </span>
          <span className="spotle-legend-item">
            <span className="spotle-legend-swatch miss" />
            Incorrect
          </span>
          <span className="spotle-legend-item">
            <span className="spotle-legend-arrow">↑↓</span>
            direction
          </span>
        </div>
      )}

      {/* Guess history table */}
      <GuessHistoryTable guesses={guesses} clueLabels={CLUE_LABELS} />

      {/* Footer */}
      <div className="spotle-footer">
        <Link to="/" className="spotle-back-link">
          ← Retour aux jeux
        </Link>
        {import.meta.env.DEV && (
          <button
            type="button"
            className="spotle-dev-reset"
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? '…' : '[dev] réinitialiser'}
          </button>
        )}
      </div>

      {/* Result modal */}
      {showModal && status !== 'in_progress' && (
        <ResultModal
          status={status}
          guesses={guesses}
          targetArtist={targetArtist}
          onClose={() => setShowModal(false)}
        />
      )}
    </Shell>
  )
}
