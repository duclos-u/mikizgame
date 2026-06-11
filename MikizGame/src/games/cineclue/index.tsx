import confetti from 'canvas-confetti'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  type CineclueFilm,
  type CineclueGuessResponse,
  type CineclueIndices,
  type CineclueStatut,
  type CineclueTentative,
  api,
} from '../../api/client'
import { GameHeader } from '../../components/GameHeader'
import { useAuth } from '../../context/AuthContext'
import { PersonaBoard } from './PersonaBoard'
import { ResultModal } from './ResultModal'
import { SearchBar } from './SearchBar'
import { TentativesHistory } from './TentativesHistory'

const MAX_TENTATIVES = 10

// ─── Persistance localStorage ─────────────────────────────────────────────────

function todayKey() {
  return `filmdujourstate_${new Date().toISOString().slice(0, 10)}`
}

type LocalState = {
  tentatives: CineclueTentative[]
  indices: CineclueIndices
  statut: CineclueStatut
  filmCible: CineclueFilm | null
}

function loadLocal(): LocalState | null {
  try {
    const raw = localStorage.getItem(todayKey())
    if (!raw) return null
    return JSON.parse(raw) as LocalState
  } catch {
    return null
  }
}

function saveLocal(state: LocalState) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(state))
  } catch {
    // localStorage peut être indisponible en navigation privée
  }
}

const INDICES_VIDES: CineclueIndices = {
  genres: [],
  pays: [],
  acteurs: [],
  realisateurRevele: false,
  anneeMin: null,
  anneeMax: null,
  dureeMin: null,
  dureeMax: null,
  langue: null,
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
  const { token } = useAuth()

  const [tentatives, setTentatives] = useState<CineclueTentative[]>([])
  const [indices, setIndices] = useState<CineclueIndices>(INDICES_VIDES)
  const [statut, setStatut] = useState<CineclueStatut>('in_progress')
  const [filmCible, setFilmCible] = useState<CineclueFilm | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Ref pour éviter le double-chargement en strict mode
  const initialized = useRef(false)

  const gameOver = statut !== 'in_progress'

  // Synchronise l'état interne vers localStorage
  const persist = useCallback(
    (
      t: CineclueTentative[],
      i: CineclueIndices,
      s: CineclueStatut,
      fc: CineclueFilm | null,
    ) => {
      saveLocal({ tentatives: t, indices: i, statut: s, filmCible: fc })
    },
    [],
  )

  // ── Chargement initial ────────────────────────────────────────────────────

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // 1. Tenter de restaurer depuis localStorage (immédiat, sans réseau)
    const local = loadLocal()
    if (local) {
      setTentatives(local.tentatives)
      setIndices(local.indices)
      setStatut(local.statut)
      setFilmCible(local.filmCible)
      if (local.statut === 'won') setMessage('Bravo, tu as trouvé le film !')
      else if (local.statut === 'lost')
        setMessage(`Perdu. Le film était : ${local.filmCible?.titre ?? '?'}`)
      else
        setMessage(
          `${MAX_TENTATIVES - local.tentatives.length} tentative(s) restante(s).`,
        )
      setLoading(false)

      // Si connecté, on rafraîchit silencieusement depuis l'API
      if (token) {
        api.cineclue
          .session()
          .then(({ session }) => {
            if (!session) return
            setTentatives(session.tentatives)
            setIndices(session.indices)
            setStatut(session.statut)
            setFilmCible(session.filmCible)
            persist(
              session.tentatives,
              session.indices,
              session.statut,
              session.filmCible,
            )
          })
          .catch(() => {
            // On reste sur localStorage en cas d'erreur réseau
          })
      }
      return
    }

    // 2. Pas de localStorage → charger depuis l'API si connecté
    if (token) {
      api.cineclue
        .session()
        .then(({ session }) => {
          if (!session) {
            setMessage(`${MAX_TENTATIVES} tentatives pour trouver le film.`)
          } else {
            setTentatives(session.tentatives)
            setIndices(session.indices)
            setStatut(session.statut)
            setFilmCible(session.filmCible)
            persist(
              session.tentatives,
              session.indices,
              session.statut,
              session.filmCible,
            )
            if (session.statut === 'won') setMessage('Bravo, tu as trouvé le film !')
            else if (session.statut === 'lost')
              setMessage(`Perdu. Le film était : ${session.filmCible?.titre ?? '?'}`)
            else
              setMessage(
                `${session.tentativesRestantes} tentative(s) restante(s).`,
              )
          }
        })
        .catch(() => {
          setMessage(`${MAX_TENTATIVES} tentatives pour trouver le film.`)
        })
        .finally(() => setLoading(false))
    } else {
      // Mode invité sans état préexistant
      setMessage(`${MAX_TENTATIVES} tentatives pour trouver le film.`)
      setLoading(false)
    }
  }, [token, persist])

  // ── Soumission d'un film ──────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (film: { id: number }) => {
      if (gameOver || submitting) return
      setSubmitting(true)
      setMessage('')

      let result: CineclueGuessResponse

      if (token) {
        // Mode connecté : appel API
        try {
          result = await api.cineclue.guess(film.id)
        } catch (err) {
          setMessage(err instanceof Error ? err.message : 'Erreur réseau')
          setSubmitting(false)
          return
        }
      } else {
        // Mode invité : calcul local simplifié (pas d'accès au film cible)
        setMessage('Connecte-toi pour que tes réponses soient sauvegardées.')
        setSubmitting(false)
        return
      }

      const newTentatives = [...tentatives, { tmdbId: film.id, filmSoumis: result.filmSoumis }]
      setTentatives(newTentatives)
      setIndices(result.indicesReveles)
      setStatut(result.statut)
      setFilmCible(result.filmCible)
      persist(newTentatives, result.indicesReveles, result.statut, result.filmCible)

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
    [gameOver, submitting, token, tentatives, persist],
  )

  // ── Reset dev ─────────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true)
    try {
      await api.cineclue.reset()
      localStorage.removeItem(todayKey())
      setTentatives([])
      setIndices(INDICES_VIDES)
      setStatut('in_progress')
      setFilmCible(null)
      setShowModal(false)
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
        <PersonaBoard indices={indices} filmCible={filmCible} />

        {/* Message + compteur */}
        <div className="cineclue-status">
          <span className="cineclue-message">{message}</span>
          {!gameOver && (
            <span className="cineclue-counter">
              {tentatives.length} / {MAX_TENTATIVES}
            </span>
          )}
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
      </div>
    </Shell>
  )
}
