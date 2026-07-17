import confetti from 'canvas-confetti'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type PoliticsCible,
  type PoliticsDeputeInfo,
  type PoliticsMandatType,
  type PoliticsOrientation,
  type PoliticsSearchResult,
  type PoliticsStatus,
  type PoliticsTentative,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { STORAGE_KEYS } from '../../constants/storage'
import { useAuth } from '../../context/AuthContext'
import { today } from '../../utils/date'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 10
const RANK_POINTS = [25, 18, 15, 12, 10, 8, 6, 5, 4, 3]

const CELL = {
  match: 'background:oklch(0.74 0.14 150);color:#fff',
  close: 'background:oklch(0.82 0.14 85);color:oklch(0.34 0.06 80)',
  miss: 'background:oklch(0.72 0.10 28);color:#fff',
} as const

const CHIP = {
  match:
    'background:oklch(0.74 0.14 150/.18);color:oklch(0.40 0.12 150);border:1px solid oklch(0.74 0.14 150/.45)',
  grey: 'background:oklch(0.94 0.008 80);color:oklch(0.55 0.02 64);border:1px solid oklch(0.90 0.012 80)',
} as const

const ORIENTATION_ORDER: PoliticsOrientation[] = [
  'gauche',
  'centre-gauche',
  'centre',
  'droite',
  'extrême droite',
]
const O_IDX = Object.fromEntries(ORIENTATION_ORDER.map((o, i) => [o, i])) as Record<
  PoliticsOrientation,
  number
>

const FRENCH_REGIONS = new Set([
  // Current regions (post-2016)
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Guadeloupe',
  'Guyane',
  'Hauts-de-France',
  'Île-de-France',
  'La Réunion',
  'Martinique',
  'Mayotte',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
  // Pre-2016 historical regions still returned by some Wikipedia extracts
  'Lorraine',
  'Alsace',
  'Champagne-Ardenne',
  'Franche-Comté',
  'Bourgogne',
  'Nord-Pas-de-Calais',
  'Picardie',
  'Haute-Normandie',
  'Basse-Normandie',
  'Midi-Pyrénées',
  'Languedoc-Roussillon',
  'Poitou-Charentes',
  'Limousin',
  'Aquitaine',
  'Rhône-Alpes',
  'Auvergne',
])

const PARTI_COLOR_MAP: [string, string][] = [
  ['renaissance', 'oklch(0.58 0.13 65)'],
  ['rassemblement national', 'oklch(0.42 0.1 250)'],
  ['france insoumise', 'oklch(0.56 0.2 22)'],
  ['républicains', 'oklch(0.5 0.14 255)'],
  ['parti socialiste', 'oklch(0.6 0.16 8)'],
  ['écologistes', 'oklch(0.6 0.15 150)'],
  ['communiste', 'oklch(0.5 0.21 25)'],
  ['reconquête', 'oklch(0.42 0.1 285)'],
  ['horizons', 'oklch(0.66 0.12 225)'],
  ['modem', 'oklch(0.68 0.15 60)'],
]

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalState = {
  tentatives: PoliticsTentative[]
  statut: PoliticsStatus
  cible: PoliticsCible | null
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function mkInitials(prenom: string, nom: string) {
  return ((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase()
}

function ageOf(naissance: string | null, deces?: string | null): number | null {
  if (!naissance) return null
  const ref = deces ? Number.parseInt(deces.slice(0, 4)) : new Date().getFullYear()
  return ref - Number.parseInt(naissance.slice(0, 4))
}

function partiColor(parti: string | null): string {
  if (!parti) return 'oklch(0.70 0.17 45)'
  const lower = parti.toLowerCase()
  return PARTI_COLOR_MAP.find(([k]) => lower.includes(k))?.[1] ?? 'oklch(0.70 0.17 45)'
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${Math.round(n * 100)} %`
}

function abbrevParti(parti: string | null): string {
  if (!parti) return '?'
  const l = parti.toLowerCase()
  if (l.includes('rassemblement national')) return 'RN'
  if (l.includes('france insoumise')) return 'LFI'
  if (l.includes('renaissance')) return 'Ren.'
  if (l.includes('les républicains') || l === 'républicains') return 'LR'
  if (l.includes('parti socialiste')) return 'PS'
  if (l.includes('écologistes') || l.includes('les verts')) return 'Écolos'
  if (l.includes('parti communiste') || l.includes('communiste français')) return 'PCF'
  if (l.includes('reconquête')) return 'Rec.'
  if (l.includes('horizons')) return 'Hor.'
  if (l.includes('modem')) return 'MoDem'
  if (l.includes('debout la france')) return 'DLF'
  if (l.includes('union populaire')) return 'UP'
  if (l.includes('nouveau parti anticap')) return 'NPA'
  return parti.length > 11 ? `${parti.slice(0, 10)}…` : parti
}

function abbrevOrientation(o: PoliticsOrientation): string {
  if (o === 'centre-gauche') return 'Ctr-G'
  if (o === 'extrême droite') return 'Xtr. D'
  if (o === 'gauche') return 'Gauche'
  if (o === 'centre') return 'Centre'
  if (o === 'droite') return 'Droite'
  return o
}

function isForeignRegion(region: string | null): boolean {
  if (!region) return false
  return !FRENCH_REGIONS.has(region)
}

function abbrevRegion(region: string | null): string {
  if (!region) return '?'
  const l = region.toLowerCase()
  // French regions
  if (l.includes("provence-alpes")) return 'PACA'
  if (l.includes("auvergne-rhône") || l.includes("auvergne-rhone")) return 'Auv.-RA'
  if (l.includes("hauts-de-france")) return 'Hauts-Fr.'
  if (l.includes("île-de-france") || l.includes("ile-de-france")) return 'IDF'
  if (l.includes("nouvelle-aquitaine")) return 'Nlle-Aquit.'
  if (l.includes("bourgogne-franche")) return 'Bourg.-FC'
  if (l.includes("centre-val")) return 'Centre-VdL'
  if (l.includes("pays de la loire")) return 'Pays-Loire'
  // Long foreign names
  if (l.includes("états-unis") || l.includes("etats-unis")) return 'États-Unis'
  if (l.includes("corée du sud")) return 'Corée S.'
  if (l.includes("république du congo")) return 'Rép. Congo'
  if (l.includes("marche de brandebourg")) return 'Brandebourg'
  if (l.includes("principauté de valachie")) return 'Valachie'
  if (l.includes("duché de lorraine")) return 'Lorraine'
  if (l.includes("royaume des francs")) return 'Roy. Francs'
  if (l.includes("empire romain")) return 'Emp. romain'
  return region.length > 12 ? `${region.slice(0, 11)}…` : region
}

function abbrevFonction(f: PoliticsMandatType): string {
  if (f === 'Président de la République') return 'Président'
  if (f === 'Premier ministre') return 'Premier min.'
  if (f === 'Chef de parti') return 'Chef parti'
  if (f === 'Sénateur') return 'Sénateur'
  return f
}

// ─── localStorage ─────────────────────────────────────────────────────────────

function loadLocal(): LocalState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.POLITICS_STATE(today()))
    if (!raw) return null
    return JSON.parse(raw) as LocalState
  } catch {
    return null
  }
}

function saveLocal(s: LocalState) {
  try {
    localStorage.setItem(STORAGE_KEYS.POLITICS_STATE(today()), JSON.stringify(s))
  } catch {}
}

// ─── Clue board derivation ────────────────────────────────────────────────────

function deriveClues(tentatives: PoliticsTentative[]) {
  let genre = '?'
  let parti = '?'
  let region = '?'
  const fonctionsConfirmees = new Set<string>()
  let ageMin = 18
  let ageMax = 99
  let oMin = 0
  let oMax = 4
  let scoreMin = 0   // exact lower bound from politiscore comparisons
  let scoreMax = 100 // exact upper bound
  const anciensSet = new Set<string>()

  for (const t of tentatives) {
    const c = t.comparison
    if (genre === '?') {
      if (c.genre.match === 'exact') genre = c.genre.value === 'M' ? 'Homme' : 'Femme'
      else if (c.genre.match === 'wrong') genre = c.genre.value === 'M' ? 'Femme' : 'Homme'
    }
    if (c.currentOrLastParti.match === 'exact' && c.currentOrLastParti.value)
      parti = c.currentOrLastParti.value
    if (c.originRegion.match === 'exact' && c.originRegion.value) region = c.originRegion.value
    for (const f of c.fonctionActuelle.matching) fonctionsConfirmees.add(f)

    const ga = ageOf(c.naissance.value, c.naissance.deces)
    if (ga !== null) {
      if (c.naissance.direction === 'exact') {
        ageMin = ga
        ageMax = ga
      } else if (c.naissance.direction === 'plus-jeune') ageMax = Math.min(ageMax, ga - 1)
      else if (c.naissance.direction === 'plus-age') ageMin = Math.max(ageMin, ga + 1)
    }

    const gOIdx = O_IDX[c.orientation.value] ?? 2
    const gScore = c.orientation.score
    if (c.orientation.match === 'exact') {
      oMin = gOIdx
      oMax = gOIdx
      if (!c.orientation.direction) {
        // Same bucket AND same exact score — pin completely
        scoreMin = gScore
        scoreMax = gScore
      } else if (c.orientation.direction === 'plus-gauche') {
        // Same bucket but target score < guess score
        scoreMax = Math.min(scoreMax, gScore - 1)
      } else if (c.orientation.direction === 'plus-droite') {
        // Same bucket but target score > guess score
        scoreMin = Math.max(scoreMin, gScore + 1)
      }
    } else if (c.orientation.direction === 'plus-gauche') {
      oMax = Math.min(oMax, gOIdx - 1)
      scoreMax = Math.min(scoreMax, gScore - 1)
    } else if (c.orientation.direction === 'plus-droite') {
      oMin = Math.max(oMin, gOIdx + 1)
      scoreMin = Math.max(scoreMin, gScore + 1)
    }

    for (const anc of c.anciennesFonctions.matching) anciensSet.add(anc)
  }

  const fonction = fonctionsConfirmees.size > 0
    ? [...fonctionsConfirmees].map(abbrevFonction as (f: string) => string).join(' · ')
    : '?'

  const leftPct  = scoreMin
  const rightPct = 100 - scoreMax
  const cursorPct = scoreMin === scoreMax && tentatives.length > 0 ? scoreMin : null
  const scaleLabel =
    tentatives.length === 0
      ? '—'
      : oMin === oMax
        ? ORIENTATION_ORDER[oMin]
        : `${ORIENTATION_ORDER[oMin]} → ${ORIENTATION_ORDER[oMax]}`

  let ageLabel = '?'
  if (tentatives.length > 0) {
    if (ageMin === ageMax) ageLabel = `${ageMin} ans`
    else if (ageMin > 18 && ageMax < 99) ageLabel = `${ageMin}–${ageMax} ans`
    else if (ageMax < 99) ageLabel = `≤ ${ageMax} ans`
    else if (ageMin > 18) ageLabel = `≥ ${ageMin} ans`
  }

  return { genre, parti, region, fonction, ageLabel, scaleLabel, leftPct, rightPct, cursorPct, anciens: [...anciensSet] }
}

// ─── Député score panel ────────────────────────────────────────────────────────

function DeputePanel({ info }: { info: PoliticsDeputeInfo }) {
  return (
    <div className="politeki-depute-panel">
      <div className="politeki-depute-item">
        <div className="politeki-depute-meta">
          <span className="politeki-depute-label">Participation</span>
          <span className="politeki-depute-desc">Présence en séance et votes exprimés</span>
        </div>
        <span className="politeki-depute-val">{fmtPct(info.scoreParticipation)}</span>
      </div>
      <div className="politeki-depute-item">
        <div className="politeki-depute-meta">
          <span className="politeki-depute-label">Loyauté</span>
          <span className="politeki-depute-desc">Vote en accord avec son groupe parlementaire</span>
        </div>
        <span className="politeki-depute-val">{fmtPct(info.scoreLoyaute)}</span>
      </div>
      {info.groupe && (
        <div className="politeki-depute-item">
          <span className="politeki-depute-label">Groupe</span>
          <span className="politeki-depute-val">{info.groupe}</span>
        </div>
      )}
      {info.departementNom && (
        <div className="politeki-depute-item">
          <span className="politeki-depute-label">Département</span>
          <span className="politeki-depute-val">{info.departementNom}</span>
        </div>
      )}
    </div>
  )
}

// ─── Row (tableau view) ────────────────────────────────────────────────────────

function TableauRow({ t }: { t: PoliticsTentative }) {
  const c = t.comparison
  const color = partiColor(c.currentOrLastParti.value)

  const genreStyle = c.genre.match === 'exact' ? CELL.match : CELL.miss
  const genreLabel = c.genre.value === 'M' ? 'Homme' : 'Femme'

  const partiStyle =
    c.currentOrLastParti.match === 'exact'
      ? CELL.match
      : c.currentOrLastParti.match === 'meme-famille'
        ? CELL.close
        : CELL.miss
  const partiLabel = abbrevParti(c.currentOrLastParti.value)

  const oriStyle = c.orientation.match === 'exact' ? CELL.match : CELL.miss
  const oriLabel = abbrevOrientation(c.orientation.value)
  const oriArrow =
    c.orientation.direction === 'plus-gauche'
      ? '←'
      : c.orientation.direction === 'plus-droite'
        ? '→'
        : c.orientation.match === 'exact'
          ? '✓'
          : ''

  const ga = ageOf(c.naissance.value, c.naissance.deces)
  const ageStyle =
    c.naissance.direction === 'exact' ? CELL.match : c.naissance.proche ? CELL.close : CELL.miss
  const ageLabel = ga != null ? (c.naissance.deces ? `†${ga}` : String(ga)) : '?'
  const ageArrow =
    c.naissance.direction === 'plus-age'
      ? '↑'
      : c.naissance.direction === 'plus-jeune'
        ? '↓'
        : c.naissance.direction === 'exact'
          ? '✓'
          : ''

  const regionStyle = c.originRegion.match === 'exact' ? CELL.match : CELL.miss
  const regionLabel = abbrevRegion(c.originRegion.value)
  const regionForeign = isForeignRegion(c.originRegion.value)

  const fonctions = c.fonctionActuelle.value
  const fonctionsMatch = c.fonctionActuelle.matching
  const allMatch = fonctions.every((f) => fonctionsMatch.includes(f))
  const anyMatch = fonctions.some((f) => fonctionsMatch.includes(f))
  const fonctionCellStyle = (fonctions.length > 0 && allMatch) ? CELL.match : anyMatch ? CELL.close : CELL.miss

  const condStyle = c.condamnation.match === 'exact' ? CELL.match : CELL.miss
  const condLabel = c.condamnation.condamne ? 'Oui' : 'Non'

  const anciens = c.anciennesFonctions.value
  const matching = c.anciennesFonctions.matching

  return (
    <div className="politeki-guess-card">
      <div className="politeki-tableau-row">
        <div className="politeki-namecell">
          <span className="politeki-avatar" style={{ background: color }}>
            {mkInitials(t.politicien.prenom, t.politicien.nom)}
          </span>
          <div className="politeki-namecell-text">
            <span className="politeki-nom-prenom">{t.politicien.prenom}</span>
            <span className="politeki-nom">
              {t.politicien.nom}{c.naissance.deces ? ' †' : ''}
            </span>
          </div>
        </div>
        <div className="politeki-cell" style={{ cssText: genreStyle } as React.CSSProperties}>
          {genreLabel}
        </div>
        <div className="politeki-cell politeki-cell-text" style={{ cssText: partiStyle } as React.CSSProperties}>
          {partiLabel}
        </div>
        <div className="politeki-cell" style={{ cssText: oriStyle } as React.CSSProperties}>
          <span className="politeki-cell-main">{oriLabel}</span>
          {oriArrow && <span className="politeki-cell-arrow">{oriArrow}</span>}
        </div>
        <div className="politeki-cell" style={{ cssText: ageStyle } as React.CSSProperties}>
          <span className="politeki-cell-main">{ageLabel}</span>
          {ageArrow && <span className="politeki-cell-arrow">{ageArrow}</span>}
        </div>
        <div className="politeki-cell" style={{ cssText: regionStyle } as React.CSSProperties}>
          {regionForeign && <span className="politeki-cell-foreign-badge">🌍 Étranger</span>}
          <span className="politeki-cell-main">{regionLabel}</span>
        </div>
        <div className="politeki-cell" style={{ cssText: fonctionCellStyle } as React.CSSProperties}>
          {fonctions.length === 0
            ? <span className="politeki-cell-main">—</span>
            : fonctions.map((f) => (
                <span
                  key={f}
                  className="politeki-cell-main"
                  style={fonctions.length > 1 ? { opacity: fonctionsMatch.includes(f) ? 1 : 0.55 } : undefined}
                >
                  {abbrevFonction(f)}
                </span>
              ))
          }
        </div>
        <div className="politeki-cell" style={{ cssText: condStyle } as React.CSSProperties}>
          {condLabel}
        </div>
      </div>
      {anciens.length > 0 && (
        <div className="politeki-anciens-row">
          <span className="politeki-anciens-label">Anc. fonctions</span>
          {anciens.map((a) => (
            <span
              key={a}
              className="politeki-chip"
              style={{ cssText: matching.includes(a as PoliticsMandatType) ? CHIP.match : CHIP.grey } as React.CSSProperties}
            >
              {a}
            </span>
          ))}
        </div>
      )}
      {c.condamnation.condamne && (c.condamnation.affaires?.length ?? 0) > 0 && (
        <div className="politeki-condamnation-panel">
          {c.condamnation.affaires!.map((a, i) => (
            <div key={i} className="politeki-condamnation-item">
              <span className="politeki-condamnation-affaire">{a.affaire ?? '—'}</span>
              <div className="politeki-condamnation-tags">
                {a.prison && (
                  <span className="politeki-condamnation-tag politeki-condamnation-tag-prison">
                    🔒 {a.prison}
                  </span>
                )}
                {a.amende && (
                  <span className="politeki-condamnation-tag politeki-condamnation-tag-amende">
                    💶 {a.amende}
                  </span>
                )}
                {a.date && (
                  <span className="politeki-condamnation-tag">{a.date}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {t.deputeInfo && (
        <DeputePanel info={t.deputeInfo} />
      )}
      {t.mepInfo && (
        <DeputePanel info={t.mepInfo} />
      )}
    </div>
  )
}

// ─── Result modal ──────────────────────────────────────────────────────────────

function ResultModal({
  statut,
  cible,
  tentatives,
  onClose,
  onReset,
}: {
  statut: PoliticsStatus
  cible: PoliticsCible | null
  tentatives: PoliticsTentative[]
  onClose: () => void
  onReset: () => void
}) {
  const [shared, setShared] = useState(false)
  const won = statut === 'won'
  const points = won ? (RANK_POINTS[tentatives.length - 1] ?? 1) : 0

  const lastAnciennes = tentatives.at(-1)?.comparison.anciennesFonctions.value ?? []
  const lastFonctions = tentatives.at(-1)?.comparison.fonctionActuelle.value ?? []
  const cibleAge = ageOf(cible?.naissance ?? null, cible?.deces)
  const cibleOri =
    cible != null
      ? ORIENTATION_ORDER[Math.round((cible.politiscore / 100) * 4)]
      : null

  function share() {
    const sym = { match: '🟩', close: '🟨', miss: '🟥' } as const
    const lines = tentatives.map((t) => {
      const c = t.comparison
      return [
        c.genre.match === 'exact' ? sym.match : sym.miss,
        c.currentOrLastParti.match === 'exact' ? sym.match : c.currentOrLastParti.match === 'meme-famille' ? sym.close : sym.miss,
        c.orientation.match === 'exact' ? sym.match : sym.miss,
        c.naissance.direction === 'exact' ? sym.match : c.naissance.proche ? sym.close : sym.miss,
        c.originRegion.match === 'exact' ? sym.match : sym.miss,
        c.fonctionActuelle.matching.length === c.fonctionActuelle.value.length && c.fonctionActuelle.matching.length > 0 ? sym.match : c.fonctionActuelle.matching.length > 0 ? sym.close : sym.miss,
      ].join('')
    })
    const head = `Politeki ${won ? `${tentatives.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`}`
    try {
      navigator.clipboard.writeText(`${head}\n${lines.join('\n')}`)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  return (
    <div className="politeki-modal-overlay" onClick={onClose}>
      <div
        className="politeki-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="politeki-modal-title"
          style={{ color: won ? 'oklch(0.55 0.13 150)' : 'oklch(0.58 0.18 25)' }}
        >
          {won ? 'Trouvé 🎉' : 'Dommage !'}
        </div>

        <div className="politeki-modal-points">
          <span className="politeki-modal-points-value">{points}</span>
          <span className="politeki-modal-points-label">pts</span>
          {won && (
            <span className="politeki-modal-points-detail">
              en {tentatives.length} essai{tentatives.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {cible && (
          <>
            <div
              className="politeki-modal-avatar"
              style={{ background: partiColor(cible.currentOrLastParti) }}
            >
              {mkInitials(cible.prenom, cible.nom)}
            </div>
            <div className="politeki-modal-nom">
              {cible.prenom} {cible.nom}
            </div>
            <div className="politeki-modal-sub">
              {cibleAge != null ? `${cible.deces ? '†' : ''}${cibleAge} ans · ` : ''}
              {cible.genre === 'M' ? 'Homme' : 'Femme'}
            </div>
            {cible.deces && (
              <div className="politeki-modal-deces">
                Décédé(e) le{' '}
                {new Date(cible.deces).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </div>
            )}

            <div className="politeki-modal-grid">
              <div className="politeki-modal-tile">
                <div className="politeki-modal-tile-label">Parti</div>
                <div className="politeki-modal-tile-val">{cible.currentOrLastParti ?? '—'}</div>
              </div>
              <div className="politeki-modal-tile">
                <div className="politeki-modal-tile-label">Positionnement</div>
                <div className="politeki-modal-tile-val">{cibleOri ?? '—'}</div>
              </div>
              <div className="politeki-modal-tile">
                <div className="politeki-modal-tile-label">Région</div>
                <div className="politeki-modal-tile-val">{cible.originRegion ?? '—'}</div>
              </div>
              <div className="politeki-modal-tile">
                <div className="politeki-modal-tile-label">Fonction</div>
                <div className="politeki-modal-tile-val">
                  {lastFonctions.length > 0 ? lastFonctions.join(' · ') : '—'}
                </div>
              </div>
            </div>

            {lastAnciennes.length > 0 && (
              <div className="politeki-modal-tile" style={{ textAlign: 'left', marginTop: 8 }}>
                <div className="politeki-modal-tile-label">Anciennes fonctions</div>
                <div className="politeki-modal-tile-val">{lastAnciennes.join(' · ')}</div>
              </div>
            )}
          </>
        )}

        <div className="politeki-modal-actions">
          <button type="button" className="politeki-btn-secondary" onClick={share}>
            {shared ? 'Copié ✓' : 'Partager'}
          </button>
          <a href="/leaderboard" className="politeki-btn-secondary">
            Classement
          </a>
          {import.meta.env.DEV && (
            <button type="button" className="politeki-btn-primary" onClick={onReset}>
              Rejouer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function Politeki() {
  const { token } = useAuth()

  const [tentatives, setTentatives] = useState<PoliticsTentative[]>([])
  const [statut, setStatut] = useState<PoliticsStatus>('in_progress')
  const [cible, setCible] = useState<PoliticsCible | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PoliticsSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const initialized = useRef(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const gameOver = statut !== 'in_progress'

  const persist = useCallback(
    (t: PoliticsTentative[], s: PoliticsStatus, c: PoliticsCible | null) => {
      saveLocal({ tentatives: t, statut: s, cible: c })
    },
    [],
  )

  // ── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const local = loadLocal()
    if (local) {
      setTentatives(local.tentatives)
      setStatut(local.statut)
      setCible(local.cible)
      setLoading(false)

      if (token) {
        api.politics
          .session()
          .then(({ session }) => {
            if (!session) return
            setTentatives(session.tentatives)
            setStatut(session.statut)
            setCible(session.politicienCible)
            persist(session.tentatives, session.statut, session.politicienCible)
          })
          .catch(() => {})
      }
      return
    }

    if (token) {
      api.politics
        .session()
        .then(({ session }) => {
          if (session) {
            setTentatives(session.tentatives)
            setStatut(session.statut)
            setCible(session.politicienCible)
            persist(session.tentatives, session.statut, session.politicienCible)
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token, persist])

  // ── Search ────────────────────────────────────────────────────────────────

  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q)
      setActiveIdx(-1)
      clearTimeout(searchTimer.current)
      if (q.trim().length < 2) {
        setSuggestions([])
        setOpen(false)
        return
      }
      searchTimer.current = setTimeout(async () => {
        try {
          const results = await api.politics.search(q)
          const guessedIdx = tentatives.map((t) => t.politicianIndex)
          setSuggestions(results.filter((r) => !guessedIdx.includes(r.index)))
          setOpen(true)
        } catch {}
      }, 300)
    },
    [tentatives],
  )

  // ── Guess submission ──────────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (selected: PoliticsSearchResult) => {
      if (gameOver || submitting) return
      setSubmitting(true)
      setError(null)
      setQuery('')
      setSuggestions([])
      setOpen(false)

      try {
        const result = await api.politics.guess(selected.index)

        const newTentative: PoliticsTentative = {
          politicianIndex: selected.index,
          politicien: { prenom: selected.prenom, nom: selected.nom },
          comparison: result.comparison,
          deputeInfo: result.deputeInfo,
          mepInfo: result.mepInfo,
        }

        const newTentatives = [...tentatives, newTentative]
        const newStatut: PoliticsStatus =
          result.statut ??
          (result.correct
            ? 'won'
            : newTentatives.length >= MAX_ATTEMPTS
              ? 'lost'
              : 'in_progress')
        setTentatives(newTentatives)
        setStatut(newStatut)
        setCible(result.politicienCible)
        persist(newTentatives, newStatut, result.politicienCible)

        if (newStatut === 'won') {
          confetti({ particleCount: 170, spread: 72, origin: { y: 0.6 } })
          setTimeout(() => setShowModal(true), 1050)
        } else if (newStatut === 'lost') {
          setTimeout(() => setShowModal(true), 650)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(
          msg.toLowerCase().includes('configuré')
            ? "Aucun politicien configuré pour aujourd'hui."
            : 'Une erreur est survenue. Réessaie.',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [gameOver, submitting, tentatives, persist],
  )

  // ── Dev reset ─────────────────────────────────────────────────────────────

  async function handleReset() {
    try {
      if (token) await api.politics.reset()
      localStorage.removeItem(STORAGE_KEYS.POLITICS_STATE(today()))
    } catch {}
    setTentatives([])
    setStatut('in_progress')
    setCible(null)
    setShowModal(false)
    setError(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  const clues = useMemo(() => deriveClues(tentatives), [tentatives])
  // When the answer is revealed, use the exact politiscore for precision
  const scaleCursorPct = cible !== null ? cible.politiscore : clues.cursorPct
  const scaleLabel = cible !== null && clues.scaleLabel !== '—'
    ? `${clues.scaleLabel} · ${cible.politiscore}`
    : clues.scaleLabel
  const hasGuesses = tentatives.length > 0
  const guessCount = tentatives.length

  const dots = useMemo(
    () => Array.from({ length: MAX_ATTEMPTS }, (_, i) => ({
      color: i < guessCount ? 'oklch(0.70 0.17 45)' : 'oklch(0.885 0.014 80)',
    })),
    [guessCount],
  )

  let message = ''
  let messageColor = 'oklch(0.48 0.02 62)'
  if (statut === 'won') {
    message = `Bravo ! C'était ${cible ? `${cible.prenom} ${cible.nom}` : '…'}.`
    messageColor = 'oklch(0.55 0.13 150)'
  } else if (statut === 'lost') {
    message = `Perdu… C'était ${cible ? `${cible.prenom} ${cible.nom}` : '…'}.`
    messageColor = 'oklch(0.58 0.18 25)'
  } else {
    const r = MAX_ATTEMPTS - guessCount
    message = `${r} essai${r > 1 ? 's' : ''} restant${r > 1 ? 's' : ''}.`
  }

  const reversedTentatives = useMemo(() => [...tentatives].reverse(), [tentatives])

  if (loading) {
    return (
      <div className="game-shell">
        <GameHeader title="Politeki" subtitle={`Devine le politicien du jour en ${MAX_ATTEMPTS} essais`} />
        <main className="container">
          <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: '3rem' }}>
            Chargement…
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="game-shell">
      <GameHeader
        title="Politeki"
        subtitle={`Devine le politicien du jour en ${MAX_ATTEMPTS} essais`}
      />

      <main className="container">
        <div className="politeki-game">

          {/* ── Clue board ───────────────────────────────────────────────── */}
          <section className="politeki-clueboard">
              <div className="politeki-clueboard-title">
                <span>Ce qu'on sait</span>
                <span className="politeki-clueboard-subtitle">— déduit de tes essais</span>
              </div>

              {/* Politiscale */}
              <div className="politeki-scale-wrap">
                <div className="politeki-scale-header">
                  <span className="politeki-scale-heading">Politiscale</span>
                  <span className="politeki-scale-label">{scaleLabel}</span>
                </div>
                <div className="politeki-scale-bar-wrap">
                  <div className="politeki-scale-bar">
                    <div
                      className="politeki-scale-mask politeki-scale-mask-left"
                      style={{ width: `${clues.leftPct}%` }}
                    />
                    <div
                      className="politeki-scale-mask politeki-scale-mask-right"
                      style={{ width: `${clues.rightPct}%` }}
                    />
                  </div>
                  {scaleCursorPct !== null && (
                    <div
                      className="politeki-scale-cursor"
                      style={{ left: `${scaleCursorPct}%` }}
                    />
                  )}
                </div>
                <div className="politeki-scale-ticks">
                  <span>Gauche</span>
                  <span>Centre</span>
                  <span>Droite</span>
                </div>
              </div>

              {/* Tiles */}
              <div className="politeki-tiles">
                {[
                  { label: 'Genre', value: clues.genre },
                  { label: 'Âge', value: clues.ageLabel },
                  { label: 'Parti', value: clues.parti },
                  { label: "Région d'origine", value: clues.region },
                  { label: 'Fonction', value: clues.fonction },
                ].map(({ label, value }) => (
                  <div key={label} className="politeki-tile">
                    <div className="politeki-tile-label">{label}</div>
                    <div className="politeki-tile-val">{value}</div>
                  </div>
                ))}
              </div>

              {/* Anciennes confirmées */}
              <div className="politeki-tile politeki-tile-wide">
                <div className="politeki-tile-label">Anciennes fonctions confirmées</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4 }}>
                  {clues.anciens.length > 0
                    ? clues.anciens.map((a) => (
                        <span
                          key={a}
                          className="politeki-chip"
                          style={{ cssText: CHIP.match } as React.CSSProperties}
                        >
                          {a}
                        </span>
                      ))
                    : <span style={{ fontSize: 14, fontWeight: 700, color: 'oklch(0.55 0.02 64)' }}>—</span>}
                </div>
              </div>
            </section>

          {/* ── Status ───────────────────────────────────────────────────── */}
          <div className="politeki-status">
            <span style={{ fontSize: '14.5px', fontWeight: 600, color: messageColor }}>{message}</span>
            <div className="politeki-status-right">
              <div className="politeki-dots">
                {dots.map((d, i) => (
                  <span
                    key={i}
                    className="politeki-dot"
                    style={{ background: d.color }}
                  />
                ))}
              </div>
              <span className="politeki-counter">
                {guessCount} / {MAX_ATTEMPTS}
              </span>
            </div>
          </div>

          {/* ── Search ───────────────────────────────────────────────────── */}
          {!gameOver && (
            <div className="politeki-search-wrap">
              <div className="politeki-search-row">
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const s =
                          activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0]
                        if (s) handleGuess(s)
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setActiveIdx((i) => Math.max(i - 1, 0))
                      } else if (e.key === 'Escape') {
                        setOpen(false)
                      }
                    }}
                    onFocus={() => query.trim().length >= 2 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder="Tape le nom d'un politicien…"
                    autoComplete="off"
                    disabled={submitting}
                    className="politeki-search-input"
                  />
                  {open && (
                    <ul className="politeki-dropdown">
                      {suggestions.length === 0 ? (
                        <li className="politeki-dropdown-empty">Aucun politicien trouvé</li>
                      ) : (
                        suggestions.map((s, i) => (
                          <li
                            key={s.index}
                            onMouseDown={() => handleGuess(s)}
                            className={`politeki-dropdown-item${i === activeIdx ? ' politeki-dropdown-item-active' : ''}`}
                          >
                            <span
                              className="politeki-avatar politeki-avatar-sm"
                              style={{ background: partiColor(s.currentOrLastParti) }}
                            >
                              {mkInitials(s.prenom, s.nom)}
                            </span>
                            <span className="politeki-dropdown-nom">
                              {s.prenom} {s.nom}{s.deces ? ' †' : ''}
                            </span>
                            <span className="politeki-dropdown-parti">
                              {s.currentOrLastParti ?? ''}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const s = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0]
                    if (s) handleGuess(s)
                  }}
                  disabled={submitting || suggestions.length === 0}
                  className="politeki-btn-primary"
                >
                  Deviner
                </button>
              </div>
              {error && <p className="politeki-error">{error}</p>}
            </div>
          )}

          {/* ── Legend ───────────────────────────────────────────────────── */}
          {hasGuesses && (
            <div className="politeki-legend">
              <span className="politeki-legend-item">
                <span className="politeki-legend-swatch" style={{ background: 'oklch(0.74 0.14 150)' }} />
                Correct
              </span>
              <span className="politeki-legend-item">
                <span className="politeki-legend-swatch" style={{ background: 'oklch(0.82 0.14 85)' }} />
                Proche
              </span>
              <span className="politeki-legend-item">
                <span className="politeki-legend-swatch" style={{ background: 'oklch(0.72 0.10 28)' }} />
                Faux
              </span>
              <span className="politeki-legend-item">↑↓ direction</span>
            </div>
          )}

          {/* ── History ───────────────────────────────────────────────────── */}
          {hasGuesses && (
            <div className="politeki-tableau-wrap">
              <div className="politeki-tableau-container">
                <div className="politeki-tableau-header">
                  <span className="politeki-col-label">Politicien</span>
                  <span className="politeki-col-label politeki-col-center">Genre</span>
                  <span className="politeki-col-label politeki-col-center">Parti</span>
                  <span className="politeki-col-label politeki-col-center">Axe G–D</span>
                  <span className="politeki-col-label politeki-col-center">Âge</span>
                  <span className="politeki-col-label politeki-col-center">Région</span>
                  <span className="politeki-col-label politeki-col-center">Fonction</span>
                  <span className="politeki-col-label politeki-col-center">Condamné</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reversedTentatives.map((t) => (
                    <TableauRow key={t.politicianIndex} t={t} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="politeki-footer">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Un nouveau politicien chaque jour.
            </span>
            {import.meta.env.DEV && (
              <button
                type="button"
                className="politeki-dev-reset"
                onClick={handleReset}
              >
                [dev] réinitialiser
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && statut !== 'in_progress' && (
        <ResultModal
          statut={statut}
          cible={cible}
          tentatives={tentatives}
          onClose={() => setShowModal(false)}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
