import { useEffect, useState } from 'react'
import {
  api,
  type CrossGameEntry,
  type LeaderboardEntry,
  type SutomAllTimeEntry,
} from '../api/client'
import { GAMES, type Game } from '../data/games'
import { useAuth } from '../context/AuthContext'

const GAME_LABELS: Record<string, string> = {
  sutom: 'Sutom',
  cineclue: 'CinéClue',
  motivex: 'Motivex',
}

function gameLabel(slug: string) {
  return GAME_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

function gameShort(slug: string) {
  return (GAME_LABELS[slug] ?? slug).slice(0, 1).toUpperCase()
}

// ── Avatar (initials circle) ──────────────────────────────────────────────────
function Avatar({
  name,
  size = 36,
  color,
  ring,
}: {
  name: string
  size?: number
  color?: string
  ring?: boolean
}) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: color
          ? `color-mix(in oklch, ${color} 28%, var(--card-2))`
          : 'var(--card-2)',
        color: color ?? 'var(--muted)',
        boxShadow: ring && color
          ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${color}`
          : 'none',
        flexShrink: 0,
      }}
      title={name}
    >
      {initials}
    </span>
  )
}

// ── Podium ────────────────────────────────────────────────────────────────────
function Podium({
  rows,
  currentUser,
}: {
  rows: CrossGameEntry[]
  currentUser: string | null
}) {
  const top3 = rows.slice(0, 3)
  if (top3.length < 2) return null
  // display order: 2nd (if exists), 1st, 3rd (if exists)
  const order = [top3[1], top3[0], top3[2]].filter(Boolean) as CrossGameEntry[]
  const places = order.map((r) => top3.indexOf(r) + 1)
  const medals = ['🥇', '🥈', '🥉']
  const heights = [78, 104, 58]

  return (
    <div className="podium">
      {order.map((r, idx) => {
        const place = places[idx]
        const isMe = currentUser === r.username
        return (
          <div
            key={r.username}
            className={`podium-col podium-${place}${isMe ? ' is-me' : ''}`}
          >
            <div className="podium-medal">{medals[place - 1]}</div>
            <Avatar
              name={r.username}
              size={place === 1 ? 60 : 46}
              color={`oklch(0.74 0.16 ${45 + idx * 120})`}
              ring
            />
            <div className="podium-name">
              {r.username}
              {isMe && ' (toi)'}
            </div>
            <div className="podium-bar" style={{ height: heights[place - 1] }}>
              <span className="podium-rank">{place}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Game tab strip ────────────────────────────────────────────────────────────
type TabItem = Pick<Game, 'id' | 'name' | 'icon' | 'accent'>

function GameTabStrip({
  activeId,
  games,
  onChange,
}: {
  activeId: string
  games: TabItem[]
  onChange: (id: string) => void
}) {
  return (
    <div className="game-tabs">
      {games.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`game-tab${g.id === activeId ? ' active' : ''}`}
          style={{ '--g': g.accent } as React.CSSProperties}
          onClick={() => onChange(g.id)}
        >
          <span className="game-tab-glyph">{g.icon}</span>
          {g.name}
        </button>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function LeaderboardPage() {
  const { user } = useAuth()
  const liveGames = GAMES.filter((g) => g.status === 'live')
  const allTabs: TabItem[] = [
    { id: 'general', name: 'Général', icon: '🏆', accent: 'oklch(0.74 0.16 55)' },
    ...liveGames,
  ]
  const [gameId, setGameId] = useState('general')
  const [scope, setScope] = useState<'daily' | 'all'>('daily')
  const [friendsOnly, setFriendsOnly] = useState(false)

  const [crossEntries, setCrossEntries] = useState<CrossGameEntry[]>([])
  const [crossGames, setCrossGames] = useState<string[]>([])
  const [crossLoading, setCrossLoading] = useState(true)

  const [perGameEntries, setPerGameEntries] = useState<Record<string, LeaderboardEntry[]>>({})
  const [perGameLoading, setPerGameLoading] = useState(true)

  const [allTimeEntries, setAllTimeEntries] = useState<SutomAllTimeEntry[]>([])
  const [allTimeLoading, setAllTimeLoading] = useState(true)

  useEffect(() => {
    api.leaderboard
      .getCross()
      .then(({ entries, games }) => {
        setCrossEntries(entries)
        setCrossGames(games)
        return games
      })
      .then((games) =>
        Promise.all(
          games.map((g) =>
            api.leaderboard
              .get(g)
              .then(({ entries }) => ({ game: g, entries }))
              .catch(() => ({ game: g, entries: [] as LeaderboardEntry[] }))
          )
        )
      )
      .then((results) => {
        const map: Record<string, LeaderboardEntry[]> = {}
        results.forEach(({ game, entries }) => {
          map[game] = entries
        })
        setPerGameEntries(map)
      })
      .catch(() => {})
      .finally(() => {
        setCrossLoading(false)
        setPerGameLoading(false)
      })
  }, [])

  useEffect(() => {
    if (gameId === 'general' || scope !== 'all') return
    setAllTimeLoading(true)
    api.leaderboard
      .getStats(gameId)
      .then(({ entries }) => setAllTimeEntries(entries))
      .catch(() => {})
      .finally(() => setAllTimeLoading(false))
  }, [scope, gameId])

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const currentGame = GAMES.find((g) => g.id === gameId) ?? liveGames[0]
  const showBreakdown = crossGames.length > 1
  const currentUser = user?.username ?? null
  const meRow = crossEntries.find((r) => r.username === currentUser)

  return (
    <div className="page lb-page" style={{ '--g': currentGame?.accent } as React.CSSProperties}>
      <div className="lb-hero">
        <div className="section-kicker">Classement</div>
        <h1 className="lb-title">Qui domine aujourd'hui ?</h1>
        <p className="lb-sub">Compare tes scores par jeu, en quotidien ou sur tous les temps.</p>
      </div>

      <div className="lb-controls">
        <GameTabStrip
          activeId={gameId}
          games={allTabs}
          onChange={setGameId}
        />
        <div className="lb-control-right">
          {gameId !== 'general' && (
            <div className="seg">
              <button
                type="button"
                className={`seg-btn${scope === 'daily' ? ' active' : ''}`}
                onClick={() => setScope('daily')}
              >
                Quotidien
              </button>
              <button
                type="button"
                className={`seg-btn${scope === 'all' ? ' active' : ''}`}
                onClick={() => setScope('all')}
              >
                Tous les temps
              </button>
            </div>
          )}
          <button
            type="button"
            className={`friends-toggle${friendsOnly ? ' on' : ''}`}
            onClick={() => setFriendsOnly((v) => !v)}
          >
            <span className="ft-dot" /> Amis seulement
          </button>
        </div>
      </div>

      {/* Général tab — podium + cross-game total */}
      {gameId === 'general' && crossEntries.length >= 2 && (
        <Podium rows={crossEntries} currentUser={currentUser} />
      )}
      {gameId === 'general' && (
        <div className="lb-table" style={{ marginBottom: '1.25rem' }}>
          <div
            className="lb-head-row"
            style={{
              gridTemplateColumns: showBreakdown
                ? '32px 1fr auto 70px'
                : '32px 1fr 70px',
            }}
          >
            <span>#</span>
            <span>Joueur</span>
            {showBreakdown && <span>Détail</span>}
            <span className="ta-r">Points</span>
          </div>
          <div>
            {crossLoading ? (
              <div style={{ padding: '1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                Chargement…
              </div>
            ) : crossEntries.length === 0 ? (
              <div style={{ padding: '1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                Aucune partie terminée aujourd'hui.{' '}
                {!user && <span>Connecte-toi pour apparaître ici.</span>}
              </div>
            ) : (
              crossEntries.map((entry, i) => {
                const isMe = currentUser === entry.username
                return (
                  <div
                    key={entry.username}
                    className={`lb-row${isMe ? ' is-me' : ''}`}
                    style={{
                      gridTemplateColumns: showBreakdown
                        ? '32px 1fr auto 70px'
                        : '32px 1fr 70px',
                    }}
                  >
                    <span className={`lb-rank${i < 3 ? ' top' : ''}`}>
                      {['🥇', '🥈', '🥉'][i] ?? i + 1}
                    </span>
                    <span className="lb-player">
                      <Avatar name={entry.username} size={30} />
                      <span className="lb-player-name">
                        {entry.username}
                        {isMe && <span className="you-tag">toi</span>}
                      </span>
                    </span>
                    {showBreakdown && (
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {crossGames.map((g) => {
                          const bd = entry.breakdown[g]
                          return (
                            <span
                              key={g}
                              className={`lb-chip${bd ? ' lb-chip-highlight' : ''}`}
                              title={gameLabel(g)}
                            >
                              {gameShort(g)}: {bd ? bd.points : 0}
                            </span>
                          )
                        })}
                      </span>
                    )}
                    <span className="lb-total ta-r">{entry.total}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Per-game daily table */}
      {gameId !== 'general' && scope === 'daily' && (() => {
        const entries = perGameEntries[gameId] ?? []
        const label = gameLabel(gameId)
        return (
          <div className="lb-table" style={{ marginBottom: '1.25rem' }}>
            <div
              className="lb-head-row"
              style={{ background: 'var(--card-2)', padding: '0.55rem 1.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>{label} — {today}</span>
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.73rem', color: 'var(--muted)' }}>
                plus de points = mieux
              </span>
            </div>
            <div
              className="lb-head-row"
              style={{ gridTemplateColumns: '32px 1fr 70px 70px' }}
            >
              <span>#</span>
              <span>Joueur</span>
              <span className="ta-r">Points</span>
              <span className="ta-r">Essais</span>
            </div>
            <div>
              {perGameLoading ? (
                <div style={{ padding: '1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                  Chargement…
                </div>
              ) : entries.length === 0 ? (
                <div style={{ padding: '1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                  Aucune partie terminée aujourd'hui.
                </div>
              ) : (
                entries.map((entry, i) => {
                  const isMe = currentUser === entry.username
                  return (
                    <div
                      key={`${entry.username}-${i}`}
                      className={`lb-row${isMe ? ' is-me' : ''}`}
                      style={{ gridTemplateColumns: '32px 1fr 70px 70px' }}
                    >
                      <span className={`lb-rank${i < 3 ? ' top' : ''}`}>
                        {['🥇', '🥈', '🥉'][i] ?? i + 1}
                      </span>
                      <span className="lb-player">
                        <Avatar name={entry.username} size={30} />
                        <span className="lb-player-name">
                          {entry.username}
                          {isMe && <span className="you-tag">toi</span>}
                        </span>
                      </span>
                      <span className="lb-cell filled ta-r">{entry.points}</span>
                      <span className="lb-cell ta-r">{entry.score ?? '—'}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })()}

      {/* All-time table */}
      {gameId !== 'general' && scope === 'all' && (
        <div className="lb-table">
          <div
            style={{
              background: 'var(--card-2)',
              padding: '0.55rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--muted)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
            }}
          >
            <span>{gameLabel(gameId)} — tous les temps</span>
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>
              plus de points = mieux
            </span>
          </div>
          <div
            className="lb-head-row"
            style={{ gridTemplateColumns: '32px 1fr 70px 70px 80px' }}
          >
            <span>#</span>
            <span>Joueur</span>
            <span className="ta-r">Victoires</span>
            <span className="ta-r">Moy.</span>
            <span className="ta-r">Points</span>
          </div>
          <div>
            {allTimeLoading ? (
              <div style={{ padding: '1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                Chargement…
              </div>
            ) : allTimeEntries.length === 0 ? (
              <div style={{ padding: '1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
                Aucune partie enregistrée.{' '}
                {!user && <span>Connecte-toi pour apparaître ici.</span>}
              </div>
            ) : (
              allTimeEntries.map((entry, i) => {
                const isMe = currentUser === entry.username
                return (
                  <div
                    key={entry.username}
                    className={`lb-row${isMe ? ' is-me' : ''}`}
                    style={{ gridTemplateColumns: '32px 1fr 70px 70px 80px' }}
                  >
                    <span className={`lb-rank${i < 3 ? ' top' : ''}`}>
                      {['🥇', '🥈', '🥉'][i] ?? i + 1}
                    </span>
                    <span className="lb-player">
                      <Avatar name={entry.username} size={30} />
                      <span className="lb-player-name">
                        {entry.username}
                        {isMe && <span className="you-tag">toi</span>}
                      </span>
                    </span>
                    <span className="lb-cell ta-r">{entry.wins}</span>
                    <span className="lb-cell ta-r">
                      {entry.avgAttempts !== null ? entry.avgAttempts : '—'}
                    </span>
                    <span className="lb-cell filled ta-r">{entry.totalPoints}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Sticky me bar */}
      {meRow && currentUser && (
        <div className="lb-sticky-me">
          <span className={`lb-rank${crossEntries.findIndex((r) => r.username === currentUser) < 3 ? ' top' : ''}`}>
            {crossEntries.findIndex((r) => r.username === currentUser) + 1}
          </span>
          <span className="lb-player">
            <Avatar name={currentUser} size={30} color="var(--accent)" />
            <span className="lb-player-name">Toi</span>
          </span>
          <span className="lb-me-note">
            {scope === 'daily'
              ? `${meRow.total} points aujourd'hui`
              : 'Score global'}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{
              background: currentGame?.accent,
              borderColor: currentGame?.accent,
              color: 'oklch(0.15 0.01 55)',
            }}
            onClick={() => {
              if (currentGame?.route) {
                window.location.href = currentGame.route
              }
            }}
          >
            Rejouer
          </button>
        </div>
      )}
    </div>
  )
}
