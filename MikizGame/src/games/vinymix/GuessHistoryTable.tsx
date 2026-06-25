import type { VinymixGuess, VinymixMatchStatus } from '../../api/client'
import { artistColors } from '../../utils/artistColors'

const PILL_STYLE: Record<VinymixMatchStatus, { bg: string; fg: string; bd: string }> = {
  match: { bg: 'oklch(0.93 0.05 150)', fg: 'oklch(0.45 0.11 150)', bd: 'oklch(0.82 0.08 150)' },
  close: { bg: 'oklch(0.955 0.07 82)', fg: 'oklch(0.55 0.11 66)', bd: 'oklch(0.86 0.10 78)' },
  miss: { bg: 'oklch(0.955 0.006 80)', fg: 'oklch(0.58 0.012 64)', bd: 'oklch(0.905 0.01 80)' },
  info: { bg: 'oklch(0.95 0.025 250)', fg: 'oklch(0.52 0.06 255)', bd: 'oklch(0.88 0.03 252)' },
  unknown: { bg: 'var(--card-2)', fg: 'var(--muted)', bd: 'var(--border)' },
}

type Props = {
  guesses: VinymixGuess[]
}

export function GuessHistoryTable({ guesses }: Props) {
  if (guesses.length === 0) {
    return (
      <div className="vinymix-empty">
        <div className="vinymix-empty-vinyl">
          <div className="vinymix-empty-vinyl-hole" />
        </div>
        <div>
          <div className="vinymix-empty-title">Aucun essai pour l'instant</div>
          <div className="vinymix-empty-sub">
            Cherche un artiste ci-dessus et tente ta première hypothèse. Chaque essai dévoile des indices.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="vinymix-cards">
      {guesses.map((guess, i) => {
        const num = i + 1
        const { avBg, avFg, bar } = artistColors(guess.artist.name)
        const meta = guess.artist.genres[0] ?? ''

        return (
          <div key={`${guess.artist.id}-${num}`} className="vinymix-card" style={{ borderLeftColor: bar }}>
            <div className="vinymix-card-left">
              <div className="vinymix-card-vinyl">
                <div className="vinymix-card-vinyl-label" style={{ background: avBg, color: avFg }}>
                  {guess.artist.name[0]}
                </div>
              </div>
              <span className="vinymix-card-num">#{num}</span>
            </div>
            <div className="vinymix-card-content">
              <div className="vinymix-card-header">
                <span className="vinymix-card-name">{guess.artist.name}</span>
                {meta && <span className="vinymix-card-meta">{meta}</span>}
              </div>
              <div className="vinymix-card-clues">
                {guess.clues.filter((c) => !c.key.startsWith('genre-')).map((clue) => {
                  const p = PILL_STYLE[clue.status] ?? PILL_STYLE.unknown
                  return (
                    <span
                      key={clue.key}
                      className="vinymix-clue-pill"
                      style={{ background: p.bg, color: p.fg, borderColor: p.bd }}
                    >
                      <span className="vinymix-clue-pill-label">{clue.label}</span>
                      <span className="vinymix-clue-pill-value">{clue.value}</span>
                      {clue.direction && (
                        <span className="vinymix-clue-pill-arrow">
                          {clue.direction === 'up' ? '↑' : '↓'}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
              {(() => {
                const genreClues = guess.clues.filter((c) => c.key.startsWith('genre-'))
                if (genreClues.length === 0) return null
                return (
                  <div className="vinymix-card-genres">
                    <span className="vinymix-card-genres-label">Genres</span>
                    <div className="vinymix-card-genres-pills">
                      {genreClues.map((clue) => {
                        const p = PILL_STYLE[clue.status] ?? PILL_STYLE.unknown
                        return (
                          <span
                            key={clue.key}
                            className="vinymix-clue-pill"
                            style={{ background: p.bg, color: p.fg, borderColor: p.bd }}
                          >
                            {clue.value}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )
      })}
    </div>
  )
}
