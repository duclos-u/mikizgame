import React from 'react'
import type { CineclueFilm, CineclueIndices, CineclueTentative } from '../../api/client'
import { countryLabel } from './PersonaBoard'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

type Props = {
  tentatives: CineclueTentative[]
  filmCible: CineclueFilm | null
  indicesCourants: CineclueIndices
}

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
      </div>
      {[...tentatives].reverse().map((t, i) => {
        const f = t.filmSoumis
        const realMatch = filmCible
          ? f.realisateurs.some((r) =>
              filmCible.realisateurs.some((cr) => cr.nom === r.nom),
            )
          : indicesCourants.realisateurRevele &&
            tentatives[tentatives.length - 1 - i].filmSoumis === t.filmSoumis

        return (
          <React.Fragment key={`${t.tmdbId}-${i}`}>
            <div className="cineclue-history-row">
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
                <span className="cineclue-history-tags">
                  {f.pays.slice(0, 2).map((p) => (
                    <span
                      key={p}
                      className={`cineclue-hist-tag${indicesCourants.pays.includes(p) ? ' on' : ''}`}
                    >
                      {countryLabel(p)}
                    </span>
                  ))}
                </span>
              </div>
              <div>
                <span className="cineclue-history-tags">
                  <span className={`cineclue-hist-tag${realMatch ? ' on' : ''}`}>
                    {f.realisateurs[0]?.nom ?? '—'}
                  </span>
                </span>
              </div>
            </div>

            {f.acteurs.length > 0 && (
              <div className="cineclue-history-actors">
                {f.acteurs.map((a) => {
                  const on = filmCible
                    ? filmCible.acteurs.some((ca) => ca.nom === a.nom)
                    : indicesCourants.acteurs.includes(a.nom)
                  const src = a.photo ? `${TMDB_IMG}${a.photo}` : null
                  return (
                    <div
                      key={a.nom}
                      className={`cineclue-acteur${on ? ' cineclue-acteur-on' : ''}`}
                      title={a.nom}
                    >
                      <div className="cineclue-acteur-photo">
                        {src ? (
                          <img src={src} alt={a.nom} loading="lazy" />
                        ) : (
                          <span className="cineclue-acteur-initiales">
                            {a.nom
                              .split(' ')
                              .map((w) => w[0])
                              .join('')
                              .slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <span className="cineclue-acteur-nom">{a.nom}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
