import confetti from 'canvas-confetti'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type GuessResult, type TileResult } from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { useAuth } from '../../context/AuthContext'
import { useHubScores } from '../../hooks/useHubScores'

const SUTOM_KEY = `sutomstate_${new Date().toISOString().slice(0, 10)}`
function markSutomComplete() {
  try { localStorage.setItem(SUTOM_KEY, '1') } catch { /* ignore */ }
}

const TILE_REVEAL_DELAY_MS = 120
const TILE_REVEAL_DURATION_MS = 420
const MAX_ATTEMPTS = 6

const KEYBOARD_ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['BACKSPACE', 'W', 'X', 'C', 'V', 'B', 'N', 'ENTER'],
]

type GameStatus = 'in_progress' | 'won' | 'lost'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-shell">
      <GameHeader title="Sutom" subtitle="Devine le mot du jour en 6 essais" />
      <main className="container">
        <div className="game-content">{children}</div>
      </main>
    </div>
  )
}

const Sutom = () => {
  const { token, user } = useAuth()
  const { saveScore } = useHubScores()
  const [wordLength, setWordLength] = useState<number | null>(null)
  const [firstLetter, setFirstLetter] = useState('')
  const [attempts, setAttempts] = useState<GuessResult[]>([])
  const [currentInput, setCurrentInput] = useState('')
  const [status, setStatus] = useState<GameStatus>('in_progress')
  const [revealedWord, setRevealedWord] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [shakingRow, setShakingRow] = useState<number | null>(null)
  const [revealingRow, setRevealingRow] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [pendingConfetti, setPendingConfetti] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    async function load() {
      try {
        const [dailyInfo, { session }] = await Promise.all([
          api.sutom.daily(),
          api.sutom.session(),
        ])
        setWordLength(dailyInfo.wordLength)
        setFirstLetter(dailyInfo.firstLetter.toUpperCase())

        if (session) {
          setAttempts(session.attempts ?? [])
          setStatus(session.status)
          if (session.word) setRevealedWord(session.word)
          if (session.status === 'won') {
            markSutomComplete()
            setMessage('Bravo ! Tu as trouvé le mot.')
          } else if (session.status === 'lost') {
            markSutomComplete()
            setMessage(`Perdu. Le mot était ${session.word ?? '?'}.`)
          }
          else {
            setCurrentInput(dailyInfo.firstLetter.toUpperCase())
            setMessage(
              `${MAX_ATTEMPTS - (session.attempts?.length ?? 0)} essai(s) restant(s).`,
            )
          }
        } else {
          setCurrentInput(dailyInfo.firstLetter.toUpperCase())
          setMessage('Tape les lettres puis appuie sur Entrée.')
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const gameOver = status !== 'in_progress'

  const handleKey = useCallback(async (key: string) => {
    if (gameOver || loading || !wordLength || revealingRow !== null || submitting) return

    if (key === 'BACKSPACE') {
      setCurrentInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
      return
    }

    if (key === 'ENTER') {
      if (currentInput.length !== wordLength) {
        setMessage(`Mot incomplet : ${wordLength} lettres requises.`)
        setShakingRow(null)
        requestAnimationFrame(() => setShakingRow(attempts.length))
        return
      }
      const guess = currentInput
      setSubmitting(true)
      try {
        const res = await api.sutom.guess(guess)
        const newAttempt: GuessResult = res.result
        const newAttempts = [...attempts, newAttempt]
        const revIdx = attempts.length
        setAttempts(newAttempts)
        setCurrentInput(firstLetter)
        setRevealingRow(revIdx)
        setStatus(res.status)
        if (res.word) setRevealedWord(res.word)
        if (res.status !== 'in_progress') {
          markSutomComplete()
          if (user) saveScore('sutom', user.username, res.status === 'won' ? newAttempts.length : null)
        }
        if (res.status === 'won') {
          setMessage('Bravo ! Tu as trouvé le mot.')
          setPendingConfetti(true)
        } else if (res.status === 'lost') setMessage(`Perdu. Le mot était ${res.word ?? '?'}.`)
        else
          setMessage(
            `${res.attemptsLeft} essai${res.attemptsLeft > 1 ? 's' : ''} restant${res.attemptsLeft > 1 ? 's' : ''}.`,
          )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur'
        setMessage(msg)
        setShakingRow(null)
        requestAnimationFrame(() => setShakingRow(attempts.length))
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!/^[A-Z]$/.test(key)) return
    if (currentInput.length >= wordLength) return
    setCurrentInput((prev) => prev + key)
  }, [gameOver, loading, wordLength, revealingRow, submitting, currentInput, firstLetter, attempts, user, saveScore])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      handleKey(e.key.toUpperCase())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  const letterStatuses = useMemo(() => {
    const priority: Record<TileResult, number> = { correct: 3, present: 2, absent: 1 }
    const map: Record<string, TileResult> = {}
    for (const attempt of attempts) {
      attempt.guess.split('').forEach((ch, i) => {
        const r = attempt.result[i]
        if (!map[ch] || priority[r] > priority[map[ch]]) map[ch] = r
      })
    }
    return map
  }, [attempts])

  // Clear revealingRow once flip animation ends
  useEffect(() => {
    if (revealingRow === null || !wordLength) return
    const flipDoneMs = (wordLength - 1) * TILE_REVEAL_DELAY_MS + TILE_REVEAL_DURATION_MS + 50
    const t = window.setTimeout(() => setRevealingRow(null), flipDoneMs)
    return () => clearTimeout(t)
  }, [revealingRow, wordLength])

  // Fire confetti after the win animation completes (not on session reload)
  useEffect(() => {
    if (!pendingConfetti || revealingRow !== null) return
    confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } })
    setPendingConfetti(false)
  }, [pendingConfetti, revealingRow])

  if (!token) {
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
      await api.sutom.reset()
      setAttempts([])
      setCurrentInput(firstLetter)
      setStatus('in_progress')
      setRevealedWord(null)
      setRevealingRow(null)
      setShakingRow(null)
      setPendingConfetti(false)
      setMessage('Tape les lettres restantes puis appuie sur Entrée.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur reset')
    } finally {
      setResetting(false)
    }
  }

  if (!wordLength) return null

  const currentRow = attempts.length
  const gridCols = `repeat(${wordLength}, 52px)`

  return (
    <Shell>
      <div className="wordle-board">
        <div className="wordle-message-wrapper">
          <p className="wordle-message">{message}</p>
        </div>
        <p
          style={{
            fontFamily: 'var(--mono)',
            fontSize: '1.1rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            marginBottom: '1rem',
            color: status === 'won' ? 'var(--accent)' : 'var(--red)',
            visibility: revealedWord ? 'visible' : 'hidden',
          }}
        >
          {revealedWord ? revealedWord : 'placeholder'}
        </p>
        <div className="grid">
          {Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
            const submitted = rowIndex < attempts.length
            const isCurrentRow = rowIndex === currentRow && !gameOver
            const isRevealing = rowIndex === revealingRow

            return (
              <div
                key={rowIndex}
                className={`grid-row${rowIndex === shakingRow ? ' grid-row-shake' : ''}`}
                style={{ gridTemplateColumns: gridCols }}
                onAnimationEnd={() => {
                  if (rowIndex === shakingRow) setShakingRow(null)
                }}
              >
                {Array.from({ length: wordLength }, (_, colIndex) => {
                  let letter = ''
                  let tileStatus: TileResult | 'empty' = 'empty'
                  let classes = 'grid-cell'

                  if (submitted) {
                    letter = attempts[rowIndex].guess[colIndex] ?? ''
                    tileStatus = attempts[rowIndex].result[colIndex]
                    if (isRevealing) {
                      classes += ` grid-cell-reveal grid-cell-${tileStatus}`
                    } else {
                      classes += ` grid-cell-${tileStatus}`
                    }
                  } else if (isCurrentRow) {
                    letter = currentInput[colIndex] ?? ''
                    if (colIndex === currentInput.length) {
                      classes += ' grid-cell-active'
                    }
                  }

                  return (
                    <div
                      key={colIndex}
                      className={classes}
                      style={
                        isRevealing
                          ? { animationDelay: `${colIndex * TILE_REVEAL_DELAY_MS}ms` }
                          : undefined
                      }
                    >
                      {letter}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="sutom-keyboard">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="sutom-keyboard-row">
              {row.map((key) => {
                const st = letterStatuses[key]
                const wide = key === 'BACKSPACE' || key === 'ENTER'
                const cls = ['sutom-key', wide && 'sutom-key-wide', st && `sutom-key-${st}`]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={key}
                    type="button"
                    className={cls}
                    onClick={() => handleKey(key)}
                    disabled={submitting || revealingRow !== null}
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

export default Sutom
