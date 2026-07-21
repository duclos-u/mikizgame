import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  api,
  type ProfileGameRank,
  type ProfileGameStats,
  type ProfileSummaryResponse,
  type StreakMilestonesResponse,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { GAMES } from '../data/games'
import { formatDayFr } from '../utils/date'
import { PlayHeatmap } from './PlayHeatmap'

const MILESTONES = [7, 30, 100, 365]
const MILESTONE_LABELS: Record<number, string> = {
  7: '1 semaine',
  30: '1 mois',
  100: '100 jours',
  365: '1 an',
}

function gameMeta(slug: string) {
  return GAMES.find((g) => (g.slug ?? g.id) === slug)
}

// ── Rank badge ───────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: ProfileGameRank }) {
  return (
    <span
      className="rank-badge"
      title={`${rank.rank}e sur ${rank.totalPlayers} joueur${rank.totalPlayers > 1 ? 's' : ''}`}
    >
      #{rank.rank}
      <span className="rank-badge-total">/{rank.totalPlayers}</span>
    </span>
  )
}

// ── Guess distribution ───────────────────────────────────────────────────────
const BAR_MAX_PX = 100

function GuessDistribution({
  stats,
  maxAttempts,
}: {
  stats: ProfileGameStats
  maxAttempts?: number
}) {
  const wonAttempts = Object.keys(stats.distribution).map(Number).sort((a, b) => a - b)
  if (wonAttempts.length === 0 && stats.losses === 0) return null

  const maxAttempt =
    maxAttempts ?? (wonAttempts.length > 0 ? Math.max(...wonAttempts) : 0)
  const allSlots = Array.from({ length: maxAttempt }, (_, i) => i + 1)

  const total = wonAttempts.reduce((s, a) => s + stats.distribution[a], 0) + stats.losses
  const allCounts = [...allSlots.map((a) => stats.distribution[a] ?? 0), stats.losses]
  const maxCount = Math.max(...allCounts, 1)

  const lossBarH = stats.losses > 0 ? Math.max((stats.losses / maxCount) * BAR_MAX_PX, 4) : 0

  return (
    <div className="guess-distribution">
      {total > 0 && (
        <div className="guess-distribution-win-rate">
          {Math.round((100 * stats.wins) / total)}% de victoires
        </div>
      )}
      <div className="guess-distribution-body">
        <div className="guess-distribution-yaxis">
          <span className="guess-distribution-yaxis-label">{maxCount}</span>
          <span className="guess-distribution-yaxis-label">{Math.ceil(maxCount / 2)}</span>
          <span className="guess-distribution-yaxis-label">0</span>
        </div>
        <div className="guess-distribution-chart">
          {allSlots.map((attempt) => {
            const count = stats.distribution[attempt] ?? 0
            const barH = count > 0 ? Math.max((count / maxCount) * BAR_MAX_PX, 4) : 0
            return (
              <div key={attempt} className="guess-distribution-col">
                <span className="guess-distribution-col-count">{count > 0 ? count : ''}</span>
                <div className="guess-distribution-col-track">
                  <div className="guess-distribution-col-bar" style={{ height: `${barH}px` }} />
                </div>
                <span className="guess-distribution-col-label">{attempt}</span>
              </div>
            )
          })}
          <div className="guess-distribution-col loss">
            <span className="guess-distribution-col-count">
              {stats.losses > 0 ? stats.losses : ''}
            </span>
            <div className="guess-distribution-col-track">
              <div className="guess-distribution-col-bar" style={{ height: `${lossBarH}px` }} />
            </div>
            <span className="guess-distribution-col-label">✕</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Day detail ────────────────────────────────────────────────────────────────
function DayDetail({
  date,
  entries,
}: {
  date: string
  entries: ProfileSummaryResponse['history']
}) {
  return (
    <div className="day-detail">
      <div className="day-detail-title">{formatDayFr(date)}</div>
      {entries.length === 0 ? (
        <p className="day-detail-empty">Aucun jeu joué ce jour-là.</p>
      ) : (
        <ul className="day-detail-list">
          {entries.map((entry) => {
            const meta = gameMeta(entry.game)
            return (
              <li key={entry.game} className="day-detail-item">
                <span className="day-detail-game">
                  <span className="day-detail-icon">{meta?.icon ?? '🎲'}</span>
                  {meta?.name ?? entry.game}
                </span>
                <span className={`day-detail-score${entry.score === null ? ' lost' : ''}`}>
                  {entry.score !== null ? `${entry.score} essai${entry.score > 1 ? 's' : ''}` : 'Perdu'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Account settings ──────────────────────────────────────────────────────────
function UsernameForm() {
  const { user, updateAuth } = useAuth()
  const [username, setUsername] = useState(user?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed || trimmed === user?.username) return
    setSaving(true)
    setMessage(null)
    try {
      const { user: updated, token } = await api.profile.updateUsername(trimmed)
      updateAuth(updated, token)
      setMessage({ ok: true, text: 'Nom d’utilisateur modifié.' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Erreur inconnue' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={(e) => void submit(e)}>
      <label className="profile-form-label" htmlFor="profile-username">
        Nom d'utilisateur
      </label>
      <div className="profile-form-row">
        <input
          id="profile-username"
          type="text"
          className="modal-input"
          value={username}
          maxLength={50}
          onChange={(e) => setUsername(e.target.value)}
          disabled={saving}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={saving || !username.trim() || username.trim() === user?.username}
        >
          Enregistrer
        </button>
      </div>
      {message && (
        <p className={`profile-form-message${message.ok ? ' ok' : ' error'}`}>{message.text}</p>
      )}
    </form>
  )
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setMessage({ ok: false, text: 'Les mots de passe ne correspondent pas.' })
      return
    }
    if (newPassword.length < 8) {
      setMessage({ ok: false, text: 'Le nouveau mot de passe doit faire au moins 8 caractères.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const { message: text } = await api.profile.updatePassword(currentPassword, newPassword)
      setMessage({ ok: true, text })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Erreur inconnue' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="profile-form" onSubmit={(e) => void submit(e)}>
      <label className="profile-form-label" htmlFor="profile-current-password">
        Changer de mot de passe
      </label>
      <input
        id="profile-current-password"
        type="password"
        className="modal-input"
        placeholder="Mot de passe actuel"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        disabled={saving}
      />
      <input
        type="password"
        className="modal-input"
        placeholder="Nouveau mot de passe (8 caractères min.)"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        disabled={saving}
      />
      <input
        type="password"
        className="modal-input"
        placeholder="Confirmer le nouveau mot de passe"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={saving}
      />
      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={saving || !currentPassword || !newPassword || !confirmPassword}
      >
        Modifier le mot de passe
      </button>
      {message && (
        <p className={`profile-form-message${message.ok ? ' ok' : ' error'}`}>{message.text}</p>
      )}
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
type ProfilePageProps = {
  onLoginClick: () => void
}

type ProfileData = {
  userId: string
  summary: ProfileSummaryResponse
  milestones: StreakMilestonesResponse
}

export function ProfilePage({ onLoginClick }: ProfilePageProps) {
  const { user, logout, loading: authLoading } = useAuth()
  const [data, setData] = useState<ProfileData | null>(null)
  const [error, setError] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const userId = user?.id

  useEffect(() => {
    if (!userId) return
    Promise.all([api.profile.summary(), api.streak.milestones()])
      .then(([summary, milestones]) => setData({ userId, summary, milestones }))
      .catch(() => setError(true))
  }, [userId])

  // Ignore data fetched for a previously logged-in account.
  const current = userId && data?.userId === userId ? data : null
  const summary = current?.summary ?? null
  const milestones = current?.milestones ?? null

  const selectedEntries = useMemo(() => {
    if (!summary || !selectedDate) return []
    return summary.history.filter((e) => e.date === selectedDate)
  }, [summary, selectedDate])

  const totalPlayed = useMemo(
    () => summary?.games.reduce((sum, g) => sum + g.played, 0) ?? 0,
    [summary],
  )

  if (authLoading) {
    return (
      <div className="profile-page">
        <p className="profile-loading">Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-card profile-login-prompt">
          <h2>Mon profil</h2>
          <p>Connecte-toi pour voir ton historique de jeu et tes statistiques.</p>
          <button type="button" className="btn btn-primary" onClick={onLoginClick}>
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  const achievedByMilestone = new Map(
    (milestones?.achieved ?? []).map((m) => [m.milestone, m.achievedAt]),
  )

  return (
    <div className="profile-page">
      {/* Identity */}
      <div className="profile-card profile-identity">
        <span className="avatar profile-avatar">{user.username.charAt(0).toUpperCase()}</span>
        <div>
          <h1 className="profile-username">{user.username}</h1>
          {summary && (
            <p className="profile-meta">
              Membre depuis{' '}
              {new Date(summary.memberSince).toLocaleDateString('fr-FR', {
                month: 'long',
                year: 'numeric',
              })}
              {totalPlayed > 0 && ` · ${totalPlayed} partie${totalPlayed > 1 ? 's' : ''} jouée${totalPlayed > 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </div>

      {/* Streaks & milestones */}
      <div className="profile-card">
        <div className="section-kicker">Séries</div>
        <div className="profile-streaks">
          <div className="profile-streak-stat">
            <b>🔥 {user.streak}</b>
            <span>série en cours</span>
          </div>
          <div className="profile-streak-stat">
            <b>🏆 {user.longestStreak}</b>
            <span>record</span>
          </div>
          {summary?.crossRank && (
            <div className="profile-streak-stat">
              <b>
                #{summary.crossRank.rank}
                <span className="profile-streak-stat-sub">/{summary.crossRank.totalPlayers}</span>
              </b>
              <span>classement général</span>
            </div>
          )}
        </div>
        <div className="profile-milestones">
          {MILESTONES.map((m) => {
            const achievedAt = achievedByMilestone.get(m)
            return (
              <span
                key={m}
                className={`milestone-badge${achievedAt ? ' achieved' : ''}`}
                title={
                  achievedAt
                    ? `Atteint le ${new Date(achievedAt).toLocaleDateString('fr-FR')}`
                    : 'Pas encore atteint'
                }
              >
                {achievedAt ? '✓ ' : ''}
                {MILESTONE_LABELS[m]}
              </span>
            )
          })}
        </div>
      </div>

      {/* Heatmap */}
      <div className="profile-card">
        <div className="section-kicker">Historique de jeu</div>
        <p className="profile-card-hint">Une année d'activité — clique sur un jour pour le détail.</p>
        {error && <p className="profile-error">Impossible de charger l'historique.</p>}
        {summary && (
          <>
            <PlayHeatmap
              history={summary.history}
              selectedDate={selectedDate}
              onSelectDay={(date) => setSelectedDate(date === selectedDate ? null : date)}
            />
            {selectedDate && <DayDetail date={selectedDate} entries={selectedEntries} />}
          </>
        )}
      </div>

      {/* Per-game stats */}
      <div className="profile-card">
        <div className="section-kicker">Statistiques par jeu</div>
        {summary && summary.games.length === 0 && (
          <p className="profile-card-hint">Joue à un jeu pour voir tes statistiques ici !</p>
        )}
        {summary && summary.games.length > 0 && (
          <div className="profile-stats-grid">
            {summary.games.map((g) => {
              const meta = gameMeta(g.game)
              return (
                <div key={g.game} className="profile-game-card">
                  <div className="profile-game-name">
                    <span>{meta?.icon ?? '🎲'}</span>
                    {meta?.name ?? g.name}
                    {g.rank && <RankBadge rank={g.rank} />}
                  </div>
                  <dl className="profile-game-stats">
                    <div>
                      <dt>Parties</dt>
                      <dd>{g.played}</dd>
                    </div>
                    <div>
                      <dt>Essais moy.</dt>
                      <dd>{g.avgAttempts ?? '—'}</dd>
                    </div>
                  </dl>
                  <GuessDistribution stats={g} maxAttempts={gameMeta(g.game)?.maxAttempts} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Account settings */}
      <div className="profile-card">
        <div className="section-kicker">Paramètres du compte</div>
        <UsernameForm />
        <hr className="profile-divider" />
        <PasswordForm />
      </div>

      {/* Logout */}
      <div className="profile-card">
        <button type="button" className="btn btn-ghost profile-logout-btn" onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
