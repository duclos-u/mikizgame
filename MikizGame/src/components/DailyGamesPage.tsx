import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type CrossGameEntry } from '../api/client'
import { GAMES, type Game } from '../data/games'
import { useAuth } from '../context/AuthContext'

const TODAY = new Date().toISOString().slice(0, 10)

function isCineclueCompleteToday(): boolean {
  try {
    const raw = localStorage.getItem(`filmdujourstate_${TODAY}`)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { statut?: string }
    return parsed.statut === 'won' || parsed.statut === 'lost'
  } catch {
    return false
  }
}

function isSutomCompleteToday(): boolean {
  try {
    return localStorage.getItem(`sutomstate_${TODAY}`) === '1'
  } catch {
    return false
  }
}

// ── Pill ─────────────────────────────────────────────────────────────────────
function Pill({
  children,
  tone = 'neutral',
  accent,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'live' | 'done' | 'soon'
  accent?: string
}) {
  const accentStyle = accent
    ? {
        color: accent,
        background: `color-mix(in oklch, ${accent} 14%, transparent)`,
        borderColor: `color-mix(in oklch, ${accent} 30%, transparent)`,
      }
    : {}
  return (
    <span className={`pill pill-${tone}`} style={accentStyle}>
      {children}
    </span>
  )
}

// ── GameGlyph ─────────────────────────────────────────────────────────────────
function GameGlyph({ game, size = 48 }: { game: Game; size?: number }) {
  return (
    <span
      className="game-glyph"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        background: `color-mix(in oklch, ${game.accent} 18%, var(--card-2))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${game.accent} 30%, transparent)`,
      }}
    >
      {game.icon}
    </span>
  )
}

// ── Hero section (featured game) ─────────────────────────────────────────────
function HeroDaily({
  game,
  done,
  todayLabel,
}: {
  game: Game
  done: boolean
  todayLabel: string
}) {
  return (
    <section className="hero">
      <div className="hero-glow" />
      <div className="hero-content">
        <div className="hero-left">
          <Pill accent={game.accent}>● Jeu du jour</Pill>
          <h1 className="hero-title">
            Un nouveau défi<br />chaque jour à minuit.
          </h1>
          <p className="hero-sub">
            {todayLabel}. Joue, compare ton score avec tes amis et garde ta série en vie.
          </p>
          <div className="hero-cta">
            <Link to="/leaderboard" className="btn btn-ghost btn-lg">
              Voir le classement
            </Link>
          </div>
        </div>

        <div className="hero-card" style={{ '--g': game.accent } as React.CSSProperties}>
          <div className="hero-card-top">
            <GameGlyph game={game} size={44} />
            <div>
              <div className="hero-card-name">{game.name}</div>
              <div className="hero-card-cat">{game.tagLabel} · {game.cat}</div>
            </div>
            <span style={{ marginLeft: 'auto' }}>
              <Pill tone="live">EN LIGNE</Pill>
            </span>
          </div>
          <div className="hero-card-stats">
            <div>
              <b>{game.players.toLocaleString('fr-FR')}</b>
              <span>joueurs aujourd'hui</span>
            </div>
            <div>
              <b>{game.avgTries}</b>
              <span>essais en moyenne</span>
            </div>
          </div>
          {done && (
            <div className="hero-card-done">✓ Joué aujourd'hui</div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Game card ─────────────────────────────────────────────────────────────────
function GameCard({
  game,
  done,
  onPlay,
}: {
  game: Game
  done: boolean
  onPlay: () => void
}) {
  const live = game.status === 'live'

  const pill = done ? (
    <Pill tone="done">✓ Joué</Pill>
  ) : live ? (
    <Pill accent={game.accent}>À jouer</Pill>
  ) : (
    <Pill tone="soon">Bientôt</Pill>
  )

  const cardContent = (
    <>
      <div className="game-card-sheen" />
      <div className="game-card-head">
        <GameGlyph game={game} size={44} />
        {pill}
      </div>
      <div className="game-card-body">
        <h3 className="game-card-name">{game.name}</h3>
        <p className="game-card-tag">{game.desc}</p>
      </div>
      <div className="game-card-foot">
        <span className="game-card-cat">{game.tagLabel}</span>
        {live && (
          <span className="game-card-players">
            {game.players.toLocaleString('fr-FR')} joueurs
          </span>
        )}
      </div>
    </>
  )

  const style = { '--g': game.accent } as React.CSSProperties
  const cls = `game-card${live ? '' : ' is-soon'}`

  if (!live) {
    return (
      <button className={cls} style={style} disabled>
        {cardContent}
      </button>
    )
  }

  if (game.route) {
    return (
      <Link to={game.route} className={cls} style={style} onClick={onPlay}>
        {cardContent}
      </Link>
    )
  }

  if (game.url) {
    return (
      <a
        href={game.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        style={style}
        onClick={onPlay}
      >
        {cardContent}
      </a>
    )
  }

  return null
}

// ── Mini leaderboard ──────────────────────────────────────────────────────────
function MiniLeaderboard({
  entries,
  loading,
  currentUser,
}: {
  entries: CrossGameEntry[]
  loading: boolean
  currentUser: string | null
}) {
  return (
    <div className="mini-lb">
      <div className="mini-lb-head">
        <div>
          <div className="section-kicker">Entre amis</div>
          <div className="mini-lb-title">Classement du jour</div>
        </div>
        <Link to="/leaderboard" className="btn btn-ghost btn-sm">
          Tout voir →
        </Link>
      </div>
      <ol className="mini-lb-list">
        {loading ? (
          <li style={{ padding: '0.75rem 1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
            Chargement…
          </li>
        ) : entries.length === 0 ? (
          <li style={{ padding: '0.75rem 1.25rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
            Aucune partie terminée.
          </li>
        ) : (
          entries.slice(0, 5).map((r, i) => {
            const isMe = currentUser === r.username
            return (
              <li
                key={r.username}
                className={`mini-lb-row${isMe ? ' is-me' : ''}`}
              >
                <span className="mini-lb-rank">{i + 1}</span>
                <span
                  className="avatar"
                  style={{
                    width: 28,
                    height: 28,
                    fontSize: 11,
                    background: 'var(--card-2)',
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  {r.username.slice(0, 2).toUpperCase()}
                </span>
                <span className="mini-lb-name">
                  {r.username}
                  {isMe && ' (toi)'}
                </span>
                <span className="mini-lb-score">{r.total} pts</span>
              </li>
            )
          })
        )}
      </ol>
    </div>
  )
}

// ── Streak panel ──────────────────────────────────────────────────────────────
function StreakPanel({ doneCount, total, streak }: { doneCount: number; total: number; streak: number }) {
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const today = new Date().getDay()
  const todayIdx = today === 0 ? 6 : today - 1

  return (
    <div className="streak-panel">
      <div className="section-kicker">Ta progression</div>
      <div className="mini-lb-title" style={{ marginTop: '0.2rem' }}>Garde la série</div>
      <div className="streak-big">
        <span className="streak-flame-big">🔥</span>
        <b>{streak}</b>
        <span>jours d'affilée</span>
      </div>
      <div className="streak-week">
        {days.map((d, i) => (
          <div
            key={i}
            className={`streak-day${i <= todayIdx ? ' on' : ''}${i === todayIdx ? ' today' : ''}`}
          >
            <span>{d}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          fontSize: '0.8rem',
          color: 'var(--text-2)',
          marginBottom: '0.75rem',
          fontFamily: 'var(--mono)',
        }}
      >
        {doneCount} / {total} jeux aujourd'hui
      </div>
      <p className="streak-note">Reviens chaque jour avant minuit pour ne pas perdre ta série.</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
type DailyGamesPageProps = {
  doneIds: string[]
  onPlayExternal: (gameId: string) => void
}

export function DailyGamesPage({ doneIds, onPlayExternal }: DailyGamesPageProps) {
  const { user } = useAuth()
  const [crossEntries, setCrossEntries] = useState<CrossGameEntry[]>([])

  const internalDone: Record<string, boolean> = {
    cineclue: isCineclueCompleteToday(),
    sutom: isSutomCompleteToday(),
  }
  const effectiveDoneIds = [
    ...doneIds.filter((id) => !(id in internalDone)),
    ...Object.entries(internalDone).filter(([, v]) => v).map(([id]) => id),
  ]
  const [lbLoading, setLbLoading] = useState(true)
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    api.leaderboard
      .getCross()
      .then(({ entries }) => setCrossEntries(entries))
      .catch(() => setCrossEntries([]))
      .finally(() => setLbLoading(false))
    api.leaderboard.getCounts().then(({ counts }) => setPlayerCounts(counts)).catch(() => {})
  }, [])

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const gamesWithCounts = GAMES.map((g) => ({
    ...g,
    players: playerCounts[g.id] ?? g.players,
  }))
  const liveGames = gamesWithCounts.filter((g) => g.status === 'live')
  const featuredGame = liveGames[0]

  return (
    <div className="page">
      {featuredGame && (
        <HeroDaily
          game={featuredGame}
          done={effectiveDoneIds.includes(featuredGame.id)}
          todayLabel={todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
        />
      )}

      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-kicker">La sélection</div>
            <h2 className="section-title">Tous les jeux</h2>
          </div>
          <span className="section-meta">
            {liveGames.length} en ligne · {gamesWithCounts.filter((g) => g.status === 'soon').length} à venir
          </span>
        </div>
        <div className="game-grid">
          {gamesWithCounts.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              done={effectiveDoneIds.includes(g.id)}
              onPlay={() => onPlayExternal(g.id)}
            />
          ))}
        </div>
      </section>

      <section className="section section-split">
        <MiniLeaderboard
          entries={crossEntries}
          loading={lbLoading}
          currentUser={user?.username ?? null}
        />
        <StreakPanel doneCount={effectiveDoneIds.length} total={GAMES.length} streak={user?.streak ?? 0} />
      </section>
    </div>
  )
}
