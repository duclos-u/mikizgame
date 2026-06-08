import type { CineclueFilm, CineclueIndices } from '../../api/client'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185'

type Props = {
  indices: CineclueIndices
  filmCible: CineclueFilm | null
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
}: {
  indicesGenres: string[]
  cibleGenres?: string[]
}) {
  const genres = cibleGenres ?? indicesGenres

  if (genres.length === 0 && indicesGenres.length === 0) {
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
          ? // Fin de partie : on affiche tous les genres cibles, révélés ou non
            cibleGenres.map((g) => {
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
          : // En cours : on affiche uniquement les genres déjà révélés
            indicesGenres.map((g) => (
              <span key={g} className="cineclue-tag cineclue-tag-on cineclue-flip">
                {g}
              </span>
            ))}
      </div>
    </Slot>
  )
}

// ─── Nationalités / Langues ───────────────────────────────────────────────────

const DRAPEAUX: Record<string, string> = {
  'États-Unis': '🇺🇸',
  France: '🇫🇷',
  'Royaume-Uni': '🇬🇧',
  Allemagne: '🇩🇪',
  Italie: '🇮🇹',
  Espagne: '🇪🇸',
  Japon: '🇯🇵',
  'Corée du Sud': '🇰🇷',
  Australie: '🇦🇺',
  Canada: '🇨🇦',
  Inde: '🇮🇳',
  Chine: '🇨🇳',
  Mexique: '🇲🇽',
  Russie: '🇷🇺',
  Suède: '🇸🇪',
  Danemark: '🇩🇰',
  Norvège: '🇳🇴',
  Finlande: '🇫🇮',
  Autriche: '🇦🇹',
  Belgique: '🇧🇪',
  Suisse: '🇨🇭',
  Portugal: '🇵🇹',
  'Pays-Bas': '🇳🇱',
  Pologne: '🇵🇱',
  Brésil: '🇧🇷',
  Argentine: '🇦🇷',
  Ireland: '🇮🇪',
  'Nouvelle-Zélande': '🇳🇿',
  Hongkong: '🇭🇰',
  'Hong Kong': '🇭🇰',
  Israël: '🇮🇱',
  'République tchèque': '🇨🇿',
  Hongrie: '🇭🇺',
  Roumanie: '🇷🇴',
  Grèce: '🇬🇷',
  Turquie: '🇹🇷',
  Iran: '🇮🇷',
}

export function SlotNationalite({
  indicesPays,
  ciblePays,
}: {
  indicesPays: string[]
  ciblePays?: string[]
}) {
  const pays = ciblePays ?? indicesPays

  if (pays.length === 0 && indicesPays.length === 0) {
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
              const flag = DRAPEAUX[p] ?? '🏳️'
              return (
                <span
                  key={p}
                  title={revele ? p : '?'}
                  className={`cineclue-flag${revele ? ' cineclue-flag-on cineclue-flip' : ''}`}
                >
                  {revele ? flag : '🏴'}
                </span>
              )
            })
          : indicesPays.map((p) => (
              <span key={p} title={p} className="cineclue-flag cineclue-flag-on cineclue-flip">
                {DRAPEAUX[p] ?? '🏳️'}
              </span>
            ))}
      </div>
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
  let texte: React.ReactNode

  if (filmCible) {
    // Partie terminée : on affiche l'année exacte
    texte = <span className="cineclue-revealed">{filmCible.annee}</span>
  } else if (anneeMin !== null && anneeMax !== null) {
    texte = (
      <span className="cineclue-fourchette">
        Entre <strong>{anneeMin}</strong> et <strong>{anneeMax}</strong>
      </span>
    )
  } else if (anneeMax !== null) {
    texte = (
      <span className="cineclue-fourchette">
        Avant <strong>{anneeMax}</strong>
      </span>
    )
  } else if (anneeMin !== null) {
    texte = (
      <span className="cineclue-fourchette">
        Après <strong>{anneeMin}</strong>
      </span>
    )
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
}: {
  indicesActeurs: string[]
  filmCible: CineclueFilm | null
}) {
  const acteurs = filmCible?.acteurs ?? []

  const hasAny = acteurs.length > 0 || indicesActeurs.length > 0

  if (!hasAny) {
    return (
      <Slot label="Acteurs">
        <span className="cineclue-hidden">--</span>
      </Slot>
    )
  }

  const liste = filmCible
    ? acteurs
    : indicesActeurs.map((nom) => ({ nom, photo: null }))

  return (
    <Slot label="Acteurs">
      <div className="cineclue-acteurs">
        {liste.map((a) => {
          const revele = filmCible !== null ? true : indicesActeurs.includes(a.nom)
          const src = a.photo ? `${TMDB_IMG}${a.photo}` : null
          return (
            <div
              key={a.nom}
              className={`cineclue-acteur${revele ? ' cineclue-acteur-on cineclue-flip' : ''}`}
              title={a.nom}
            >
              <div className="cineclue-acteur-photo">
                {src && revele ? (
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
              <span className="cineclue-acteur-nom">{revele ? a.nom : '?'}</span>
            </div>
          )
        })}
      </div>
    </Slot>
  )
}

// ─── Réalisateur ──────────────────────────────────────────────────────────────

export function SlotReal({
  realisateurRevele,
  filmCible,
}: {
  realisateurRevele: boolean
  filmCible: CineclueFilm | null
}) {
  const real = filmCible?.realisateurs[0] ?? null
  const shown = realisateurRevele || filmCible !== null

  return (
    <Slot label="Réalisateur">
      {shown && real ? (
        <div className="cineclue-real cineclue-flip">
          {real.photo && (
            <img
              src={`${TMDB_IMG}${real.photo}`}
              alt={real.nom}
              className="cineclue-real-photo"
              loading="lazy"
            />
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

export function PersonaBoard({ indices, filmCible }: Props) {
  return (
    <div className="cineclue-persona">
      <SlotTitre film={filmCible} />
      <div className="cineclue-persona-row">
        <SlotGenre
          indicesGenres={indices.genres}
          cibleGenres={filmCible?.genres}
        />
        <SlotNationalite
          indicesPays={indices.pays}
          ciblePays={filmCible?.pays}
        />
      </div>
      <div className="cineclue-persona-row">
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
      </div>
      <SlotActeurs indicesActeurs={indices.acteurs} filmCible={filmCible} />
      <SlotReal realisateurRevele={indices.realisateurRevele} filmCible={filmCible} />
    </div>
  )
}
