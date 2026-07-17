import type { CinemaxdFilm, CinemaxdIndices, CinemaxdTentative } from '../../api/client'
import { countryLabel, languageLabel } from './PersonaBoard'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

type ChipStatus = 'match' | 'close' | 'miss'

function fmtDur(m: number) {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return h > 0 ? `${h}h${String(mm).padStart(2, '0')}` : `${m}min`
}

function toInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function yearChip(
  year: number,
  filmCible: CinemaxdFilm | null,
  anneeMin: number | null,
  anneeMax: number | null,
  proche: boolean,
): { text: string; status: ChipStatus } {
  if (filmCible) {
    const diff = filmCible.annee - year
    if (diff === 0) return { text: `${year} ✓`, status: 'match' }
    return { text: `${year} ${diff > 0 ? '↑' : '↓'}`, status: Math.abs(diff) <= 5 ? 'close' : 'miss' }
  }
  if (anneeMax !== null && year >= anneeMax) return { text: `${year} ↓`, status: proche ? 'close' : 'miss' }
  if (anneeMin !== null && year <= anneeMin) return { text: `${year} ↑`, status: proche ? 'close' : 'miss' }
  return { text: `${year} ✓`, status: 'match' }
}

function durChip(
  dur: number,
  filmCible: CinemaxdFilm | null,
  dureeMin: number | null,
  dureeMax: number | null,
  proche: boolean,
): { text: string; status: ChipStatus } {
  if (dur === 0) return { text: '—', status: 'miss' }
  const t = fmtDur(dur)
  if (filmCible && filmCible.duree > 0) {
    const diff = filmCible.duree - dur
    if (diff === 0) return { text: `${t} ✓`, status: 'match' }
    return { text: `${t} ${diff > 0 ? '↑' : '↓'}`, status: Math.abs(diff) <= 15 ? 'close' : 'miss' }
  }
  if (dureeMax !== null && dur >= dureeMax) return { text: `${t} ↓`, status: proche ? 'close' : 'miss' }
  if (dureeMin !== null && dur <= dureeMin) return { text: `${t} ↑`, status: proche ? 'close' : 'miss' }
  return { text: `${t} ✓`, status: 'match' }
}

type Props = {
  tentatives: CinemaxdTentative[]
  filmCible: CinemaxdFilm | null
  indicesCourants: CinemaxdIndices
}

export function TentativesHistory({ tentatives, filmCible, indicesCourants }: Props) {
  if (tentatives.length === 0) return null

  return (
    <div className="cinemaxd-guess-cards">
      {[...tentatives].reverse().map((t, i) => {
        const f = t.filmSoumis
        const num = tentatives.length - i

        const yr = yearChip(f.annee, filmCible, indicesCourants.anneeMin, indicesCourants.anneeMax, t.anneeProche ?? false)
        const dr = durChip(f.duree, filmCible, indicesCourants.dureeMin, indicesCourants.dureeMax, t.dureeProche ?? false)

        const genres = f.genres.map((g) => ({
          label: g,
          status: (filmCible ? filmCible.genres.includes(g) : indicesCourants.genres.includes(g))
            ? 'match'
            : ('miss' as ChipStatus),
        }))

        const countries = f.pays.map((p) => ({
          label: countryLabel(p),
          status: (filmCible ? filmCible.pays.includes(p) : indicesCourants.pays.includes(p))
            ? 'match'
            : ('miss' as ChipStatus),
        }))

        const lang = f.langue
          ? {
              label: languageLabel(f.langue),
              status: (filmCible ? filmCible.langue === f.langue : indicesCourants.langue === f.langue)
                ? ('match' as ChipStatus)
                : ('miss' as ChipStatus),
            }
          : null

        const directors = f.realisateurs.map((r) => ({
          name: r.nom,
          inits: toInitials(r.nom),
          src: r.photo ? `${TMDB_IMG}${r.photo}` : null,
          on: filmCible
            ? filmCible.realisateurs.some((cr) => cr.nom === r.nom)
            : indicesCourants.realisateurRevele &&
              indicesCourants.realisateurInfo?.nom === r.nom,
        }))

        const guessedActorNames = new Set(f.acteurs.map((a) => a.nom))
        const targetActors = filmCible ? filmCible.acteurs : []
        const targetOnlyActors = targetActors.filter((a) => !guessedActorNames.has(a.nom))

        const actors = [
          ...f.acteurs.map((a) => ({
            name: a.nom,
            inits: toInitials(a.nom),
            src: a.photo ? `${TMDB_IMG}${a.photo}` : null,
            on: filmCible
              ? filmCible.acteurs.some((ca) => ca.nom === a.nom)
              : indicesCourants.acteurs.includes(a.nom),
            targetOnly: false,
          })),
          ...targetOnlyActors.map((a) => ({
            name: a.nom,
            inits: toInitials(a.nom),
            src: a.photo ? `${TMDB_IMG}${a.photo}` : null,
            on: false,
            targetOnly: true,
          })),
        ]

        return (
          <div key={`${t.tmdbId}-${i}`} className="cinemaxd-guess-card">
            <div className="cinemaxd-guess-header">
              <span className="cinemaxd-guess-num">#{num}</span>
              <span className="cinemaxd-guess-title">{f.titre}</span>
            </div>

            <div className="cinemaxd-guess-attrs-wrapper">
              {genres.length > 0 && (
                <div className="cinemaxd-attr-block">
                  <span className="cinemaxd-attr-label">Genres</span>
                  <div className="cinemaxd-chip-row">
                    {genres.map((g) => (
                      <span key={g.label} className={`cinemaxd-chip ${g.status}`}>{g.label}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="cinemaxd-attrs-row">
                <div className="cinemaxd-attr-block">
                  <span className="cinemaxd-attr-label">Année</span>
                  <span className={`cinemaxd-chip ${yr.status}`}>{yr.text}</span>
                </div>
                <div className="cinemaxd-attr-block">
                  <span className="cinemaxd-attr-label">Durée</span>
                  <span className={`cinemaxd-chip ${dr.status}`}>{dr.text}</span>
                </div>
                {countries.length > 0 && (
                  <div className="cinemaxd-attr-block">
                    <span className="cinemaxd-attr-label">Pays</span>
                    <div className="cinemaxd-chip-row">
                      {countries.map((c) => (
                        <span key={c.label} className={`cinemaxd-chip ${c.status}`}>{c.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {lang && (
                  <div className="cinemaxd-attr-block">
                    <span className="cinemaxd-attr-label">VO</span>
                    <span className={`cinemaxd-chip ${lang.status}`}>{lang.label}</span>
                  </div>
                )}
                {directors.length > 0 && (
                  <div className="cinemaxd-attr-block">
                    <span className="cinemaxd-attr-label">Réal.</span>
                    <div className="cinemaxd-director-pills">
                      {directors.map((d) => (
                        <div key={d.name} className={`cinemaxd-director-pill${d.on ? ' on' : ''}`}>
                          <span className="cinemaxd-director-av">
                            {d.src ? (
                              <img
                                src={d.src}
                                alt={d.name}
                                loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                              />
                            ) : (
                              d.inits
                            )}
                          </span>
                          <span className="cinemaxd-director-name">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {actors.length > 0 && (
              <div className="cinemaxd-guess-actor-list">
                {actors.map((a) => (
                  <div key={a.name} className={`cinemaxd-guess-actor${a.targetOnly ? ' target-only' : ''}`}>
                    <span className={`cinemaxd-guess-actor-av${a.on ? ' on' : ''}${a.targetOnly ? ' target-only' : ''}${!a.on && !a.targetOnly ? ' off' : ''}`}>
                      {a.src ? (
                        <img
                          src={a.src}
                          alt={a.name}
                          loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        />
                      ) : (
                        a.inits
                      )}
                    </span>
                    <span className={`cinemaxd-guess-actor-name${a.on ? ' on' : ''}${a.targetOnly ? ' target-only' : ''}`}>{a.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
