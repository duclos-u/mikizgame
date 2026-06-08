import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type HeaderProps = {
  onLoginClick: () => void
}

function Logo() {
  return (
    <Link className="logo" to="/" aria-label="Accueil MikizGame">
      <span className="logo-mark">
        <span className="logo-dot" style={{ background: 'oklch(0.70 0.17 45)' }} />
        <span className="logo-dot" style={{ background: 'oklch(0.66 0.15 152)' }} />
        <span className="logo-dot" style={{ background: 'oklch(0.62 0.16 292)' }} />
      </span>
      <span className="logo-word">Mikiz<span className="logo-word-accent">Game</span></span>
    </Link>
  )
}

export function Header({ onLoginClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <header className="app-header">
      <div className="header-inner">
        <Logo />

        <nav className="nav">
          <Link
            className={`nav-link${pathname === '/' ? ' active' : ''}`}
            to="/"
          >
            Accueil
          </Link>
          <Link
            className={`nav-link${pathname === '/leaderboard' ? ' active' : ''}`}
            to="/leaderboard"
          >
            Classement
          </Link>
        </nav>

        <div className="header-right">
          <span className="streak-chip" title="Série en cours">
            <span className="streak-flame">🔥</span>
            <span className="streak-num">7</span>
          </span>

          {user ? (
            <>
              <span className="user-chip">{user.username}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
                Déco
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={onLoginClick}>
              Se connecter
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
