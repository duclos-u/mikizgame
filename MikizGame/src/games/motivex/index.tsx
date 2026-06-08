import confetti from 'canvas-confetti'
import { useEffect, useMemo, useState } from 'react'
import { GameHeader } from '../../components/GameHeader'

type TileStatus = 'empty' | 'correct' | 'present' | 'absent'

const TARGET_WORD = 'MOTIVE'
const MAX_ATTEMPTS = 6
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

const Motivex = () => {
  const wordSize = TARGET_WORD.length
  const [guesses, setGuesses] = useState<string[]>(Array.from({ length: MAX_ATTEMPTS }, () => ''))
  const [currentRow, setCurrentRow] = useState(0)
  const [message, setMessage] = useState('Tape un mot puis appuie sur Entrer.')
  const [shakingRow, setShakingRow] = useState<number | null>(null)
  const [revealingRow, setRevealingRow] = useState<number | null>(null)
  const [celebrateRowIndex, setCelebrateRowIndex] = useState<number | null>(null)

  const gameState = useMemo(() => {
    const won = guesses.some((g, i) => g === TARGET_WORD && i < currentRow)
    const lost = currentRow >= MAX_ATTEMPTS && !won
    return { won, lost, over: won || lost }
  }, [currentRow, guesses])

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
        confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } })
        window.setTimeout(() => setCelebrateRowIndex(null), 1600)
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
      <GameHeader title="Motivex" subtitle="Trouve le mot du jour" />
      <main className="container">
        <div className="game-content">
          <div className="wordle-board">
            <p className="wordle-message">{displayMessage}</p>
            <div className="grid">
            {Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
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