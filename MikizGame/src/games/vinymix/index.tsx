import confetti from 'canvas-confetti'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type VinymixArtist,
  type VinymixGuess,
  type VinymixMatchStatus,
  type VinymixStatus,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { GameResultModal } from '../../components/GameResultModal'
import { useAuth } from '../../context/AuthContext'
import { useMilestoneToast } from '../../context/MilestoneToastContext'
import { STORAGE_KEYS } from '../../constants/storage'
import { today } from '../../utils/date'
import { buildShareHeader } from '../../utils/shareText'
import { artistColors } from '../../utils/artistColors'
import { ArtistSearchBar } from './ArtistSearchBar'
import { GuessHistoryTable } from './GuessHistoryTable'
import { PersonaBoard } from './PersonaBoard'

const MAX_GUESSES = 6

const SHARE_EMOJI: Record<VinymixMatchStatus, string> = {
  match: '🟩',
  close: '🟨',
  miss: '⬛',
  info: '🔵',
  unknown: '⬜',
}

const SHARE_COLOR: Record<VinymixMatchStatus, string> = {
  match: 'oklch(0.80 0.13 150)',
  close: 'oklch(0.85 0.14 80)',
  miss: 'oklch(0.88 0.012 80)',
  info: 'oklch(0.78 0.07 252)',
  unknown: 'var(--border)',
}

const GAME_URL = import.meta.env.VITE_APP_URL ?? 'https://mikiz.fr/vinymix'

function buildShareText(status: VinymixStatus, guesses: VinymixGuess[]): string {
  const scoreLine = status === 'won' ? `${guesses.length}/6` : 'X/6'
  const lines = guesses.map((g) => g.clues.map((c) => SHARE_EMOJI[c.status] ?? '⬜').join(''))
  return `${buildShareHeader('vinymix', scoreLine)}\n${lines.join('\n')}\n\n${GAME_URL}`
}

// ─── Countdown to midnight ─────────────────────────────────────────────────

function useCountdown(): string {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function compute() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const diff = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000))
      const h = Math.floor(diff / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setLabel(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      )
    }
    compute()
    const id = setInterval(compute, 1000)
    return () => clearInterval(id)
  }, [])

  return label
}

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
  const { token, loading: authLoading } = useAuth()
  const { notifyMilestone } = useMilestoneToast()
  const countdown = useCountdown()

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
      return
    }

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
  }, [persist])

  // ── Guess submission ──────────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (artistId: string) => {
      if (gameOver || submitting) return

      setSubmitting(true)
      setGuessError(null)

      try {
        const result = await api.vinymix.guess(artistId)

        const newGuesses = [...guesses, result.guess]
        const newStatus = result.status
        const resolvedTarget = result.targetArtist

        setGuesses(newGuesses)
        setStatus(newStatus)
        setTargetArtist(resolvedTarget)
        persist(newGuesses, newStatus, resolvedTarget)

        if (result.streakMilestone) notifyMilestone(result.streakMilestone)

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
    [gameOver, submitting, guesses, persist, notifyMilestone],
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

  if (!authLoading && !token) {
    return (
      <Shell streak={0}>
        <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
          <p style={{ color: 'var(--muted)' }}>Connecte-toi pour jouer.</p>
        </div>
      </Shell>
    )
  }

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

      {gameOver && (
        <div className="game-share-btn-row">
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
            Partager le résultat
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

      {showModal && status !== 'in_progress' && (() => {
        const won = status === 'won'
        const targetColors = targetArtist ? artistColors(targetArtist.name) : null
        const targetMeta = targetArtist
          ? [targetArtist.creationYear, targetArtist.genres.slice(0, 2).join(', ')]
              .filter(Boolean)
              .join(' · ')
          : ''
        const shareRows = guesses.map((g, i) => ({
          num: i + 1,
          squares: g.clues.map((c) => SHARE_COLOR[c.status] ?? SHARE_COLOR.unknown),
        }))

        return (
          <GameResultModal
            classPrefix="vinymix"
            won={won}
            title={null}
            headerExtra={
              <div className="vinymix-modal-header">
                <div className="vinymix-modal-emoji">{won ? '🎉' : '🎵'}</div>
                <h2>{won ? 'Bravo !' : 'Perdu !'}</h2>
                <p>
                  {won
                    ? `Artiste trouvé en ${guesses.length} essai${guesses.length > 1 ? 's' : ''}`
                    : "L'artiste mystère était :"}
                </p>
              </div>
            }
            shareText={buildShareText(status, guesses)}
            showSharePreview={false}
            shareLabel="Copier le résultat"
            shareButtonClassName="vinymix-btn-primary"
            showLeaderboardLink={false}
            preActionsExtra={
              <div className="vinymix-modal-countdown">
                <span className="vinymix-modal-countdown-label">Prochain vinyle dans</span>
                <span className="vinymix-modal-countdown-timer">{countdown}</span>
              </div>
            }
            onClose={() => setShowModal(false)}
          >
            {targetArtist && (
              <div className="vinymix-modal-artist-banner">
                <div className="vinymix-modal-artist-vinyl">
                  <div
                    className="vinymix-modal-artist-vinyl-label"
                    style={{ background: targetColors?.avBg, color: targetColors?.avFg }}
                  >
                    {targetArtist.name[0]}
                  </div>
                </div>
                <div className="vinymix-modal-artist-info">
                  <strong className="vinymix-modal-artist-name">{targetArtist.name}</strong>
                  <span className="vinymix-modal-artist-meta">{targetMeta}</span>
                </div>
              </div>
            )}

            <div className="vinymix-modal-share-grid">
              {shareRows.map((row) => (
                <div key={row.num} className="vinymix-modal-share-row">
                  <span className="vinymix-modal-share-num">#{row.num}</span>
                  <div className="vinymix-modal-share-squares">
                    {row.squares.map((col, j) => (
                      <span key={j} className="vinymix-modal-share-sq" style={{ background: col }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GameResultModal>
        )
      })()}
    </Shell>
  )
}
