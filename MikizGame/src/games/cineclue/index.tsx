import confetti from 'canvas-confetti'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type CineclueFilm,
  type CineclueGuessResponse,
  type CineclueIndices,
  type CineclueSession,
  type CineclueStatut,
  type CineclueTentative,
  type CineclueTotaux,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { STORAGE_KEYS } from '../../constants/storage'
import { today } from '../../utils/date'
import { useGameSession } from '../../hooks/useGameSession'
import { PersonaBoard } from './PersonaBoard'
import { PityCluePopup, isPityPopupDismissed } from './PityCluePopup'
import { ResultModal } from './ResultModal'
import { SearchBar } from './SearchBar'
import { TentativesHistory } from './TentativesHistory'

const MAX_TENTATIVES = 10

// ─── Empty state constants ────────────────────────────────────────────────────

const TOTAUX_VIDES: CineclueTotaux = { genres: 0, pays: 0, acteurs: 0 }

const INDICES_VIDES: CineclueIndices = {
  genres: [],
  pays: [],
  acteurs: [],
  realisateurRevele: false,
  realisateurInfo: null,
  anneeMin: null,
  anneeMax: null,
  dureeMin: null,
  dureeMax: null,
  langue: null,
}

// ─── Data type managed by the session hook ────────────────────────────────────

type CineclueData = {
  session: CineclueSession | null
  totalIndices: CineclueTotaux
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="game-shell">
      <GameHeader title="CinéClue" subtitle="Devine le film du jour en 10 tentatives" />
      <main className="container">
        <div className="game-content">{children}</div>
      </main>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FilmDuJour() {
  // ── Session hook: localStorage-first + API refresh when authed ────────────
  const { data, setData, loading } = useGameSession<CineclueData>({
    cacheKey: STORAGE_KEYS.CINECLUE_STATE(today()),
    fetch: () => api.cineclue.session(),
  })

  // Derive game state from loaded data
  const tentatives: CineclueTentative[] = data?.session?.tentatives ?? []
  const indices: CineclueIndices = data?.session?.indices ?? INDICES_VIDES
  const statut: CineclueStatut = data?.session?.statut ?? 'in_progress'
  const filmCible: CineclueFilm | null = data?.session?.filmCible ?? null
  const totalIndices: CineclueTotaux = data?.totalIndices ?? TOTAUX_VIDES

  const gameOver = statut !== 'in_progress'

  // ── UI-only state (not part of game session) ──────────────────────────────
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [pitySlots, setPitySlots] = useState<Set<string>>(new Set())
  const [showPityPopup, setShowPityPopup] = useState(false)

  // Initialize message once when session data first arrives
  const messageInitialized = useRef(false)
  useEffect(() => {
    if (messageInitialized.current) return
    if (loading) return  // wait until load resolves
    messageInitialized.current = true

    if (statut === 'won') {
      setMessage('Bravo, tu as trouvé le film !')
    } else if (statut === 'lost') {
      setMessage(`Perdu. Le film était : ${filmCible?.titre ?? '?'}`)
    } else {
      const remaining = data?.session?.tentativesRestantes ?? MAX_TENTATIVES
      setMessage(`${remaining} tentative(s) restante(s).`)
    }
  }, [loading, statut])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guess handler ─────────────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (film: { id: number }) => {
      if (gameOver || submitting) return
      setSubmitting(true)
      setMessage('')

      let result: CineclueGuessResponse
      try {
        result = await api.cineclue.guess(film.id)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Erreur réseau')
        setSubmitting(false)
        return
      }

      const newTentative: CineclueTentative = { tmdbId: film.id, filmSoumis: result.filmSoumis, anneeProche: result.anneeProche, dureeProche: result.dureeProche }
      const updatedSession: CineclueSession = {
        statut: result.statut,
        tentatives: [...tentatives, newTentative],
        indices: result.indicesReveles,
        tentativesRestantes: result.tentativesRestantes,
        filmCible: result.filmCible,
      }
      setData({ session: updatedSession, totalIndices: result.totalIndices })

      if (result.pityCluesRevealed?.length > 0) {
        setPitySlots(new Set(result.pityCluesRevealed))
        if (!isPityPopupDismissed()) {
          setTimeout(() => setShowPityPopup(true), 400)
        }
      } else {
        setPitySlots(new Set())
      }

      if (result.statut === 'won') {
        setMessage('Bravo, tu as trouvé le film !')
        confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } })
        setTimeout(() => setShowModal(true), 1200)
      } else if (result.statut === 'lost') {
        setMessage(`Perdu. Le film était : ${result.filmCible?.titre ?? '?'}`)
        setTimeout(() => setShowModal(true), 800)
      } else {
        setMessage(`${result.tentativesRestantes} tentative(s) restante(s).`)
      }

      setSubmitting(false)
    },
    [gameOver, submitting, tentatives, setData],
  )

  // ── Dev reset ─────────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await api.cineclue.reset()
      setData(null)  // clears localStorage and resets derived state
      setShowModal(false)
      messageInitialized.current = false
      setMessage(`${MAX_TENTATIVES} tentatives pour trouver le film.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Erreur reset')
    } finally {
      setResetting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
          <p style={{ color: 'var(--muted)' }}>Chargement…</p>
        </div>
      </Shell>
    )
  }

  const dejaJoueIds = tentatives.map((t) => t.tmdbId)

  return (
    <Shell>
      <div className="cineclue-game">
        {/* Persona épinglée en haut */}
        <PersonaBoard indices={indices} filmCible={filmCible} totalIndices={totalIndices} pitySlots={pitySlots} />

        {/* Message + compteur + dots */}
        <div className="cineclue-status">
          <span className="cineclue-message">{message}</span>
          <div className="cineclue-status-right">
            <div className="cineclue-dots">
              {Array.from({ length: MAX_TENTATIVES }, (_, i) => (
                <span key={i} className={`cineclue-dot${i < tentatives.length ? ' used' : ''}`} />
              ))}
            </div>
            <span className="cineclue-counter">
              {tentatives.length} / {MAX_TENTATIVES}
            </span>
          </div>
        </div>

        {/* Barre de recherche */}
        {!gameOver && (
          <SearchBar
            onGuess={handleGuess}
            disabled={submitting}
            dejaJoues={dejaJoueIds}
          />
        )}

        {gameOver && !showModal && (
          <div className="cineclue-gameover-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
            >
              Voir le résultat
            </button>
          </div>
        )}

        {/* Légende */}
        {tentatives.length > 0 && (
          <div className="cineclue-legend">
            <span className="cineclue-legend-item">
              <span className="cineclue-legend-swatch match" />
              Correct
            </span>
            <span className="cineclue-legend-item">
              <span className="cineclue-legend-swatch close" />
              Proche
            </span>
            <span className="cineclue-legend-item">
              <span className="cineclue-legend-swatch miss" />
              Incorrect
            </span>
            <span className="cineclue-legend-item">
              <span className="cineclue-legend-arrow">↑↓</span>
              direction de la réponse
            </span>
            <span className="cineclue-legend-item">
              <span className="cineclue-legend-actor-dot" />
              acteur en commun
            </span>
          </div>
        )}

        {/* Historique des tentatives */}
        <TentativesHistory
          tentatives={tentatives}
          filmCible={filmCible}
          indicesCourants={indices}
        />

        {/* Lien de retour + reset dev */}
        <div className="cineclue-footer">
          <Link to="/" className="cineclue-back-link">
            ← Retour aux jeux
          </Link>
          {import.meta.env.DEV && (
            <button
              type="button"
              className="cineclue-dev-reset"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? '…' : '[dev] réinitialiser'}
            </button>
          )}
        </div>

        {/* Modale de fin de partie */}
        {showModal && filmCible && statut !== 'in_progress' && (
          <ResultModal
            statut={statut}
            filmCible={filmCible}
            tentatives={tentatives}
            onClose={() => setShowModal(false)}
          />
        )}

        {/* Popup indice de pitié */}
        {showPityPopup && (
          <PityCluePopup onClose={() => setShowPityPopup(false)} />
        )}
      </div>
    </Shell>
  )
}
