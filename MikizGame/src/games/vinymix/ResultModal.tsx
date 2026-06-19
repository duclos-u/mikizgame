import { useState } from 'react'
import type { VinymixArtist, VinymixGuess, VinymixMatchStatus, VinymixStatus } from '../../api/client'
import { artistColors } from '../../utils/artistColors'

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

function buildShareText(
  status: VinymixStatus,
  guesses: VinymixGuess[],
  targetArtist: VinymixArtist | null,
): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const result = status === 'won' ? `${guesses.length}/6` : 'X/6'
  const lines = guesses.map((g) => {
    const row = g.clues
      .filter((c) => c.key !== 'famousSong')
      .map((c) => SHARE_EMOJI[c.status] ?? '⬜')
      .join('')
    return row
  })
  return `Vinymix 🎵 — ${date}\n${result} (${targetArtist?.name ?? '?'})\n${lines.join('\n')}\n\n#Vinymix`
}

type Props = {
  status: VinymixStatus
  guesses: VinymixGuess[]
  targetArtist: VinymixArtist | null
  onClose: () => void
  onReset: () => void
}

export function ResultModal({ status, guesses, targetArtist, onClose, onReset }: Props) {
  const [copied, setCopied] = useState(false)

  const targetColors = targetArtist ? artistColors(targetArtist.name) : null
  const shareRows = guesses.map((g, i) => ({
    num: i + 1,
    squares: g.clues
      .filter((c) => c.key !== 'famousSong')
      .map((c) => SHARE_COLOR[c.status] ?? SHARE_COLOR.unknown),
  }))

  async function handleShare() {
    const txt = buildShareText(status, guesses, targetArtist)
    try {
      await navigator.clipboard.writeText(txt)
    } catch {
      // clipboard API not supported
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleReset() {
    onClose()
    onReset()
  }

  const won = status === 'won'
  const targetMeta = targetArtist
    ? [targetArtist.creationYear, targetArtist.genres.slice(0, 2).join(', ')]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div className="vinymix-modal-overlay" onClick={onClose}>
      <div
        className="vinymix-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className="vinymix-modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        <div className="vinymix-modal-header">
          <div className="vinymix-modal-emoji">{won ? '🎉' : '🎵'}</div>
          <h2>{won ? 'Bravo !' : 'Perdu !'}</h2>
          <p>
            {won
              ? `Artiste trouvé en ${guesses.length} essai${guesses.length > 1 ? 's' : ''}`
              : "L'artiste mystère était :"}
          </p>
        </div>

        {targetArtist && (
          <div className="vinymix-modal-artist-banner">
            <div className="vinymix-modal-artist-vinyl">
              <div
                className="vinymix-modal-artist-vinyl-label"
                style={{
                  background: targetColors?.avBg,
                  color: targetColors?.avFg,
                }}
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
                  <span
                    key={j}
                    className="vinymix-modal-share-sq"
                    style={{ background: col }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="vinymix-modal-actions">
          <button type="button" className="vinymix-btn-primary" onClick={handleShare}>
            {copied ? 'Copié ✓' : 'Copier le résultat'}
          </button>
          <button type="button" className="vinymix-btn-secondary" onClick={handleReset}>
            Rejouer
          </button>
        </div>
      </div>
    </div>
  )
}
