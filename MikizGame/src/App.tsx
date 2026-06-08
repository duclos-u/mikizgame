import { useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { AuthModal } from './components/AuthModal'
import { DailyGamesPage } from './components/DailyGamesPage'
import { Header } from './components/Header'
import { LeaderboardPage } from './components/LeaderboardPage'
import { AuthProvider } from './context/AuthContext'
import { useJdj2State } from './hooks/useJdj2State'
import { GameRoutePage } from './routes/GameRoutePage'

function AppFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '1.25rem 1.5rem' }}>
      <div className="app-footer">
        <Link
          to="/"
          className="logo"
          aria-label="Accueil MikizGame"
          style={{ textDecoration: 'none' }}
        >
          <span className="logo-mark">
            <span className="logo-dot" style={{ background: 'oklch(0.70 0.17 45)' }} />
            <span className="logo-dot" style={{ background: 'oklch(0.66 0.15 152)' }} />
            <span className="logo-dot" style={{ background: 'oklch(0.62 0.16 292)' }} />
          </span>
          <span className="logo-word">
            Mikiz<span className="logo-word-accent">Game</span>
          </span>
        </Link>
        <span className="foot-note">
          Fait maison · un jeu chaque jour à minuit · © 2026 MikizGame
        </span>
        <div className="foot-links">
          <Link to="/">Accueil</Link>
          <Link to="/leaderboard">Classement</Link>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const { state, markGameDone } = useJdj2State()
  const [authModalOpen, setAuthModalOpen] = useState(false)

  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/"
          element={
            <div className="app-root">
              <Header onLoginClick={() => setAuthModalOpen(true)} />
              <main className="app-main">
                <DailyGamesPage doneIds={state.done} onPlayExternal={markGameDone} />
              </main>
              <AppFooter />
              <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
            </div>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <div className="app-root">
              <Header onLoginClick={() => setAuthModalOpen(true)} />
              <main className="app-main">
                <LeaderboardPage />
              </main>
              <AppFooter />
              <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
            </div>
          }
        />
        <Route path="/games/:gameId" element={<GameRoutePage />} />
      </Routes>
    </AuthProvider>
  )
}
