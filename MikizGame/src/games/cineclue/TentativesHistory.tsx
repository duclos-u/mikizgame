import type { CineclueFilm, CineclueIndices, CineclueTentative } from '../../api/client'

type Props = {
  tentatives: CineclueTentative[]
  filmCible: CineclueFilm | null
  indicesCourants: CineclueIndices
}

// Indicateurs visuels d'un film soumis par rapport aux indices connus
function BadgeMatch({ match }: { match: boolean }) {
  return (
    <span className={`cineclue-badge ${match ? 'cineclue-badge-match' : 'cineclue-badge-no'}`}>
      {match ? '✓' : '✗'}
    </span>
  )
}

// Signe de direction pour la date/durée
function DirectionBadge({
  soumis,
  cible,
}: {
  soumis: number
  cible: number | undefined
}) {
  if (!cible) return <span className="cineclue-badge cineclue-badge-no">?</span>
  if (soumis === cible) return <span className="cineclue-badge cineclue-badge-match">✓</span>
  return (
    <span className="cineclue-badge cineclue-badge-hint">
      {soumis > cible ? '↓' : '↑'}
    </span>
  )
}

export function TentativesHistory({ tentatives, filmCible, indicesCourants }: Props) {
  if (tentatives.length === 0) return null

  return (
    <div className="cineclue-history">
      <div className="cineclue-history-head">
        <span>Film</span>
        <span>Année</span>
        <span>Durée</span>
        <span>Genres</span>
        <span>Pays</span>
        <span>Réal.</span>
        <span>Acteurs</span>
      </div>
      {[...tentatives].reverse().map((t, i) => {
        const f = t.filmSoumis
        const genresMatch = f.genres.some((g) => indicesCourants.genres.includes(g))
        const paysMatch = f.pays.some((p) => indicesCourants.pays.includes(p))
        const realMatch =
          filmCible
            ? f.realisateurs.some((r) =>
                filmCible.realisateurs.some((cr) => cr.nom === r.nom),
              )
            : indicesCourants.realisateurRevele &&
              tentatives[tentatives.length - 1 - i].filmSoumis === t.filmSoumis

        const acteurMatch = filmCible
          ? f.acteurs.some((a) => filmCible.acteurs.some((ca) => ca.nom === a.nom))
          : f.acteurs.some((a) => indicesCourants.acteurs.includes(a.nom))

        return (
          <div key={`${t.tmdbId}-${i}`} className="cineclue-history-row">
            <div className="cineclue-history-titre">
              <span className="cineclue-history-num">#{tentatives.length - i}</span>
              <span>{f.titre}</span>
            </div>
            <div>
              <DirectionBadge soumis={f.annee} cible={filmCible?.annee} />
              <span className="cineclue-history-val">{f.annee || '—'}</span>
            </div>
            <div>
              <DirectionBadge soumis={f.duree} cible={filmCible?.duree} />
              <span className="cineclue-history-val">
                {f.duree > 0 ? `${f.duree}min` : '—'}
              </span>
            </div>
            <div>
              <BadgeMatch match={genresMatch} />
              <span className="cineclue-history-tags">
                {f.genres.map((g) => (
                  <span
                    key={g}
                    className={`cineclue-hist-tag${indicesCourants.genres.includes(g) ? ' on' : ''}`}
                  >
                    {g}
                  </span>
                ))}
              </span>
            </div>
            <div>
              <BadgeMatch match={paysMatch} />
              <span className="cineclue-history-tags">
                {f.pays.slice(0, 2).join(', ')}
              </span>
            </div>
            <div>
              <BadgeMatch match={realMatch} />
              <span className="cineclue-history-val">
                {f.realisateurs[0]?.nom ?? '—'}
              </span>
            </div>
            <div>
              <BadgeMatch match={acteurMatch} />
              <span className="cineclue-history-tags">
                {f.acteurs.slice(0, 3).map((a) => {
                  const on = filmCible
                    ? filmCible.acteurs.some((ca) => ca.nom === a.nom)
                    : indicesCourants.acteurs.includes(a.nom)
                  return (
                    <span key={a.nom} className={`cineclue-hist-tag${on ? ' on' : ''}`}>
                      {a.nom}
                    </span>
                  )
                })}
                {f.acteurs.length > 3 && (
                  <span className="cineclue-hist-tag">+{f.acteurs.length - 3}</span>
                )}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
