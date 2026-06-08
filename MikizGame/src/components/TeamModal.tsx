import { useEffect, useId, useState } from 'react'

type TeamModalProps = {
  open: boolean
  onClose: () => void
}

export function TeamModal({ open, onClose }: TeamModalProps) {
  const titleId = useId()
  const pseudoId = useId()
  const codeId = useId()
  const [pseudo, setPseudo] = useState('')
  const [teamCode, setTeamCode] = useState('')

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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>Rejoindre une équipe</h2>
        <p>
          Entre le code de ton équipe ou crée-en une nouvelle pour comparer vos scores chaque jour.
        </p>
        <label htmlFor={pseudoId}>Ton prénom</label>
        <input
          id={pseudoId}
          className="modal-input"
          type="text"
          placeholder="ex : Ulysse"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          autoComplete="given-name"
        />
        <label htmlFor={codeId}>Code équipe</label>
        <input
          id={codeId}
          className="modal-input"
          type="text"
          placeholder="ex : BUREAU42 (laisser vide pour créer)"
          value={teamCode}
          onChange={(e) => setTeamCode(e.target.value)}
          autoComplete="off"
        />
        <div className="modal-footer">
          <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={onClose}>
            Rejoindre →
          </button>
        </div>
      </div>
    </div>
  )
}
