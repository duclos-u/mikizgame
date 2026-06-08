import type { CineclueFilm, CineclueTentative } from '../../api/client'

type Props = {
  statut: 'won' | 'lost'
  filmCible: CineclueFilm
  tentatives: CineclueTentative[]
  onClose: () => void
}

// Génère le texte de partage style Wordle avec emojis
function buildShareText(
  statut: 'won' | 'lost',
  filmCible: CineclueFilm,
  tentatives: CineclueTentative[],
): string {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const resultat = statut === 'won' ? `${tentatives.length}/10` : 'X/10'

  // Emojis par tentative : vert si correct, jaune si partiel, noir sinon
  const lignes = tentatives.map((t, i) => {
    const f = t.filmSoumis
    const estLast = i === tentatives.length - 1 && statut === 'won'
    if (estLast) return '✅'

    const points = [
      f.genres.some((g) => filmCible.genres.includes(g)),
      f.pays.some((p) => filmCible.pays.includes(p)),
      f.realisateurs.some((r) => filmCible.realisateurs.some((cr) => cr.nom === r.nom)),
      f.acteurs.some((a) => filmCible.acteurs.some((ca) => ca.nom === a.nom)),
      f.annee === filmCible.annee,
    ].filter(Boolean).length

    if (points >= 3) return '🟨'
    return '⬛'
  })

  return `CinéClue 🎬 — ${date}\n${resultat}\n${lignes.join('')}\n\n#CinéClue`
}

export function ResultModal({ statut, filmCible, tentatives, onClose }: Props) {
  const shareText = buildShareText(statut, filmCible, tentatives)

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareText)
      alert('Résultat copié dans le presse-papiers !')
    } catch {
      // clipboard API not supported — silently ignore
    }
  }

  return (
    <div className="cineclue-modal-overlay" onClick={onClose}>
      <div
        className="cineclue-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className="cineclue-modal-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>

        <div className="cineclue-modal-header">
          {statut === 'won' ? (
            <>
              <div className="cineclue-modal-emoji">🎉</div>
              <h2>Bravo !</h2>
              <p>Trouvé en {tentatives.length} tentative{tentatives.length > 1 ? 's' : ''}</p>
            </>
          ) : (
            <>
              <div className="cineclue-modal-emoji">😞</div>
              <h2>Perdu !</h2>
              <p>Le film était :</p>
            </>
          )}
        </div>

        <div className="cineclue-modal-film">
          <strong className="cineclue-modal-titre">{filmCible.titre}</strong>
          <span className="cineclue-modal-meta">
            {filmCible.annee || '—'} · {filmCible.realisateurs[0]?.nom ?? '?'} · {filmCible.genres.slice(0, 2).join(', ')}
          </span>
        </div>

        <pre className="cineclue-modal-share-text">{shareText}</pre>

        <div className="cineclue-modal-actions">
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
