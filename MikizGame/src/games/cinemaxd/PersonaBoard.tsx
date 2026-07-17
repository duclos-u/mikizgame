import type { CinemaxdFilm, CinemaxdIndices, CinemaxdTotaux } from '../../api/client'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

type Props = {
  indices: CinemaxdIndices
  filmCible: CinemaxdFilm | null
  totalIndices?: CinemaxdTotaux
  pitySlots?: Set<string>
  acteurPhotos?: Map<string, string | null>
}

// ─── Slot générique ──────────────────────────────────────────────────────────

function Slot({ label, pity, children }: { label: string; pity?: boolean; children: React.ReactNode }) {
  return (
    <div className="cinemaxd-slot">
      <span className="cinemaxd-slot-label">{label}</span>
      <div className={`cinemaxd-slot-body${pity ? ' cinemaxd-pity-slot' : ''}`}>{children}</div>
    </div>
  )
}

// ─── Titre ───────────────────────────────────────────────────────────────────

function SlotTitre({ film }: { film: CinemaxdFilm | null }) {
  return (
    <Slot label="Titre">
      {film ? (
        <span className="cinemaxd-revealed cinemaxd-titre-reveal">{film.titre}</span>
      ) : (
        <span className="cinemaxd-hidden">— — —</span>
      )}
    </Slot>
  )
}

// ─── Genres ──────────────────────────────────────────────────────────────────

export function SlotGenre({
  indicesGenres,
  cibleGenres,
  totalGenres = 0,
  pity,
}: {
  indicesGenres: string[]
  cibleGenres?: string[]
  totalGenres?: number
  pity?: boolean
}) {
  const hiddenCount = cibleGenres ? 0 : Math.max(0, totalGenres - indicesGenres.length)
  const hasAny = (cibleGenres ?? indicesGenres).length > 0 || hiddenCount > 0

  if (!hasAny) {
    return (
      <Slot label="Genres" pity={pity}>
        <span className="cinemaxd-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Genres" pity={pity}>
      <div className="cinemaxd-chip-row">
        {cibleGenres
          ? cibleGenres.map((g) => {
              const revele = indicesGenres.includes(g)
              return (
                <span key={g} className={`cinemaxd-chip ${revele ? 'match cinemaxd-flip' : 'miss'}`}>
                  {revele ? g : '?'}
                </span>
              )
            })
          : <>
              {indicesGenres.map((g) => (
                <span key={g} className="cinemaxd-chip match cinemaxd-flip">{g}</span>
              ))}
              {Array.from({ length: hiddenCount }, (_, i) => (
                <span key={`hidden-genre-${i}`} className="cinemaxd-chip miss">?</span>
              ))}
            </>}
      </div>
    </Slot>
  )
}

// ─── Nationalités / Langues ───────────────────────────────────────────────────

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })

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
        <span className="cinemaxd-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Pays">
      <div className="cinemaxd-chip-row">
        {ciblePays
          ? ciblePays.map((p) => {
              const revele = indicesPays.includes(p)
              return (
                <span key={p} className={`cinemaxd-chip ${revele ? 'match cinemaxd-flip' : 'miss'}`}>
                  {revele ? countryLabel(p) : '?'}
                </span>
              )
            })
          : <>
              {indicesPays.map((p) => (
                <span key={p} className="cinemaxd-chip match cinemaxd-flip">{countryLabel(p)}</span>
              ))}
              {Array.from({ length: hiddenCount }, (_, i) => (
                <span key={`hidden-pays-${i}`} className="cinemaxd-chip miss">?</span>
              ))}
            </>}
      </div>
    </Slot>
  )
}

// ─── Langue ──────────────────────────────────────────────────────────────────

const languageNames = new Intl.DisplayNames(['fr'], { type: 'language' })

export function languageLabel(code: string): string {
  try {
    const name = languageNames.of(code)
    if (!name) return code
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return code
  }
}

export function SlotLangue({
  langue,
  filmCible,
  pity,
}: {
  langue: string | null
  filmCible: CinemaxdFilm | null
  pity?: boolean
}) {
  const code = filmCible ? filmCible.langue : langue
  if (!code) {
    return (
      <Slot label="Langue" pity={pity}>
        <span className="cinemaxd-hidden">--</span>
      </Slot>
    )
  }
  return (
    <Slot label="Langue" pity={pity}>
      <span className="cinemaxd-chip match cinemaxd-flip">
        {languageLabel(code)}
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
  filmCible: CinemaxdFilm | null
}) {
  const currentYear = new Date().getFullYear()
  let texte: React.ReactNode

  if (filmCible) {
    texte = <span className="cinemaxd-revealed">{filmCible.annee}</span>
  } else if (anneeMin !== null && anneeMax !== null) {
    if (anneeMax - anneeMin === 2) {
      // Only one year possible between the two bounds
      texte = <span className="cinemaxd-revealed cinemaxd-flip">{anneeMin + 1}</span>
    } else {
      texte = (
        <span className="cinemaxd-fourchette">
          Entre <strong>{anneeMin}</strong> et <strong>{anneeMax}</strong>
        </span>
      )
    }
  } else if (anneeMax !== null) {
    texte = (
      <span className="cinemaxd-fourchette">
        Avant <strong>{anneeMax}</strong>
      </span>
    )
  } else if (anneeMin !== null) {
    if (anneeMin + 1 >= currentYear) {
      // "After last year" in the current year uniquely identifies the target
      texte = <span className="cinemaxd-revealed cinemaxd-flip">{anneeMin + 1}</span>
    } else {
      texte = (
        <span className="cinemaxd-fourchette">
          Après <strong>{anneeMin}</strong>
        </span>
      )
    }
  } else {
    texte = <span className="cinemaxd-hidden">--</span>
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
  filmCible: CinemaxdFilm | null
}) {
  let texte: React.ReactNode

  if (filmCible && filmCible.duree > 0) {
    texte = <span className="cinemaxd-revealed">{formatMin(filmCible.duree)}</span>
  } else if (dureeMin !== null && dureeMax !== null) {
    if (dureeMax - dureeMin === 2) {
      texte = <span className="cinemaxd-revealed cinemaxd-flip">{formatMin(dureeMin + 1)}</span>
    } else {
      texte = (
        <span className="cinemaxd-fourchette">
          Entre <strong>{formatMin(dureeMin)}</strong> et <strong>{formatMin(dureeMax)}</strong>
        </span>
      )
    }
  } else if (dureeMax !== null) {
    texte = (
      <span className="cinemaxd-fourchette">
        Moins de <strong>{formatMin(dureeMax)}</strong>
      </span>
    )
  } else if (dureeMin !== null) {
    texte = (
      <span className="cinemaxd-fourchette">
        Plus de <strong>{formatMin(dureeMin)}</strong>
      </span>
    )
  } else {
    texte = <span className="cinemaxd-hidden">--</span>
  }

  return <Slot label="Durée">{texte}</Slot>
}

// ─── Acteurs ──────────────────────────────────────────────────────────────────

export function SlotActeurs({
  indicesActeurs,
  filmCible,
  totalActeurs = 0,
  acteurPhotos,
}: {
  indicesActeurs: string[]
  filmCible: CinemaxdFilm | null
  totalActeurs?: number
  acteurPhotos?: Map<string, string | null>
}) {
  if (filmCible) {
    if (filmCible.acteurs.length === 0) {
      return (
        <Slot label="Acteurs">
          <span className="cinemaxd-hidden">--</span>
        </Slot>
      )
    }
    return (
      <Slot label="Acteurs">
        <div className="cinemaxd-acteurs">
          {filmCible.acteurs.map((a) => {
            const src = a.photo ? `${TMDB_IMG}${a.photo}` : null
            return (
              <div key={a.nom} className="cinemaxd-acteur cinemaxd-acteur-on cinemaxd-flip" title={a.nom}>
                <div className="cinemaxd-acteur-photo">
                  {src ? (
                    <img src={src} alt={a.nom} loading="lazy" />
                  ) : (
                    <span className="cinemaxd-acteur-initiales">
                      {a.nom.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                    </span>
                  )}
                </div>
                <span className="cinemaxd-acteur-nom">{a.nom}</span>
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
        <span className="cinemaxd-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Acteurs">
      <div className="cinemaxd-acteurs">
        {indicesActeurs.map((nom) => {
          const photo = acteurPhotos?.get(nom) ?? null
          const src = photo ? `${TMDB_IMG}${photo}` : null
          return (
            <div key={nom} className="cinemaxd-acteur cinemaxd-acteur-on cinemaxd-flip" title={nom}>
              <div className="cinemaxd-acteur-photo">
                {src ? (
                  <img src={src} alt={nom} loading="lazy" />
                ) : (
                  <span className="cinemaxd-acteur-initiales">
                    {nom.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </span>
                )}
              </div>
              <span className="cinemaxd-acteur-nom">{nom}</span>
            </div>
          )
        })}
        {Array.from({ length: hiddenCount }, (_, i) => (
          <div key={`hidden-acteur-${i}`} className="cinemaxd-acteur" title="Acteur non découvert">
            <div className="cinemaxd-acteur-photo">
              <span className="cinemaxd-acteur-initiales">?</span>
            </div>
            <span className="cinemaxd-acteur-nom">&nbsp;</span>
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
  pity,
}: {
  realisateurRevele: boolean
  realisateurInfo?: { nom: string; photo: string | null } | null
  filmCible: CinemaxdFilm | null
  pity?: boolean
}) {
  const real = filmCible?.realisateurs[0] ?? (realisateurRevele ? realisateurInfo : null) ?? null

  return (
    <Slot label="Réalisateur" pity={pity}>
      {real ? (
        <div className="cinemaxd-acteurs">
          <div className="cinemaxd-acteur cinemaxd-acteur-on cinemaxd-flip">
            <div className="cinemaxd-acteur-photo">
              {real.photo ? (
                <img src={`${TMDB_IMG}${real.photo}`} alt={real.nom} loading="lazy" />
              ) : (
                <span className="cinemaxd-acteur-initiales">
                  {real.nom.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </span>
              )}
            </div>
            <span className="cinemaxd-acteur-nom">{real.nom}</span>
          </div>
        </div>
      ) : (
        <span className="cinemaxd-hidden">--</span>
      )}
    </Slot>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function PersonaBoard({ indices, filmCible, totalIndices, pitySlots, acteurPhotos }: Props) {
  return (
    <div className="cinemaxd-persona">
      <SlotTitre film={filmCible} />
      <div className="cinemaxd-persona-row">
        <SlotGenre
          indicesGenres={indices.genres}
          cibleGenres={filmCible?.genres}
          totalGenres={totalIndices?.genres}
          pity={pitySlots?.has('genre')}
        />
        <SlotNationalite
          indicesPays={indices.pays}
          ciblePays={filmCible?.pays}
          totalPays={totalIndices?.pays}
        />
      </div>
      <div className="cinemaxd-persona-row-3">
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
        <SlotLangue langue={indices.langue} filmCible={filmCible} pity={pitySlots?.has('langue')} />
      </div>
      <SlotActeurs indicesActeurs={indices.acteurs} filmCible={filmCible} totalActeurs={totalIndices?.acteurs} acteurPhotos={acteurPhotos} />
      <SlotReal
        realisateurRevele={indices.realisateurRevele}
        realisateurInfo={indices.realisateurInfo}
        filmCible={filmCible}
        pity={pitySlots?.has('realisateur')}
      />
    </div>
  )
}
