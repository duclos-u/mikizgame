import type { VinymixArtist, VinymixGuess } from '../../api/client'

const FOLLOWER_TIERS = [
  { max: 1_000_000, label: '< 1M' },
  { max: 5_000_000, label: '1M–5M' },
  { max: 10_000_000, label: '5M–10M' },
  { max: 50_000_000, label: '10M–50M' },
  { max: Number.POSITIVE_INFINITY, label: '50M+' },
]

function followerTierLabel(n: number): string {
  return (FOLLOWER_TIERS.find((t) => n < t.max) ?? FOLLOWER_TIERS[FOLLOWER_TIERS.length - 1]).label
}

// ─── Country helpers ──────────────────────────────────────────────────────────

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })

function isoToFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '🏳️'
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

function countryLabel(code: string): string {
  try { return countryNames.of(code) ?? code } catch { return code }
}

// ─── Gender helpers ───────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculin',
  female: 'Féminin',
  mixed: 'Mixte',
}

// ─── Persona derivation ───────────────────────────────────────────────────────

type PersonaState = {
  revealedYear: number | null
  yearMin: number | null
  yearMax: number | null
  revealedCountry: string | null
  revealedMemberCount: number | null
  revealedPopularity: string | null
  revealedGender: string | null
  revealedGenres: string[]
}

function derivePersona(guesses: VinymixGuess[]): PersonaState {
  let revealedYear: number | null = null
  let yearMin: number | null = null
  let yearMax: number | null = null
  let revealedCountry: string | null = null
  let revealedMemberCount: number | null = null
  let revealedPopularity: string | null = null
  let revealedGender: string | null = null
  const revealedGenres = new Set<string>()

  for (const { artist, clues } of guesses) {
    for (const clue of clues) {
      switch (clue.key) {
        case 'creationYear':
          if (clue.status === 'match') {
            revealedYear = artist.creationYear
          } else if (artist.creationYear !== null) {
            const y = artist.creationYear
            if (clue.direction === 'up') yearMin = yearMin === null ? y : Math.max(yearMin, y)
            else if (clue.direction === 'down') yearMax = yearMax === null ? y : Math.min(yearMax, y)
          }
          break
        case 'country':
          if (clue.status === 'match') revealedCountry = artist.country
          break
        case 'memberCount':
          if (clue.status === 'match') revealedMemberCount = artist.memberCount
          break
        case 'popularity':
          if (clue.status === 'match') revealedPopularity = clue.value
          break
        case 'gender':
          if (clue.status === 'match') revealedGender = artist.gender
          break
        default:
          if (clue.key.startsWith('genre-') && clue.status === 'match') {
            revealedGenres.add(clue.value)
          }
      }
    }
  }

  return { revealedYear, yearMin, yearMax, revealedCountry, revealedMemberCount, revealedPopularity, revealedGender, revealedGenres: [...revealedGenres] }
}

// ─── Generic slot ─────────────────────────────────────────────────────────────

function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cinemaxd-slot">
      <span className="cinemaxd-slot-label">{label}</span>
      <div className="cinemaxd-slot-body">{children}</div>
    </div>
  )
}

// ─── Name slot ────────────────────────────────────────────────────────────────

function SlotName({ targetArtist }: { targetArtist: VinymixArtist | null }) {
  return (
    <Slot label="Artiste">
      {targetArtist ? (
        <span className="cinemaxd-revealed cinemaxd-flip cinemaxd-titre-reveal">{targetArtist.name}</span>
      ) : (
        <span className="cinemaxd-hidden">— — —</span>
      )}
    </Slot>
  )
}

// ─── Year slot ────────────────────────────────────────────────────────────────

function SlotYear({
  revealedYear, yearMin, yearMax, targetArtist,
}: {
  revealedYear: number | null
  yearMin: number | null
  yearMax: number | null
  targetArtist: VinymixArtist | null
}) {
  const currentYear = new Date().getFullYear()
  let content: React.ReactNode

  if (targetArtist) {
    content = <span className="cinemaxd-revealed">{targetArtist.creationYear ?? '?'}</span>
  } else if (revealedYear !== null) {
    content = <span className="cinemaxd-revealed cinemaxd-flip">{revealedYear}</span>
  } else if (yearMin !== null && yearMax !== null) {
    if (yearMax - yearMin === 2) {
      content = <span className="cinemaxd-revealed cinemaxd-flip">{yearMin + 1}</span>
    } else {
      content = (
        <span className="cinemaxd-fourchette">
          Entre <strong>{yearMin}</strong> et <strong>{yearMax}</strong>
        </span>
      )
    }
  } else if (yearMin !== null) {
    if (yearMin + 1 >= currentYear) {
      content = <span className="cinemaxd-revealed cinemaxd-flip">{yearMin + 1}</span>
    } else {
      content = (
        <span className="cinemaxd-fourchette">
          Après <strong>{yearMin}</strong>
        </span>
      )
    }
  } else if (yearMax !== null) {
    content = (
      <span className="cinemaxd-fourchette">
        Avant <strong>{yearMax}</strong>
      </span>
    )
  } else {
    content = <span className="cinemaxd-hidden">--</span>
  }

  return <Slot label="Création">{content}</Slot>
}

// ─── Country slot ─────────────────────────────────────────────────────────────

function SlotCountry({
  revealedCountry, targetArtist,
}: {
  revealedCountry: string | null
  targetArtist: VinymixArtist | null
}) {
  const code = targetArtist ? targetArtist.country : revealedCountry
  const isNewReveal = !targetArtist && !!revealedCountry

  if (!code) {
    return (
      <Slot label="Pays">
        <span className="cinemaxd-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Pays">
      <span
        className={`cinemaxd-flag cinemaxd-flag-on${isNewReveal ? ' cinemaxd-flip' : ''}`}
        title={countryLabel(code)}
      >
        {isoToFlag(code)}
      </span>
      <span className={`cinemaxd-revealed${isNewReveal ? ' cinemaxd-flip' : ''}`}>
        {countryLabel(code)}
      </span>
    </Slot>
  )
}

// ─── Gender slot ──────────────────────────────────────────────────────────────

function SlotGender({
  revealedGender, targetArtist,
}: {
  revealedGender: string | null
  targetArtist: VinymixArtist | null
}) {
  const gender = targetArtist ? targetArtist.gender : revealedGender
  const isNewReveal = !targetArtist && !!revealedGender

  return (
    <Slot label="Sexe">
      {gender ? (
        <span className={`cinemaxd-revealed${isNewReveal ? ' cinemaxd-flip' : ''}`}>
          {GENDER_LABELS[gender] ?? gender}
        </span>
      ) : (
        <span className="cinemaxd-hidden">--</span>
      )}
    </Slot>
  )
}

// ─── Members slot ─────────────────────────────────────────────────────────────

function SlotMembers({
  revealedMemberCount, targetArtist,
}: {
  revealedMemberCount: number | null
  targetArtist: VinymixArtist | null
}) {
  const count = targetArtist ? targetArtist.memberCount : revealedMemberCount
  const isNewReveal = !targetArtist && revealedMemberCount !== null

  return (
    <Slot label="Membres">
      {count !== null ? (
        <span className={`cinemaxd-revealed${isNewReveal ? ' cinemaxd-flip' : ''}`}>
          {count === 1 ? 'Solo' : count}
        </span>
      ) : (
        <span className="cinemaxd-hidden">--</span>
      )}
    </Slot>
  )
}

// ─── Popularity slot ──────────────────────────────────────────────────────────

function SlotPopularity({
  revealedPopularity, targetArtist,
}: {
  revealedPopularity: string | null
  targetArtist: VinymixArtist | null
}) {
  const label = targetArtist
    ? followerTierLabel(targetArtist.spotifyFollowers)
    : revealedPopularity
  const isNewReveal = !targetArtist && !!revealedPopularity

  return (
    <Slot label="Popularité">
      {label ? (
        <span className={`cinemaxd-revealed${isNewReveal ? ' cinemaxd-flip' : ''}`}>{label}</span>
      ) : (
        <span className="cinemaxd-hidden">--</span>
      )}
    </Slot>
  )
}

// ─── Genres slot ──────────────────────────────────────────────────────────────

function SlotGenres({
  revealedGenres, targetArtist,
}: {
  revealedGenres: string[]
  targetArtist: VinymixArtist | null
}) {
  const displayGenres = targetArtist ? targetArtist.genres.slice(0, 2) : revealedGenres.slice(0, 2)

  if (displayGenres.length === 0) {
    return (
      <Slot label="Genres">
        <span className="cinemaxd-hidden">--</span>
      </Slot>
    )
  }

  return (
    <Slot label="Genres">
      <div className="cinemaxd-tags">
        {displayGenres.map((g) => {
          const revealed = !targetArtist || revealedGenres.includes(g)
          return (
            <span key={g} className={`cinemaxd-tag${revealed ? ' cinemaxd-tag-on cinemaxd-flip' : ''}`}>
              {g}
            </span>
          )
        })}
      </div>
    </Slot>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PersonaBoard({ guesses, targetArtist }: { guesses: VinymixGuess[]; targetArtist: VinymixArtist | null }) {
  const persona = derivePersona(guesses)

  return (
    <div className="vinymix-persona">
      <SlotName targetArtist={targetArtist} />
      <div className="vinymix-persona-row">
        <SlotYear
          revealedYear={persona.revealedYear}
          yearMin={persona.yearMin}
          yearMax={persona.yearMax}
          targetArtist={targetArtist}
        />
        <SlotCountry revealedCountry={persona.revealedCountry} targetArtist={targetArtist} />
        <SlotGender revealedGender={persona.revealedGender} targetArtist={targetArtist} />
      </div>
      <div className="vinymix-persona-row">
        <SlotMembers revealedMemberCount={persona.revealedMemberCount} targetArtist={targetArtist} />
        <SlotPopularity revealedPopularity={persona.revealedPopularity} targetArtist={targetArtist} />
      </div>
      <SlotGenres revealedGenres={persona.revealedGenres} targetArtist={targetArtist} />
    </div>
  )
}
