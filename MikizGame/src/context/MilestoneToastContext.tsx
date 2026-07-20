import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'
import { StreakShareCard } from '../components/StreakShareCard'

type MilestoneToastState = {
  notifyMilestone: (milestone: number) => void
}

const MilestoneToastContext = createContext<MilestoneToastState | null>(null)

const AUTO_DISMISS_MS = 8000

export function MilestoneToastProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null)
  const [shareMilestone, setShareMilestone] = useState<number | null>(null)

  const notifyMilestone = useCallback((milestone: number) => {
    setActiveMilestone(milestone)
    api.streak.ackMilestone(milestone).catch(() => {})
  }, [])

  // Reload-robustness fallback: surface any milestone achieved but never shown.
  useEffect(() => {
    if (!user) return
    api.streak
      .milestones()
      .then(({ achieved }) => {
        const unshown = achieved.find((m) => !m.shownAt)
        if (unshown) notifyMilestone(unshown.milestone)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (activeMilestone === null) return
    const id = setTimeout(() => setActiveMilestone(null), AUTO_DISMISS_MS)
    return () => clearTimeout(id)
  }, [activeMilestone])

  return (
    <MilestoneToastContext.Provider value={{ notifyMilestone }}>
      {children}
      {activeMilestone !== null && (
        <div className="milestone-toast" role="status">
          <span className="milestone-toast-emoji">🔥</span>
          <div className="milestone-toast-body">
            <strong>Palier {activeMilestone} jours atteint !</strong>
            <span>Continue comme ça pour garder ta série.</span>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setShareMilestone(activeMilestone)
              setActiveMilestone(null)
            }}
          >
            Partager
          </button>
          <button
            type="button"
            className="milestone-toast-close"
            aria-label="Fermer"
            onClick={() => setActiveMilestone(null)}
          >
            ✕
          </button>
        </div>
      )}
      <StreakShareCard
        open={shareMilestone !== null}
        onClose={() => setShareMilestone(null)}
        streak={shareMilestone ?? user?.streak ?? 0}
        milestone={shareMilestone}
      />
    </MilestoneToastContext.Provider>
  )
}

export function useMilestoneToast(): MilestoneToastState {
  const ctx = useContext(MilestoneToastContext)
  if (!ctx) throw new Error('useMilestoneToast must be used within a MilestoneToastProvider')
  return ctx
}
