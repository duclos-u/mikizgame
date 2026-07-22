import { useEffect, useId } from 'react'

// Mirrors the barème in MikizBack/src/lib/leaderboard.ts (RANK_POINTS) — display copy only.
const RANK_POINTS = [25, 18, 15, 12, 10, 8, 6, 5, 4, 3]

type ScoringInfoModalProps = {
  open: boolean
  onClose: () => void
}

export function ScoringInfoModal({ open, onClose }: ScoringInfoModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal scoring-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>Comment sont calculés les points ?</h2>
        <p>
          Plus tu trouves vite, plus tu marques de points. Même barème pour tous les
          jeux — le classement « Général » additionne juste les points de chaque jeu.
        </p>
        <div className="scoring-table-split">
          <div className="scoring-col">
            {RANK_POINTS.slice(0, 5).map((pts, i) => (
              <div className="scoring-row" key={i}>
                <span>{i + 1}{i === 0 ? 'er' : 'e'}</span>
                <span>{pts} pts</span>
              </div>
            ))}
          </div>
          <div className="scoring-col">
            {RANK_POINTS.slice(5).map((pts, i) => (
              <div className="scoring-row" key={i + 5}>
                <span>{i + 6}e</span>
                <span>{pts} pts</span>
              </div>
            ))}
          </div>
        </div>
        <div className="scoring-row-muted">
          Pas de victoire : 0 pt
        </div>
        <p className="scoring-footnote">
          🔗 Pour <strong>Chainapan</strong>, l'« essai » correspond au nombre d'étapes
          utilisées au-delà du chemin le plus court possible, pas au nombre de coups joués.
        </p>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>
            Compris
          </button>
        </div>
      </div>
    </div>
  )
}
