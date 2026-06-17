import type { SpotleClue, SpotleGuess, SpotleMatchStatus } from '../../api/client'

const CLUE_KEYS = [
  'creationYear',
  'memberCount',
  'popularity',
  'genres',
  'country',
  'vocalType',
  'language',
  'soundtrack',
  'famousSong',
  'instrumentation',
] as const

const STATUS_EMOJI: Record<SpotleMatchStatus, string> = {
  match: '✅',
  close: '🟡',
  miss: '❌',
  info: 'ℹ️',
  unknown: '❓',
}

function DirectionArrow({ direction }: { direction?: 'up' | 'down' }) {
  if (!direction) return null
  return <span className="spotle-cell-arrow">{direction === 'up' ? ' ↑' : ' ↓'}</span>
}

function ClueCell({ clue }: { clue: SpotleClue }) {
  return (
    <td className={`spotle-cell spotle-cell-${clue.status}`}>
      <span className="spotle-cell-emoji">{STATUS_EMOJI[clue.status]}</span>
      <span className="spotle-cell-value">
        {clue.value}
        <DirectionArrow direction={clue.direction} />
      </span>
    </td>
  )
}

type Props = {
  guesses: SpotleGuess[]
  clueLabels: Record<string, string>
}

export function GuessHistoryTable({ guesses, clueLabels }: Props) {
  if (guesses.length === 0) return null

  const clueByKey = (guess: SpotleGuess, key: string): SpotleClue | undefined =>
    guess.clues.find((c) => c.key === key)

  return (
    <div className="spotle-table-wrap">
      <table className="spotle-table">
        <thead>
          <tr>
            <th className="spotle-th spotle-th-artist">#</th>
            {CLUE_KEYS.map((key) => (
              <th key={key} className="spotle-th">
                {clueLabels[key] ?? key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...guesses].reverse().map((guess, revIdx) => {
            const num = guesses.length - revIdx
            return (
              <tr key={`${guess.artist.id}-${num}`} className="spotle-row">
                <td className="spotle-cell-artist">
                  {guess.artist.imageUrl ? (
                    <img
                      src={guess.artist.imageUrl}
                      alt={guess.artist.name}
                      className="spotle-artist-avatar"
                    />
                  ) : (
                    <span className="spotle-artist-avatar spotle-artist-avatar-placeholder">
                      {guess.artist.name[0]}
                    </span>
                  )}
                  <span className="spotle-artist-name">
                    <span className="spotle-artist-num">#{num}</span>
                    {guess.artist.name}
                  </span>
                </td>
                {CLUE_KEYS.map((key) => {
                  const clue = clueByKey(guess, key)
                  return clue ? (
                    <ClueCell key={key} clue={clue} />
                  ) : (
                    <td key={key} className="spotle-cell spotle-cell-unknown">
                      <span className="spotle-cell-emoji">❓</span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
