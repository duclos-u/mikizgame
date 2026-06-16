import type { CineclueFilm, CineclueIndices, CineclueTentative } from '../../api/client'
import { countryLabel } from './PersonaBoard'

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
  filmCible: CineclueFilm | null,
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
  filmCible: CineclueFilm | null,
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
  tentatives: CineclueTentative[]
  filmCible: CineclueFilm | null
  indicesCourants: CineclueIndices
}

export function TentativesHistory({ tentatives, filmCible, indicesCourants }: Props) {
  if (tentatives.length === 0) return null

  return (
    <div className="cineclue-guess-cards">
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

        const dirMatch = filmCible
          ? f.realisateurs.some((r) => filmCible.realisateurs.some((cr) => cr.nom === r.nom))
          : indicesCourants.realisateurRevele &&
            indicesCourants.realisateurInfo != null &&
            f.realisateurs.some((r) => r.nom === indicesCourants.realisateurInfo!.nom)
        const dirName = f.realisateurs[0]?.nom ?? '—'

        const actors = f.acteurs.map((a) => ({
          name: a.nom,
          inits: toInitials(a.nom),
          src: a.photo ? `${TMDB_IMG}${a.photo}` : null,
          on: filmCible
            ? filmCible.acteurs.some((ca) => ca.nom === a.nom)
            : indicesCourants.acteurs.includes(a.nom),
        }))

        return (
          <div key={`${t.tmdbId}-${i}`} className="cineclue-guess-card">
            <div className="cineclue-guess-header">
              <span className="cineclue-guess-num">#{num}</span>
              <span className="cineclue-guess-title">{f.titre}</span>
            </div>

            <div className="cineclue-guess-attrs">
              <div className="cineclue-guess-attr">
                <span className="cineclue-attr-label">Année</span>
                <span className={`cineclue-chip ${yr.status}`}>{yr.text}</span>
              </div>
              <div className="cineclue-guess-attr">
                <span className="cineclue-attr-label">Durée</span>
                <span className={`cineclue-chip ${dr.status}`}>{dr.text}</span>
              </div>
              {genres.length > 0 && (
                <div className="cineclue-guess-attr">
                  <span className="cineclue-attr-label">Genres</span>
                  <div className="cineclue-chip-row">
                    {genres.map((g) => (
                      <span key={g.label} className={`cineclue-chip ${g.status}`}>
                        {g.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {countries.length > 0 && (
                <div className="cineclue-guess-attr">
                  <span className="cineclue-attr-label">Pays</span>
                  <div className="cineclue-chip-row">
                    {countries.map((c) => (
                      <span key={c.label} className={`cineclue-chip ${c.status}`}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="cineclue-guess-attr">
                <span className="cineclue-attr-label">Réal.</span>
                <span className={`cineclue-chip ${dirMatch ? 'match' : 'miss'}`}>{dirName}</span>
              </div>
            </div>

            {actors.length > 0 && (
              <div className="cineclue-guess-actor-list">
                {actors.map((a) => (
                  <div key={a.name} className="cineclue-guess-actor">
                    <span className={`cineclue-guess-actor-av${a.on ? ' on' : ''}`}>
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
                    <span className={`cineclue-guess-actor-name${a.on ? ' on' : ''}`}>{a.name}</span>
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
