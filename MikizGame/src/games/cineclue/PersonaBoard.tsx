import type { CineclueFilm, CineclueIndices, CineclueTotaux } from '../../api/client'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

type Props = {
  indices: CineclueIndices
  filmCible: CineclueFilm | null
  totalIndices?: CineclueTotaux
}

// ─── Slot générique ──────────────────────────────────────────────────────────

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cineclue-slot">
      <span className="cineclue-slot-label">{label}</span>
      <div className="cineclue-slot-body">{children}</div>
    </div>
  )
}

// ─── Titre ───────────────────────────────────────────────────────────────────

function SlotTitre({ film }: { film: CineclueFilm | null }) {
  return (
    <Slot label="Titre">
      {film ? (
        <span className="cineclue-revealed cineclue-titre-reveal">{film.titre}</span>
      ) : (
        <span className="cineclue-hidden">— — —</span>
      )}
    </Slot>
  )
}

// ─── Genres ──────────────────────────────────────────────────────────────────

export function SlotGenre({
  indicesGenres,
  cibleGenres,
  totalGenres = 0,
}: {
  indicesGenres: string[]
  cibleGenres?: string[]
  totalGenres?: number
}) {
  const hiddenCount = cibleGenres ? 0 : Math.max(0, totalGenres - indicesGenres.length)
  const hasAny = (cibleGenres ?? indicesGenres).length > 0 || hiddenCount > 0

  if (!hasAny) {
    return (
      <Slot label="Genres">
        <span className="cineclue-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Genres">
      <div className="cineclue-tags">
        {cibleGenres
          ? cibleGenres.map((g) => {
              const revele = indicesGenres.includes(g)
              return (
                <span
                  key={g}
                  className={`cineclue-tag${revele ? ' cineclue-tag-on cineclue-flip' : ''}`}
                >
                  {revele ? g : '?'}
                </span>
              )
            })
          : <>
              {indicesGenres.map((g) => (
                <span key={g} className="cineclue-tag cineclue-tag-on cineclue-flip">
                  {g}
                </span>
              ))}
              {Array.from({ length: hiddenCount }, (_, i) => (
                <span key={`hidden-genre-${i}`} className="cineclue-tag">?</span>
              ))}
            </>}
      </div>
    </Slot>
  )
}

// ─── Nationalités / Langues ───────────────────────────────────────────────────

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })

function isoToFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🏳️'
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

export function countryLabel(code: string): string {
  try {
    return countryNames.of(code) ?? code
  } catch {
    return code
  }
}

export function SlotNationalite({
  indicesPays,
  ciblePays,
  totalPays = 0,
}: {
  indicesPays: string[]
  ciblePays?: string[]
  totalPays?: number
}) {
  const hiddenCount = ciblePays ? 0 : Math.max(0, totalPays - indicesPays.length)
  const hasAny = (ciblePays ?? indicesPays).length > 0 || hiddenCount > 0

  if (!hasAny) {
    return (
      <Slot label="Pays">
        <span className="cineclue-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Pays">
      <div className="cineclue-flags">
        {ciblePays
          ? ciblePays.map((p) => {
              const revele = indicesPays.includes(p)
              return (
                <span
                  key={p}
                  title={revele ? countryLabel(p) : '?'}
                  className={`cineclue-flag${revele ? ' cineclue-flag-on cineclue-flip' : ''}`}
                >
                  {revele ? isoToFlag(p) : '🏴'}
                </span>
              )
            })
          : <>
              {indicesPays.map((p) => (
                <span key={p} title={countryLabel(p)} className="cineclue-flag cineclue-flag-on cineclue-flip">
                  {isoToFlag(p)}
                </span>
              ))}
              {Array.from({ length: hiddenCount }, (_, i) => (
                <span key={`hidden-pays-${i}`} className="cineclue-flag" title="Pays inconnu">🏴</span>
              ))}
            </>}
      </div>
    </Slot>
  )
}

// ─── Langue ──────────────────────────────────────────────────────────────────

const LANGUES: Record<string, string> = {
  en: '🇬🇧', fr: '🇫🇷', ja: '🇯🇵', ko: '🇰🇷',
  de: '🇩🇪', it: '🇮🇹', es: '🇪🇸', zh: '🇨🇳',
  pt: '🇵🇹', ru: '🇷🇺', sv: '🇸🇪', da: '🇩🇰',
  no: '🇳🇴', fi: '🇫🇮', nl: '🇳🇱', pl: '🇵🇱',
  hi: '🇮🇳', ar: '🇸🇦', he: '🇮🇱', tr: '🇹🇷',
  fa: '🇮🇷', cs: '🇨🇿', ro: '🇷🇴', hu: '🇭🇺',
  el: '🇬🇷',
}

export function SlotLangue({
  langue,
  filmCible,
}: {
  langue: string | null
  filmCible: CineclueFilm | null
}) {
  const code = filmCible ? filmCible.langue : langue
  if (!code) {
    return (
      <Slot label="Langue">
        <span className="cineclue-hidden">--</span>
      </Slot>
    )
  }
  const flag = LANGUES[code] ?? '🏳️'
  return (
    <Slot label="Langue">
      <span className="cineclue-revealed cineclue-flip">
        {flag} {code.toUpperCase()}
      </span>
    </Slot>
  )
}

// ─── Date (fourchette) ────────────────────────────────────────────────────────

export function SlotDate({
  anneeMin,
  anneeMax,
  filmCible,
}: {
  anneeMin: number | null
  anneeMax: number | null
  filmCible: CineclueFilm | null
}) {
  const currentYear = new Date().getFullYear()
  let texte: React.ReactNode

  if (filmCible) {
    texte = <span className="cineclue-revealed">{filmCible.annee}</span>
  } else if (anneeMin !== null && anneeMax !== null) {
    if (anneeMax - anneeMin === 2) {
      // Only one year possible between the two bounds
      texte = <span className="cineclue-revealed cineclue-flip">{anneeMin + 1}</span>
    } else {
      texte = (
        <span className="cineclue-fourchette">
          Entre <strong>{anneeMin}</strong> et <strong>{anneeMax}</strong>
        </span>
      )
    }
  } else if (anneeMax !== null) {
    texte = (
      <span className="cineclue-fourchette">
        Avant <strong>{anneeMax}</strong>
      </span>
    )
  } else if (anneeMin !== null) {
    if (anneeMin + 1 >= currentYear) {
      // "After last year" in the current year uniquely identifies the target
      texte = <span className="cineclue-revealed cineclue-flip">{anneeMin + 1}</span>
    } else {
      texte = (
        <span className="cineclue-fourchette">
          Après <strong>{anneeMin}</strong>
        </span>
      )
    }
  } else {
    texte = <span className="cineclue-hidden">--</span>
  }

  return <Slot label="Année">{texte}</Slot>
}

// ─── Durée (fourchette) ───────────────────────────────────────────────────────

function formatMin(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

export function SlotDuree({
  dureeMin,
  dureeMax,
  filmCible,
}: {
  dureeMin: number | null
  dureeMax: number | null
  filmCible: CineclueFilm | null
}) {
  let texte: React.ReactNode

  if (filmCible && filmCible.duree > 0) {
    texte = <span className="cineclue-revealed">{formatMin(filmCible.duree)}</span>
  } else if (dureeMin !== null && dureeMax !== null) {
    texte = (
      <span className="cineclue-fourchette">
        Entre <strong>{formatMin(dureeMin)}</strong> et <strong>{formatMin(dureeMax)}</strong>
      </span>
    )
  } else if (dureeMax !== null) {
    texte = (
      <span className="cineclue-fourchette">
        Moins de <strong>{formatMin(dureeMax)}</strong>
      </span>
    )
  } else if (dureeMin !== null) {
    texte = (
      <span className="cineclue-fourchette">
        Plus de <strong>{formatMin(dureeMin)}</strong>
      </span>
    )
  } else {
    texte = <span className="cineclue-hidden">--</span>
  }

  return <Slot label="Durée">{texte}</Slot>
}

// ─── Acteurs ──────────────────────────────────────────────────────────────────

export function SlotActeurs({
  indicesActeurs,
  filmCible,
  totalActeurs = 0,
}: {
  indicesActeurs: string[]
  filmCible: CineclueFilm | null
  totalActeurs?: number
}) {
  if (filmCible) {
    if (filmCible.acteurs.length === 0) {
      return (
        <Slot label="Acteurs">
          <span className="cineclue-hidden">--</span>
        </Slot>
      )
    }
    return (
      <Slot label="Acteurs">
        <div className="cineclue-acteurs">
          {filmCible.acteurs.map((a) => {
            const src = a.photo ? `${TMDB_IMG}${a.photo}` : null
            return (
              <div key={a.nom} className="cineclue-acteur cineclue-acteur-on cineclue-flip" title={a.nom}>
                <div className="cineclue-acteur-photo">
                  {src ? (
                    <img src={src} alt={a.nom} loading="lazy" />
                  ) : (
                    <span className="cineclue-acteur-initiales">
                      {a.nom.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </span>
                  )}
                </div>
                <span className="cineclue-acteur-nom">{a.nom}</span>
              </div>
            )
          })}
        </div>
      </Slot>
    )
  }

  const hiddenCount = Math.max(0, totalActeurs - indicesActeurs.length)
  const hasAny = indicesActeurs.length > 0 || hiddenCount > 0

  if (!hasAny) {
    return (
      <Slot label="Acteurs">
        <span className="cineclue-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Acteurs">
      <div className="cineclue-acteurs">
        {indicesActeurs.map((nom) => (
          <div key={nom} className="cineclue-acteur cineclue-acteur-on cineclue-flip" title={nom}>
            <div className="cineclue-acteur-photo">
              <span className="cineclue-acteur-initiales">
                {nom.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </span>
            </div>
            <span className="cineclue-acteur-nom">{nom}</span>
          </div>
        ))}
        {Array.from({ length: hiddenCount }, (_, i) => (
          <div key={`hidden-acteur-${i}`} className="cineclue-acteur" title="Acteur non découvert">
            <div className="cineclue-acteur-photo">
              <span className="cineclue-acteur-initiales">?</span>
            </div>
            <span className="cineclue-acteur-nom">?</span>
          </div>
        ))}
      </div>
    </Slot>
  )
}

// ─── Réalisateur ──────────────────────────────────────────────────────────────

export function SlotReal({
  realisateurRevele,
  realisateurInfo,
  filmCible,
}: {
  realisateurRevele: boolean
  realisateurInfo?: { nom: string; photo: string | null } | null
  filmCible: CineclueFilm | null
}) {
  const real = filmCible?.realisateurs[0] ?? (realisateurRevele ? realisateurInfo : null) ?? null

  return (
    <Slot label="Réalisateur">
      {real ? (
        <div className="cineclue-real cineclue-flip">
          {real.photo ? (
            <img
              src={`${TMDB_IMG}${real.photo}`}
              alt={real.nom}
              className="cineclue-real-photo"
              loading="lazy"
            />
          ) : (
            <span className="cineclue-real-initials">
              {real.nom.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </span>
          )}
          <span className="cineclue-revealed">{real.nom}</span>
        </div>
      ) : (
        <span className="cineclue-hidden">--</span>
      )}
    </Slot>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function PersonaBoard({ indices, filmCible, totalIndices }: Props) {
  return (
    <div className="cineclue-persona">
      <SlotTitre film={filmCible} />
      <div className="cineclue-persona-row">
        <SlotGenre
          indicesGenres={indices.genres}
          cibleGenres={filmCible?.genres}
          totalGenres={totalIndices?.genres}
        />
        <SlotNationalite
          indicesPays={indices.pays}
          ciblePays={filmCible?.pays}
          totalPays={totalIndices?.pays}
        />
      </div>
      <div className="cineclue-persona-row-3">
        <SlotDate
          anneeMin={indices.anneeMin}
          anneeMax={indices.anneeMax}
          filmCible={filmCible}
        />
        <SlotDuree
          dureeMin={indices.dureeMin}
          dureeMax={indices.dureeMax}
          filmCible={filmCible}
        />
        <SlotLangue langue={indices.langue} filmCible={filmCible} />
      </div>
      <SlotActeurs indicesActeurs={indices.acteurs} filmCible={filmCible} totalActeurs={totalIndices?.acteurs} />
      <SlotReal realisateurRevele={indices.realisateurRevele} realisateurInfo={indices.realisateurInfo} filmCible={filmCible} />
    </div>
  )
}
