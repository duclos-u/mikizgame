import confetti from 'canvas-confetti'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type FootixCible,
  type FootixComparison,
  type FootixSearchResult,
  type FootixStatus,
  type FootixTentative,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { STORAGE_KEYS } from '../../constants/storage'
import { useAuth } from '../../context/AuthContext'
import { today } from '../../utils/date'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 8
const RANK_POINTS = [25, 18, 15, 12, 10, 8, 6, 5]

const CELL = {
  match: 'background:oklch(0.74 0.14 150);color:#fff',
  close: 'background:oklch(0.82 0.14 85);color:oklch(0.34 0.06 80)',
  miss: 'background:oklch(0.72 0.10 28);color:#fff',
} as const

const CONFEDERATION_FLAG: Record<string, string> = {
  UEFA: '🇪🇺',
  CONMEBOL: '🌎',
  CONCACAF: '🌍',
  CAF: '🌍',
  AFC: '🌏',
  OFC: '🌏',
}

const POSTE_ABBREV: Record<string, string> = {
  Gardien: 'GK',
  Défenseur: 'DEF',
  Milieu: 'MIL',
  Attaquant: 'ATT',
}

const LIGUE_COLOR_MAP: [string, string][] = [
  ['premier league', 'oklch(0.55 0.18 290)'],
  ['la liga', 'oklch(0.55 0.20 25)'],
  ['bundesliga', 'oklch(0.62 0.16 50)'],
  ['serie a', 'oklch(0.45 0.15 250)'],
  ['ligue 1', 'oklch(0.52 0.18 245)'],
  ['saudi pro league', 'oklch(0.52 0.15 145)'],
  ['mls', 'oklch(0.48 0.15 260)'],
  ['süper lig', 'oklch(0.55 0.18 25)'],
]

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalState = {
  tentatives: FootixTentative[]
  statut: FootixStatus
  cible: FootixCible | null
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function mkInitials(prenom: string, nom: string) {
  return ((prenom[0] ?? '') + (nom[0] ?? '')).toUpperCase()
}

function ligueColor(ligue: string): string {
  const lower = ligue.toLowerCase()
  return LIGUE_COLOR_MAP.find(([k]) => lower.includes(k))?.[1] ?? 'oklch(0.55 0.08 240)'
}

// ─── localStorage ─────────────────────────────────────────────────────────────

function loadLocal(): LocalState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOOTIX_STATE(today()))
    if (!raw) return null
    return JSON.parse(raw) as LocalState
  } catch {
    return null
  }
}

function saveLocal(s: LocalState) {
  try {
    localStorage.setItem(STORAGE_KEYS.FOOTIX_STATE(today()), JSON.stringify(s))
  } catch {}
}

// ─── Clue board derivation ────────────────────────────────────────────────────

function deriveClues(tentatives: FootixTentative[]) {
  let nationalite = '?'
  let confederation = '?'
  let poste = '?'
  let ligue = '?'
  let ageMin = 1970
  let ageMax = 2010

  for (const t of tentatives) {
    const c = t.comparison
    if (c.nationalite.match === 'exact') {
      nationalite = c.nationalite.value
      confederation = c.nationalite.confederation
    } else if (confederation === '?' && c.nationalite.match === 'meme-confederation') {
      confederation = c.nationalite.confederation
    }
    if (c.poste.match === 'exact') poste = c.poste.value
    if (c.club.match === 'exact' || c.club.match === 'meme-ligue') {
      if (ligue === '?' || c.club.match === 'exact') ligue = c.club.ligue
    }

    const yr = c.naissance.value
    if (c.naissance.direction === 'exact') {
      ageMin = yr
      ageMax = yr
    } else if (c.naissance.direction === 'plus-jeune') {
      ageMax = Math.min(ageMax, yr - 1)
    } else if (c.naissance.direction === 'plus-vieux') {
      ageMin = Math.max(ageMin, yr + 1)
    }
  }

  let ageLabel = '?'
  if (tentatives.length > 0) {
    if (ageMin === ageMax) ageLabel = String(ageMin)
    else if (ageMin > 1970 && ageMax < 2010) ageLabel = `${ageMin}–${ageMax}`
    else if (ageMax < 2010) ageLabel = `≤ ${ageMax}`
    else if (ageMin > 1970) ageLabel = `≥ ${ageMin}`
  }

  return { nationalite, confederation, poste, ligue, ageLabel }
}

// ─── Guess row ────────────────────────────────────────────────────────────────

function GuessRow({ t, num }: { t: FootixTentative; num: number }) {
  const c: FootixComparison = t.comparison
  const color = ligueColor(c.club.ligue)

  const natStyle =
    c.nationalite.match === 'exact'
      ? CELL.match
      : c.nationalite.match === 'meme-confederation'
        ? CELL.close
        : CELL.miss

  const posteStyle = c.poste.match === 'exact' ? CELL.match : CELL.miss

  const yrStyle =
    c.naissance.direction === 'exact'
      ? CELL.match
      : c.naissance.proche
        ? CELL.close
        : CELL.miss
  const yrArrow =
    c.naissance.direction === 'plus-vieux'
      ? '↑'
      : c.naissance.direction === 'plus-jeune'
        ? '↓'
        : '✓'

  const clubStyle =
    c.club.match === 'exact' ? CELL.match : c.club.match === 'meme-ligue' ? CELL.close : CELL.miss
  const clubLabel = c.club.match === 'meme-ligue' ? c.club.ligue : c.club.value

  return (
    <div className="footix-guess-row">
      <div className="footix-guess-num">{num}</div>
      <div className="footix-guess-identity">
        <span className="footix-avatar" style={{ background: color }}>
          {mkInitials(t.footballer.prenom, t.footballer.nom)}
        </span>
        <div className="footix-guess-name">
          <span className="footix-guess-prenom">{t.footballer.prenom}</span>
          <span className="footix-guess-nom">{t.footballer.nom}</span>
        </div>
      </div>

      <div className="footix-cell" style={{ cssText: natStyle } as React.CSSProperties}>
        <span className="footix-cell-main">{c.nationalite.value}</span>
        {c.nationalite.match !== 'exact' && (
          <span className="footix-cell-sub">{CONFEDERATION_FLAG[c.nationalite.confederation] ?? ''} {c.nationalite.confederation}</span>
        )}
      </div>

      <div className="footix-cell" style={{ cssText: posteStyle } as React.CSSProperties}>
        {POSTE_ABBREV[c.poste.value] ?? c.poste.value}
      </div>

      <div className="footix-cell" style={{ cssText: yrStyle } as React.CSSProperties}>
        <span className="footix-cell-main">{c.naissance.value}</span>
        {c.naissance.direction !== 'exact' && (
          <span className="footix-cell-arrow">{yrArrow}</span>
        )}
      </div>

      <div className="footix-cell footix-cell-club" style={{ cssText: clubStyle } as React.CSSProperties}>
        <span className="footix-cell-main">{clubLabel}</span>
        {c.club.match === 'exact' && (
          <span className="footix-cell-sub">{c.club.ligue}</span>
        )}
      </div>
    </div>
  )
}

// ─── Result modal ─────────────────────────────────────────────────────────────

function ResultModal({
  statut,
  cible,
  tentatives,
  onClose,
  onReset,
}: {
  statut: FootixStatus
  cible: FootixCible | null
  tentatives: FootixTentative[]
  onClose: () => void
  onReset: () => void
}) {
  const [shared, setShared] = useState(false)
  const won = statut === 'won'
  const points = won ? (RANK_POINTS[tentatives.length - 1] ?? 1) : 0

  function share() {
    const sym = { match: '🟩', close: '🟨', miss: '🟥' } as const
    const lines = tentatives.map((t) => {
      const c = t.comparison
      return [
        c.nationalite.match === 'exact' ? sym.match : c.nationalite.match === 'meme-confederation' ? sym.close : sym.miss,
        c.poste.match === 'exact' ? sym.match : sym.miss,
        c.naissance.direction === 'exact' ? sym.match : c.naissance.proche ? sym.close : sym.miss,
        c.club.match === 'exact' ? sym.match : c.club.match === 'meme-ligue' ? sym.close : sym.miss,
      ].join('')
    })
    const head = `Footix ⚽ ${won ? `${tentatives.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`}`
    try {
      navigator.clipboard.writeText(`${head}\n${lines.join('\n')}`)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  const color = cible ? ligueColor(cible.ligue) : 'oklch(0.55 0.08 240)'

  return (
    <div className="footix-modal-overlay" onClick={onClose}>
      <div
        className="footix-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="footix-modal-title"
          style={{ color: won ? 'oklch(0.55 0.13 150)' : 'oklch(0.58 0.18 25)' }}
        >
          {won ? 'But ! 🎉' : 'Hors jeu !'}
        </div>

        <div className="footix-modal-points">
          <span className="footix-modal-points-value">{points}</span>
          <span className="footix-modal-points-label">pts</span>
          {won && (
            <span className="footix-modal-points-detail">
              en {tentatives.length} essai{tentatives.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {cible && (
          <>
            <div className="footix-modal-avatar" style={{ background: color }}>
              {mkInitials(cible.prenom, cible.nom)}
            </div>
            <div className="footix-modal-nom">
              {cible.prenom} {cible.nom}
            </div>
            <div className="footix-modal-sub">
              {cible.poste} · {cible.naissance} · {cible.nationalite}
            </div>
            <div className="footix-modal-grid">
              <div className="footix-modal-tile">
                <div className="footix-modal-tile-label">Club</div>
                <div className="footix-modal-tile-val">{cible.club}</div>
              </div>
              <div className="footix-modal-tile">
                <div className="footix-modal-tile-label">Ligue</div>
                <div className="footix-modal-tile-val">{cible.ligue}</div>
              </div>
              <div className="footix-modal-tile">
                <div className="footix-modal-tile-label">Poste</div>
                <div className="footix-modal-tile-val">{cible.poste}</div>
              </div>
              <div className="footix-modal-tile">
                <div className="footix-modal-tile-label">Confédération</div>
                <div className="footix-modal-tile-val">{CONFEDERATION_FLAG[cible.confederation] ?? ''} {cible.confederation}</div>
              </div>
            </div>
          </>
        )}

        <div className="footix-modal-actions">
          <button type="button" className="footix-btn-secondary" onClick={share}>
            {shared ? 'Copié ✓' : 'Partager'}
          </button>
          <a href="/leaderboard" className="footix-btn-secondary">
            Classement
          </a>
          {import.meta.env.DEV && (
            <button type="button" className="footix-btn-primary" onClick={onReset}>
              Rejouer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Footix() {
  const { token } = useAuth()

  const [tentatives, setTentatives] = useState<FootixTentative[]>([])
  const [statut, setStatut] = useState<FootixStatus>('in_progress')
  const [cible, setCible] = useState<FootixCible | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<FootixSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [error, setError] = useState<string | null>(null)

  const initialized = useRef(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const gameOver = statut !== 'in_progress'

  const persist = useCallback(
    (t: FootixTentative[], s: FootixStatus, c: FootixCible | null) => {
      saveLocal({ tentatives: t, statut: s, cible: c })
    },
    [],
  )

  // ── Initial load ──────────────────────────────────────────────────────────

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
        api.footix
          .session()
          .then(({ session }) => {
            if (!session) return
            setTentatives(session.tentatives)
            setStatut(session.statut)
            setCible(session.footballeurCible)
            persist(session.tentatives, session.statut, session.footballeurCible)
          })
          .catch(() => {})
      }
      return
    }

    if (token) {
      api.footix
        .session()
        .then(({ session }) => {
          if (session) {
            setTentatives(session.tentatives)
            setStatut(session.statut)
            setCible(session.footballeurCible)
            persist(session.tentatives, session.statut, session.footballeurCible)
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
          const results = await api.footix.search(q)
          const guessedIdx = tentatives.map((t) => t.footballerIndex)
          setSuggestions(results.filter((r) => !guessedIdx.includes(r.index)))
          setOpen(true)
        } catch {}
      }, 300)
    },
    [tentatives],
  )

  // ── Guess submission ──────────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (selected: FootixSearchResult) => {
      if (gameOver || submitting) return
      setSubmitting(true)
      setError(null)
      setQuery('')
      setSuggestions([])
      setOpen(false)

      try {
        const result = await api.footix.guess(selected.index)

        const newTentative: FootixTentative = {
          footballerIndex: selected.index,
          footballer: { prenom: selected.prenom, nom: selected.nom },
          comparison: result.comparison,
        }

        const newTentatives = [...tentatives, newTentative]
        const newStatut: FootixStatus =
          result.statut ??
          (result.correct
            ? 'won'
            : newTentatives.length >= MAX_ATTEMPTS
              ? 'lost'
              : 'in_progress')

        setTentatives(newTentatives)
        setStatut(newStatut)
        setCible(result.footballeurCible)
        persist(newTentatives, newStatut, result.footballeurCible)

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
            ? "Aucun footballeur configuré pour aujourd'hui."
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
      if (token) await api.footix.reset()
      localStorage.removeItem(STORAGE_KEYS.FOOTIX_STATE(today()))
    } catch {}
    setTentatives([])
    setStatut('in_progress')
    setCible(null)
    setShowModal(false)
    setError(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  const clues = useMemo(() => deriveClues(tentatives), [tentatives])
  const hasGuesses = tentatives.length > 0
  const guessCount = tentatives.length

  const dots = useMemo(
    () => Array.from({ length: MAX_ATTEMPTS }, (_, i) => ({
      filled: i < guessCount,
    })),
    [guessCount],
  )

  let message = ''
  let messageColor = 'oklch(0.48 0.02 62)'
  if (statut === 'won') {
    message = `But ! C'était ${cible ? `${cible.prenom} ${cible.nom}` : '…'}.`
    messageColor = 'oklch(0.55 0.13 150)'
  } else if (statut === 'lost') {
    message = `Carton rouge… C'était ${cible ? `${cible.prenom} ${cible.nom}` : '…'}.`
    messageColor = 'oklch(0.58 0.18 25)'
  } else {
    const r = MAX_ATTEMPTS - guessCount
    message = `${r} essai${r > 1 ? 's' : ''} restant${r > 1 ? 's' : ''}.`
  }

  const reversedTentatives = useMemo(() => [...tentatives].reverse(), [tentatives])

  if (loading) {
    return (
      <div className="game-shell">
        <GameHeader title="Footix" subtitle={`Devine le footballeur du jour en ${MAX_ATTEMPTS} essais`} />
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
        title="Footix"
        subtitle={`Devine le footballeur du jour en ${MAX_ATTEMPTS} essais`}
      />

      <main className="container">
        <div className="footix-game">

          {/* ── Clue board ───────────────────────────────────────────────── */}
          <section className="footix-clueboard">
            <div className="footix-clueboard-title">
              <span>Ce qu'on sait</span>
              <span className="footix-clueboard-subtitle">— déduit de tes essais</span>
            </div>
            <div className="footix-clue-tiles">
              {[
                { label: 'Nationalité', value: clues.nationalite },
                { label: 'Confédération', value: clues.confederation },
                { label: 'Poste', value: clues.poste },
                { label: 'Ligue', value: clues.ligue },
                { label: 'Année de naissance', value: clues.ageLabel },
              ].map(({ label, value }) => (
                <div key={label} className="footix-clue-tile">
                  <div className="footix-clue-tile-label">{label}</div>
                  <div className="footix-clue-tile-val">{value}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Status ───────────────────────────────────────────────────── */}
          <div className="footix-status">
            <span style={{ fontSize: '14.5px', fontWeight: 600, color: messageColor }}>{message}</span>
            <div className="footix-status-right">
              <div className="footix-dots">
                {dots.map((d, i) => (
                  <span
                    key={i}
                    className="footix-dot"
                    style={{ background: d.filled ? 'oklch(0.60 0.18 145)' : 'oklch(0.885 0.014 80)' }}
                  />
                ))}
              </div>
              <span className="footix-counter">{guessCount} / {MAX_ATTEMPTS}</span>
            </div>
          </div>

          {/* ── Search ───────────────────────────────────────────────────── */}
          {!gameOver && (
            <div className="footix-search-wrap">
              <div className="footix-search-row">
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const s = activeIdx >= 0 ? suggestions[activeIdx] : suggestions[0]
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
                    placeholder="Tape le nom d'un footballeur…"
                    autoComplete="off"
                    disabled={submitting}
                    className="footix-search-input"
                  />
                  {open && (
                    <ul className="footix-dropdown">
                      {suggestions.length === 0 ? (
                        <li className="footix-dropdown-empty">Aucun footballeur trouvé</li>
                      ) : (
                        suggestions.map((s, i) => (
                          <li
                            key={s.index}
                            onMouseDown={() => handleGuess(s)}
                            className={`footix-dropdown-item${i === activeIdx ? ' footix-dropdown-item-active' : ''}`}
                          >
                            <span
                              className="footix-avatar footix-avatar-sm"
                              style={{ background: ligueColor(s.ligue) }}
                            >
                              {mkInitials(s.prenom, s.nom)}
                            </span>
                            <span className="footix-dropdown-nom">
                              {s.prenom} {s.nom}
                            </span>
                            <span className="footix-dropdown-meta">
                              {s.club} · {s.nationalite}
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
                  className="footix-btn-primary"
                >
                  Deviner
                </button>
              </div>
              {error && <p className="footix-error">{error}</p>}
            </div>
          )}

          {/* ── Legend ───────────────────────────────────────────────────── */}
          {hasGuesses && (
            <div className="footix-legend">
              <span className="footix-legend-item">
                <span className="footix-legend-swatch" style={{ background: 'oklch(0.74 0.14 150)' }} />
                Exact
              </span>
              <span className="footix-legend-item">
                <span className="footix-legend-swatch" style={{ background: 'oklch(0.82 0.14 85)' }} />
                Proche / Même conf. / Même ligue
              </span>
              <span className="footix-legend-item">
                <span className="footix-legend-swatch" style={{ background: 'oklch(0.72 0.10 28)' }} />
                Faux
              </span>
              <span className="footix-legend-item">↑↓ année</span>
            </div>
          )}

          {/* ── Table header ─────────────────────────────────────────────── */}
          {hasGuesses && (
            <div className="footix-table-wrap">
              <div className="footix-table">
                <div className="footix-table-header">
                  <span className="footix-col-label footix-col-num">#</span>
                  <span className="footix-col-label footix-col-player">Joueur</span>
                  <span className="footix-col-label footix-col-center">Nationalité</span>
                  <span className="footix-col-label footix-col-center">Poste</span>
                  <span className="footix-col-label footix-col-center">Naissance</span>
                  <span className="footix-col-label footix-col-center">Club</span>
                </div>
                <div className="footix-rows">
                  {reversedTentatives.map((t, i) => (
                    <GuessRow key={t.footballerIndex} t={t} num={tentatives.length - i} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div className="footix-footer">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Un nouveau footballeur chaque jour.
            </span>
            {import.meta.env.DEV && (
              <button
                type="button"
                className="footix-dev-reset"
                onClick={handleReset}
              >
                [dev] réinitialiser
              </button>
            )}
          </div>
        </div>
      </main>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
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
