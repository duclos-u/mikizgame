import { useState } from 'react'

const PITY_POPUP_KEY = 'cineclue_pity_popup_dismissed'

type Props = {
  onClose: () => void
}

export function PityCluePopup({ onClose }: Props) {
  const [neverShow, setNeverShow] = useState(false)

  function handleClose() {
    if (neverShow) localStorage.setItem(PITY_POPUP_KEY, '1')
    onClose()
  }

  return (
    <div className="cineclue-modal-overlay" onClick={handleClose}>
      <div
        className="cineclue-pity-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Indice offert"
      >
        <button type="button" className="cineclue-modal-close" onClick={handleClose} aria-label="Fermer">
          ✕
        </button>

        <div className="cineclue-modal-header">
          <div className="cineclue-modal-emoji">🎁</div>
          <h2>Indice offert !</h2>
        </div>

        <p className="cineclue-pity-description">
          Pour t'aider à ne pas rester bloqué, le jeu te révèle automatiquement un indice à certaines étapes :
        </p>

        <ul className="cineclue-pity-list">
          <li><strong>3e tentative</strong> — la langue du film</li>
          <li><strong>5e tentative</strong> — le premier genre du film</li>
          <li><strong>7e tentative</strong> — le réalisateur</li>
        </ul>

        <label className="cineclue-pity-checkbox">
          <input
            type="checkbox"
            checked={neverShow}
            onChange={(e) => setNeverShow(e.target.checked)}
          />
          Ne plus afficher ce message
        </label>

        <div className="cineclue-modal-actions">
          <button type="button" className="btn btn-primary" onClick={handleClose}>
            Compris !
          </button>
        </div>
      </div>
    </div>
  )
}

export function isPityPopupDismissed(): boolean {
  return localStorage.getItem(PITY_POPUP_KEY) === '1'
}
