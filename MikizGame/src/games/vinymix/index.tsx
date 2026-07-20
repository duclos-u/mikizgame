import confetti from 'canvas-confetti'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type VinymixArtist,
  type VinymixGuess,
  type VinymixStatus,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { useAuth } from '../../context/AuthContext'
import { STORAGE_KEYS } from '../../constants/storage'
import { today } from '../../utils/date'
import { artistColors } from '../../utils/artistColors'
import { ArtistSearchBar } from './ArtistSearchBar'
import { GuessHistoryTable } from './GuessHistoryTable'
import { PersonaBoard } from './PersonaBoard'
import { ResultModal } from './ResultModal'

const MAX_GUESSES = 6

// ─── localStorage persistence ─────────────────────────────────────────────────

function todayKey() {
  return STORAGE_KEYS.VINYMIX_STATE(today())
}

type LocalState = {
  guesses: VinymixGuess[]
  status: VinymixStatus
  targetArtist: VinymixArtist | null
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
    return Number(localStorage.getItem(STORAGE_KEYS.VINYMIX_STREAK) ?? 0)
  } catch {
    return 0
  }
}

function updateStreak(won: boolean): number {
  try {
    const prev = loadStreak()
    const next = won ? prev + 1 : 0
    localStorage.setItem(STORAGE_KEYS.VINYMIX_STREAK, String(next))
    return next
  } catch {
    return 0
  }
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function HeroCard({
  status,
  guesses,
  targetArtist,
}: {
  status: VinymixStatus
  guesses: VinymixGuess[]
  targetArtist: VinymixArtist | null
}) {
  const used = guesses.length
  const playing = status === 'in_progress'

  let kicker = 'Artiste mystère'
  let title = 'Qui se cache derrière le vinyle ?'
  let initial = '?'
  let labelBg = 'rgba(255,255,255,0.94)'
  let labelFg = 'oklch(0.62 0.18 42)'

  if (targetArtist && status !== 'in_progress') {
    const c = artistColors(targetArtist.name)
    initial = targetArtist.name[0]
    labelBg = c.avBg
    labelFg = c.avFg
    if (status === 'won') {
      kicker = `Trouvé en ${used} essai${used > 1 ? 's' : ''}`
      title = `C'est ${targetArtist.name} !`
    } else {
      kicker = "Raté pour aujourd'hui"
      title = `C'était ${targetArtist.name}`
    }
  }

  const pips = Array.from({ length: MAX_GUESSES }, (_, i) => {
    if (i >= used) return 'rgba(255,255,255,0.35)'
    if (status === 'won' && i === used - 1) return 'oklch(0.84 0.13 150)'
    return '#fff'
  })

  return (
    <div className="vinymix-hero">
      <div className="vinymix-hero-vinyl">
        <div className="vinymix-hero-vinyl-label" style={{ background: labelBg, color: labelFg }}>
          {initial}
        </div>
      </div>
      <div className="vinymix-hero-content">
        <div className="vinymix-hero-kicker">{kicker}</div>
        <h2 className="vinymix-hero-title">{title}</h2>
        <div className="vinymix-hero-bottom">
          <div className="vinymix-hero-pips">
            {pips.map((color, i) => (
              <span key={i} className="vinymix-hero-pip" style={{ background: color }} />
            ))}
          </div>
          <span className="vinymix-hero-counter">
            {used}
            <span className="vinymix-hero-counter-max">/{MAX_GUESSES} essais</span>
          </span>
          {playing && (
            <div className="vinymix-hero-eq" aria-hidden="true">
              <span className="vinymix-hero-eq-bar" style={{ animationDelay: '0s' }} />
              <span className="vinymix-hero-eq-bar" style={{ animationDelay: '0.15s' }} />
              <span className="vinymix-hero-eq-bar" style={{ animationDelay: '0.3s' }} />
              <span className="vinymix-hero-eq-bar" style={{ animationDelay: '0.45s' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children, streak }: { children: React.ReactNode; streak: number }) {
  return (
    <div className="game-shell">
      <GameHeader
        title="Vinymix"
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
        <div className="vinymix-game">{children}</div>
      </main>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Vinymix() {
  const { token } = useAuth()

  const [guesses, setGuesses] = useState<VinymixGuess[]>([])
  const [status, setStatus] = useState<VinymixStatus>('in_progress')
  const [targetArtist, setTargetArtist] = useState<VinymixArtist | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [streak, setStreak] = useState(loadStreak)
  const [guessError, setGuessError] = useState<string | null>(null)

  const initialized = useRef(false)
  const gameOver = status !== 'in_progress'

  const persist = useCallback((g: VinymixGuess[], s: VinymixStatus, t: VinymixArtist | null) => {
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
      setLoading(false)

      if (token) {
        api.vinymix
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
      api.vinymix
        .session()
        .then(({ session }) => {
          if (session) {
            setGuesses(session.guesses)
            setStatus(session.status)
            setTargetArtist(session.targetArtist)
            persist(session.guesses, session.status, session.targetArtist)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token, persist])

  // ── Guess submission ──────────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (artistId: string) => {
      if (gameOver || submitting) return

      if (!token && guesses.length >= MAX_GUESSES) return

      setSubmitting(true)
      setGuessError(null)

      try {
        const result = await api.vinymix.guess(artistId)

        const newGuesses = [...guesses, result.guess]

        let newStatus = result.status
        let resolvedTarget = result.targetArtist
        if (!token) {
          const correct = result.status === 'won'
          const lost = !correct && newGuesses.length >= MAX_GUESSES
          newStatus = correct ? 'won' : lost ? 'lost' : 'in_progress'
          // Fetch the daily artist for guests on computed loss (backend withholds it until then)
          if (newStatus === 'lost' && !resolvedTarget) {
            resolvedTarget = await api.vinymix.today().then((r) => r.targetArtist).catch(() => null)
          }
        }

        setGuesses(newGuesses)
        setStatus(newStatus)
        setTargetArtist(resolvedTarget)
        persist(newGuesses, newStatus, resolvedTarget)

        if (newStatus === 'won') {
          const newStreak = updateStreak(true)
          setStreak(newStreak)
          confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } })
          setTimeout(() => setShowModal(true), 1200)
        } else if (newStatus === 'lost') {
          updateStreak(false)
          setStreak(0)
          setTimeout(() => setShowModal(true), 800)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setGuessError(msg.includes('503') || msg.toLowerCase().includes('configuré')
          ? "Aucun artiste configuré pour aujourd'hui. Demande à l'admin de lancer le scheduling."
          : "Une erreur est survenue. Réessaie.")
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
      if (token) await api.vinymix.reset()
      localStorage.removeItem(todayKey())
      setGuesses([])
      setStatus('in_progress')
      setTargetArtist(null)
      setShowModal(false)
    } catch {
      // ignore reset error
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
      <HeroCard status={status} guesses={guesses} targetArtist={targetArtist} />
      <PersonaBoard guesses={guesses} targetArtist={targetArtist} />

      {!gameOver && (
        <>
          <ArtistSearchBar
            onGuess={handleGuess}
            disabled={submitting}
            alreadyGuessed={guessedIds}
          />
          {guessError && (
            <p className="vinymix-error">{guessError}</p>
          )}
        </>
      )}

      {gameOver && !showModal && (
        <div className="vinymix-gameover-actions">
          <button
            type="button"
            className="vinymix-btn-primary"
            onClick={() => setShowModal(true)}
          >
            Voir le résultat
          </button>
        </div>
      )}

      {guesses.length > 0 && (
        <div className="vinymix-legend">
          <span className="vinymix-legend-item">
            <span className="vinymix-legend-swatch match" />
            Correct
          </span>
          <span className="vinymix-legend-item">
            <span className="vinymix-legend-swatch close" />
            Proche
          </span>
          <span className="vinymix-legend-item">
            <span className="vinymix-legend-swatch miss" />
            Incorrect
          </span>
          <span className="vinymix-legend-item">
            <span className="vinymix-legend-arrow">↑↓</span>
            direction
          </span>
        </div>
      )}

      <GuessHistoryTable guesses={guesses} />

      <div className="vinymix-footer">
        <Link to="/" className="vinymix-back-link">
          ← Retour aux jeux
        </Link>
        {import.meta.env.DEV && (
          <button
            type="button"
            className="vinymix-dev-reset"
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? '…' : '[dev] réinitialiser'}
          </button>
        )}
      </div>

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
