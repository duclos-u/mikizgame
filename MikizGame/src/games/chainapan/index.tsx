import confetti from 'canvas-confetti'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api,
  type ChainapanDailyInfo,
  type ChainapanSession,
  type ChainapanStep,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { useAuth } from '../../context/AuthContext'
import { STORAGE_KEYS } from '../../constants/storage'
import { today } from '../../utils/date'
import { useGameSession } from '../../hooks/useGameSession'
import { useHubScores } from '../../hooks/useHubScores'

const MAX_STEPS = 8
const WORD_LENGTH = 5

const KEYBOARD_ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['BACKSPACE', 'W', 'X', 'C', 'V', 'B', 'N', 'ENTER'],
]

type GameStatus = 'in_progress' | 'won' | 'lost'
type ChainapanLoadData = { daily: ChainapanDailyInfo; session: ChainapanSession | null }

function markChainapanComplete() {
  try { localStorage.setItem(STORAGE_KEYS.CHAINAPAN_STATE(today()), '1') } catch { /* ignore */ }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-shell">
      <GameHeader title="Chainapan" subtitle="Change une lettre à la fois" />
      <main className="container">
        <div className="game-content">{children}</div>
      </main>
    </div>
  )
}

const Chainapan = () => {
  const { user } = useAuth()
  const { saveScore } = useHubScores()
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const physicalKeyHandled = useRef(false)

  // ── Session loading ───────────────────────────────────────────────────────
  const { data, loading, error: loadError, authenticated } = useGameSession<ChainapanLoadData>({
    fetch: async () => {
      const [daily, { session }] = await Promise.all([
        api.chainapan.daily(),
        api.chainapan.session(),
      ])
      return { daily, session }
    },
    requireAuth: true,
  })

  const startWord = data?.daily.startWord ?? ''
  const targetWord = data?.daily.targetWord ?? ''

  // ── Game state ────────────────────────────────────────────────────────────
  const [steps, setSteps] = useState<ChainapanStep[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [status, setStatus] = useState<GameStatus>('in_progress')
  const [message, setMessage] = useState('')
  const [shakingRow, setShakingRow] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [pendingConfetti, setPendingConfetti] = useState(false)

  const gameInitialized = useRef(false)
  useEffect(() => {
    if (!data || gameInitialized.current) return
    gameInitialized.current = true

    const { session } = data

    if (session) {
      setSteps(session.steps ?? [])
      setStatus(session.status)
      if (session.status === 'won') {
        markChainapanComplete()
        setMessage('Bravo ! Tu as trouvé le chemin.')
      } else if (session.status === 'lost') {
        markChainapanComplete()
        setMessage(`Perdu ! Tu n'as plus d'étapes.`)
      } else {
        setMessage(`${session.stepsLeft} étape${session.stepsLeft > 1 ? 's' : ''} restante${session.stepsLeft > 1 ? 's' : ''}.`)
      }
    } else {
      setMessage('Change une lettre à la fois pour atteindre le mot cible.')
    }
  }, [data])

  const gameOver = status !== 'in_progress'

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKey = useCallback(
    async (key: string) => {
      if (gameOver || loading || submitting) return

      if (key === 'BACKSPACE') {
        setCurrentInput((prev) => prev.slice(0, -1))
        return
      }

      if (key === 'ENTER') {
        if (currentInput.length !== WORD_LENGTH) {
          setMessage(`Mot incomplet : ${WORD_LENGTH} lettres requises.`)
          setShakingRow(null)
          requestAnimationFrame(() => setShakingRow(steps.length))
          return
        }

        setSubmitting(true)
        try {
          const res = await api.chainapan.step(currentInput)
          const newSteps = [...steps, res.step]
          setSteps(newSteps)
          setCurrentInput('')
          setStatus(res.status as GameStatus)

          if (res.status !== 'in_progress') {
            markChainapanComplete()
            if (user)
              saveScore('chainapan', user.username, res.status === 'won' ? newSteps.length : null)
          }
          if (res.status === 'won') {
            setMessage('Bravo ! Tu as trouvé le chemin.')
            setPendingConfetti(true)
          } else if (res.status === 'lost') {
            setMessage(`Perdu ! Tu n'as plus d'étapes.`)
          } else {
            setMessage(
              `${res.stepsLeft} étape${res.stepsLeft > 1 ? 's' : ''} restante${res.stepsLeft > 1 ? 's' : ''}.`,
            )
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Erreur'
          setMessage(msg)
          setShakingRow(null)
          requestAnimationFrame(() => setShakingRow(steps.length))
        } finally {
          setSubmitting(false)
        }
        return
      }

      if (!/^[A-Z]$/.test(key)) return
      if (currentInput.length >= WORD_LENGTH) return
      setCurrentInput((prev) => prev + key)
    },
    [gameOver, loading, submitting, currentInput, steps, user, saveScore],
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const upper = e.key.toUpperCase()
      if (upper === 'ENTER' || upper === 'BACKSPACE' || /^[A-Z]$/.test(upper)) {
        physicalKeyHandled.current = true
      }
      handleKey(upper)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  const handleNativeInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const ie = e.nativeEvent as InputEvent
      const input = e.currentTarget as HTMLInputElement
      if (!physicalKeyHandled.current) {
        if (ie.inputType === 'deleteContentBackward') {
          handleKey('BACKSPACE')
        } else if (ie.inputType === 'insertLineBreak') {
          handleKey('ENTER')
        } else if (ie.data) {
          const char = ie.data.slice(-1).toUpperCase()
          if (/^[A-Z]$/.test(char)) handleKey(char)
        }
      }
      physicalKeyHandled.current = false
      input.value = ' '
    },
    [handleKey],
  )

  useEffect(() => {
    if (!pendingConfetti) return
    confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } })
    setPendingConfetti(false)
  }, [pendingConfetti])

  useEffect(() => {
    if (!loading && startWord) hiddenInputRef.current?.focus()
  }, [loading, startWord])

  useEffect(() => {
    if (gameOver) hiddenInputRef.current?.blur()
  }, [gameOver])

  // ── Render guards ─────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
            Connecte-toi pour jouer et sauvegarder ton score.
          </p>
          <Link to="/" className="btn btn-primary">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </Shell>
    )
  }

  if (loading) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
          <p style={{ color: 'var(--muted)' }}>Chargement…</p>
        </div>
      </Shell>
    )
  }

  if (loadError) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
          <p style={{ color: 'var(--red)', marginBottom: '1rem' }}>{loadError}</p>
          <Link to="/" className="btn">
            ← Retour
          </Link>
        </div>
      </Shell>
    )
  }

  async function handleReset() {
    setResetting(true)
    try {
      await api.chainapan.reset()
      setSteps([])
      setCurrentInput('')
      setStatus('in_progress')
      setShakingRow(null)
      setPendingConfetti(false)
      setMessage('Change une lettre à la fois pour atteindre le mot cible.')
      gameInitialized.current = false
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur reset')
    } finally {
      setResetting(false)
    }
  }

  if (!startWord) return null

  const tileGap = 6
  const tileSize = `min(52px, calc((100vw - 2rem - ${(WORD_LENGTH - 1) * tileGap}px) / ${WORD_LENGTH}))`
  const gridCols = `repeat(${WORD_LENGTH}, ${tileSize})`

  const currentRowIndex = steps.length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="chainapan-board" onClick={() => hiddenInputRef.current?.focus()}>
        <input
          ref={hiddenInputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          defaultValue=" "
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '1px',
            height: '1px',
            opacity: 0,
            border: 'none',
            outline: 'none',
            padding: 0,
            margin: 0,
            pointerEvents: 'none',
          }}
          onInput={handleNativeInput}
        />

        <div className="chainapan-message-wrapper">
          <p className="chainapan-message">{message}</p>
        </div>

        {/* Start word */}
        <div className="chainapan-anchor-label">Départ</div>
        <div className="chainapan-anchor-word" style={{ gridTemplateColumns: gridCols }}>
          {startWord.split('').map((letter, i) => (
            <div key={i} className="chainapan-anchor-cell is-start">
              {letter}
            </div>
          ))}
        </div>

        {/* Step rows */}
        <div className="chainapan-grid">
          {Array.from({ length: MAX_STEPS }, (_, rowIndex) => {
            const submitted = rowIndex < steps.length
            const isCurrentRow = rowIndex === currentRowIndex && !gameOver

            return (
              <div
                key={rowIndex}
                className={`chainapan-grid-row${rowIndex === shakingRow ? ' chainapan-grid-row-shake' : ''}`}
                style={{ gridTemplateColumns: gridCols }}
                onAnimationEnd={() => {
                  if (rowIndex === shakingRow) setShakingRow(null)
                }}
              >
                {Array.from({ length: WORD_LENGTH }, (_, colIndex) => {
                  if (submitted) {
                    const step = steps[rowIndex]
                    return (
                      <div
                        key={colIndex}
                        className={`chainapan-cell chainapan-cell-${step.tileResults[colIndex]}`}
                      >
                        {step.word[colIndex]}
                      </div>
                    )
                  }

                  if (isCurrentRow) {
                    const letter = currentInput[colIndex] ?? ''
                    const isActive = colIndex === currentInput.length
                    return (
                      <div
                        key={colIndex}
                        className={`chainapan-cell${isActive ? ' chainapan-cell-active' : ''}`}
                      >
                        {letter}
                      </div>
                    )
                  }

                  return <div key={colIndex} className="chainapan-cell" />
                })}
              </div>
            )
          })}
        </div>

        {/* Target word */}
        <div className="chainapan-anchor-label">Cible</div>
        <div className="chainapan-anchor-word" style={{ gridTemplateColumns: gridCols }}>
          {targetWord.split('').map((letter, i) => (
            <div key={i} className="chainapan-anchor-cell is-target">
              {letter}
            </div>
          ))}
        </div>

        {/* On-screen keyboard */}
        <div className="chainapan-keyboard">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="chainapan-keyboard-row">
              {row.map((key) => {
                const wide = key === 'BACKSPACE' || key === 'ENTER'
                const cls = ['chainapan-key', wide && 'chainapan-key-wide']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={key}
                    type="button"
                    className={cls}
                    onClick={() => handleKey(key)}
                    disabled={submitting}
                  >
                    {key === 'BACKSPACE' ? '⌫' : key === 'ENTER' ? '↵' : key}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            style={{
              marginTop: '1.5rem',
              padding: '0.35rem 0.9rem',
              fontSize: '0.75rem',
              opacity: 0.5,
              cursor: resetting ? 'not-allowed' : 'pointer',
              border: '1px solid var(--muted)',
              borderRadius: '4px',
              background: 'transparent',
              color: 'var(--muted)',
            }}
          >
            {resetting ? '…' : '[dev] réinitialiser'}
          </button>
        )}
      </div>
    </Shell>
  )
}

export default Chainapan
