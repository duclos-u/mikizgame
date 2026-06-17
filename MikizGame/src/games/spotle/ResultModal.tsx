import type { SpotleArtist, SpotleGuess, SpotleStatus } from '../../api/client'

const STATUS_EMOJI_MAP: Record<string, string> = {
  match: '🟩',
  close: '🟨',
  miss: '⬛',
  info: '🔵',
  unknown: '⬜',
}

function buildShareText(
  status: SpotleStatus,
  guesses: SpotleGuess[],
  targetArtist: SpotleArtist | null,
): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const result = status === 'won' ? `${guesses.length}/6` : 'X/6'

  const lines = guesses.map((g, i) => {
    if (i === guesses.length - 1 && status === 'won') return '✅'
    const row = g.clues
      .filter((c) => c.key !== 'famousSong')
      .map((c) => STATUS_EMOJI_MAP[c.status] ?? '⬜')
      .join('')
    return row
  })

  const artistName = targetArtist?.name ?? '?'
  return `Spotle 🎵 — ${date}\n${result} (${artistName})\n${lines.join('\n')}\n\n#Spotle`
}

type Props = {
  status: SpotleStatus
  guesses: SpotleGuess[]
  targetArtist: SpotleArtist | null
  onClose: () => void
}

export function ResultModal({ status, guesses, targetArtist, onClose }: Props) {
  const shareText = buildShareText(status, guesses, targetArtist)

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareText)
      alert('Résultat copié dans le presse-papiers !')
    } catch {
      // clipboard API not supported
    }
  }

  return (
    <div className="spotle-modal-overlay" onClick={onClose}>
      <div
        className="spotle-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className="spotle-modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        <div className="spotle-modal-header">
          {status === 'won' ? (
            <>
              <div className="spotle-modal-emoji">🎉</div>
              <h2>Bravo !</h2>
              <p>
                Trouvé en {guesses.length} essai{guesses.length > 1 ? 's' : ''}
              </p>
            </>
          ) : (
            <>
              <div className="spotle-modal-emoji">🎵</div>
              <h2>Perdu !</h2>
              <p>L'artiste était :</p>
            </>
          )}
        </div>

        {targetArtist && (
          <div className="spotle-modal-artist">
            {targetArtist.imageUrl && (
              <img
                src={targetArtist.imageUrl}
                alt={targetArtist.name}
                className="spotle-modal-artist-img"
              />
            )}
            <div>
              <strong className="spotle-modal-artist-name">{targetArtist.name}</strong>
              <span className="spotle-modal-artist-meta">
                {targetArtist.creationYear ?? '—'} · {targetArtist.country ?? '—'} ·{' '}
                {targetArtist.genres.slice(0, 2).join(', ')}
              </span>
            </div>
          </div>
        )}

        <pre className="spotle-modal-share-text">{shareText}</pre>

        <div className="spotle-modal-actions">
          <button type="button" className="btn btn-primary" onClick={handleShare}>
            Copier le résultat
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
