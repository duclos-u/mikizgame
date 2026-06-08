import { useEffect, useMemo, useRef, useState } from 'react'
import { GameHeader } from '../../components/GameHeader'

type TileStatus = 'empty' | 'correct' | 'present' | 'absent'

const TARGET_WORD = 'MOTIVE'
const TILE_REVEAL_DELAY_MS = 120
const TILE_REVEAL_DURATION_MS = 420
const VALID_WORDS = new Set([
  TARGET_WORD,
  'AMENER',
  'ANANAS',
  'BONJOUR',
  'CITRON',
  'DEVANT',
  'FLECHE',
  'MUSCLE',
  'NIVEAU',
  'POULET',
  'RANGER',
  'VALISE',
])

function scoreGuess(guess: string, target: string): TileStatus[] {
  const result: TileStatus[] = Array.from({ length: target.length }, () => 'absent')
  const targetChars = target.split('')

  for (let i = 0; i < guess.length; i += 1) {
    if (guess[i] === target[i]) {
      result[i] = 'correct'
      targetChars[i] = '#'
    }
  }

  for (let i = 0; i < guess.length; i += 1) {
    if (result[i] === 'correct') continue
    const idx = targetChars.indexOf(guess[i])
    if (idx >= 0) {
      result[i] = 'present'
      targetChars[idx] = '#'
    }
  }

  return result
}

const Confetti = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#6aaa64', '#c9b458', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#a29bfe', '#fd79a8', '#00b894']

    type Particle = {
      x: number; y: number
      vx: number; vy: number
      color: string
      w: number; h: number
      rotation: number; rotSpeed: number
      opacity: number
    }

    const make = (x: number, y: number, vx: number, vy: number): Particle => ({
      x, y, vx, vy,
      color: colors[Math.floor(Math.random() * colors.length)],
      w: Math.random() * 10 + 5,
      h: Math.random() * 5 + 3,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.18,
      opacity: 1,
    })

    const cx = canvas.width / 2
    const cy = canvas.height * 0.55

    const particles: Particle[] = [
      // left cannon
      ...Array.from({ length: 80 }, () =>
        make(cx * 0.5, cy,
          Math.cos(-Math.PI / 4 - Math.random() * Math.PI / 5) * (Math.random() * 14 + 5),
          Math.sin(-Math.PI / 4 - Math.random() * Math.PI / 5) * (Math.random() * 14 + 5),
        )
      ),
      // right cannon
      ...Array.from({ length: 80 }, () =>
        make(cx * 1.5, cy,
          Math.cos(-Math.PI * 3/4 + Math.random() * Math.PI / 5) * (Math.random() * 14 + 5),
          Math.sin(-Math.PI * 3/4 + Math.random() * Math.PI / 5) * (Math.random() * 14 + 5),
        )
      ),
      // top rain
      ...Array.from({ length: 40 }, () =>
        make(Math.random() * canvas.width, -20 - Math.random() * 150,
          (Math.random() - 0.5) * 4, Math.random() * 2 + 1,
        )
      ),
    ]

    const startTime = Date.now()
    let animId: number

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const elapsed = Date.now() - startTime
      let alive = false

      for (const p of particles) {
        if (p.y > canvas.height + 30) continue
        alive = true
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.3
        p.vx *= 0.99
        p.rotation += p.rotSpeed

        if (elapsed > 2200) p.opacity = Math.max(0, 1 - (elapsed - 2200) / 1600)

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (alive && elapsed < 4000) animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 999 }}
    />
  )
}

const Motivex = () => {
  const maxAttempts = 6
  const wordSize = TARGET_WORD.length
  const [guesses, setGuesses] = useState<string[]>(Array.from({ length: maxAttempts }, () => ''))
  const [currentRow, setCurrentRow] = useState(0)
  const [message, setMessage] = useState('Tape un mot puis appuie sur Entrer.')
  const [shakingRow, setShakingRow] = useState<number | null>(null)
  const [revealingRow, setRevealingRow] = useState<number | null>(null)
  const [celebrateRowIndex, setCelebrateRowIndex] = useState<number | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  const gameState = useMemo(() => {
    const won = guesses.some((g, i) => g === TARGET_WORD && i < currentRow)
    const lost = currentRow >= maxAttempts && !won
    return { won, lost, over: won || lost }
  }, [currentRow, guesses, maxAttempts])

  const displayMessage = gameState.won
    ? 'Bien joué, tu as trouvé le mot.'
    : gameState.lost
      ? `Perdu. Le mot était ${TARGET_WORD}.`
      : message

  useEffect(() => {
    if (revealingRow === null) return
    const submittedRowIndex = revealingRow
    /** End of flip on the last letter (matches CSS stagger + animation-duration). */
    const flipDoneMs =
      (wordSize - 1) * TILE_REVEAL_DELAY_MS + TILE_REVEAL_DURATION_MS + 50

    const t = window.setTimeout(() => {
      setRevealingRow(null)

      const word = guesses[submittedRowIndex]
      if (word === TARGET_WORD) {
        setCelebrateRowIndex(submittedRowIndex)
        setShowConfetti(true)
        window.setTimeout(() => setCelebrateRowIndex(null), 1600)
        window.setTimeout(() => setShowConfetti(false), 4500)
      }
    }, flipDoneMs)

    return () => window.clearTimeout(t)
    // guesses[submittedRowIndex] already contains the submission when revealingRow is set
  }, [guesses, revealingRow, wordSize])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (gameState.over) return
      if (revealingRow !== null) return

      const key = event.key.toUpperCase()

      if (key === 'BACKSPACE') {
        setGuesses((prev) => {
          const next = [...prev]
          next[currentRow] = next[currentRow].slice(0, -1)
          return next
        })
        return
      }

      if (key === 'ENTER') {
        const currentGuess = guesses[currentRow]
        if (currentGuess.length !== wordSize) {
          setMessage(`Mot incomplet: ${wordSize} lettres requises.`)
          return
        }
        if (!VALID_WORDS.has(currentGuess)) {
          setMessage('Mot inconnu. Essaie un mot valide.')
          setShakingRow(null)
          window.requestAnimationFrame(() => setShakingRow(currentRow))
          return
        }
        setRevealingRow(currentRow)
        setCurrentRow((prev) => prev + 1)
        setMessage('Nouvelle tentative.')
        return
      }

      if (!/^[A-Z]$/.test(key)) return
      if (guesses[currentRow].length >= wordSize) return

      setGuesses((prev) => {
        const next = [...prev]
        next[currentRow] = `${next[currentRow]}${key}`
        return next
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentRow, gameState.over, guesses, revealingRow, wordSize])

  return (
    <div className="game-shell">
      {showConfetti && <Confetti key={String(showConfetti)} />}
      <GameHeader title="Motivex" subtitle="Trouve le mot du jour" />
      <main className="container">
        <div className="game-content">
          <div className="wordle-board">
            <p className="wordle-message">{displayMessage}</p>
            <div className="grid">
            {Array.from({ length: maxAttempts }, (_, rowIndex) => {
              const rowGuess = guesses[rowIndex]
              const rowSubmitted = rowGuess.length === wordSize && rowIndex < currentRow
              const rowStatuses = rowSubmitted
                ? scoreGuess(rowGuess, TARGET_WORD)
                : Array.from({ length: wordSize }, () => 'empty' as const)
              const solvedRow = rowSubmitted && rowGuess === TARGET_WORD

              return (
                <div
                  key={rowIndex}
                  className={`grid-row${rowIndex === shakingRow ? ' grid-row-shake' : ''}${celebrateRowIndex === rowIndex ? ' grid-row-win' : ''}`}
                  onAnimationEnd={() => {
                    if (rowIndex === shakingRow) {
                      setShakingRow(null)
                    }
                  }}
                >
                  {Array.from({ length: wordSize }, (_, colIndex) => {
                    const letter = rowGuess[colIndex] ?? ''
                    const isActiveCell = rowIndex === currentRow && colIndex === rowGuess.length
                    const status = rowStatuses[colIndex]

                    const perfectWord =
                      solvedRow &&
                      status === 'correct' &&
                      rowIndex !== revealingRow
                    const winPop =
                      celebrateRowIndex === rowIndex && rowIndex !== revealingRow

                    return (
                      <div
                        key={colIndex}
                        className={`grid-cell grid-cell-${status}${isActiveCell ? ' grid-cell-active' : ''}${rowIndex === revealingRow ? ' grid-cell-reveal' : ''}${perfectWord ? ' grid-cell-perfect' : ''}${winPop ? ' grid-cell-win-pop' : ''}`}
                        style={
                          rowIndex === revealingRow || winPop
                            ? {
                                animationDelay: `${colIndex * TILE_REVEAL_DELAY_MS}ms`,
                              }
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
          </div>
        </div>
      </main>
    </div>
  )
}

export default Motivex