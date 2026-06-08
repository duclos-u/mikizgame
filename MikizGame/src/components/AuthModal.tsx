import { useEffect, useId, useState } from 'react'
import { useAuth } from '../context/AuthContext'

type AuthModalProps = {
  open: boolean
  onClose: () => void
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const titleId = useId()
  const usernameId = useId()
  const emailId = useId()
  const passwordId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setError('')
      setUsername('')
      setEmail('')
      setPassword('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(username, email, password)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        <p>
          {mode === 'login'
            ? 'Connecte-toi pour sauvegarder tes scores et apparaître au classement.'
            : 'Crée un compte pour rejoindre le classement de ton équipe.'}
        </p>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label htmlFor={usernameId}>Pseudo</label>
              <input
                id={usernameId}
                className="modal-input"
                type="text"
                placeholder="ex : ulysse"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </>
          )}
          <label htmlFor={emailId}>Email</label>
          <input
            id={emailId}
            className="modal-input"
            type="email"
            placeholder="toi@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label htmlFor={passwordId}>Mot de passe</label>
          <input
            id={passwordId}
            className="modal-input"
            type="password"
            placeholder={mode === 'register' ? '8 caractères minimum' : ''}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {error && (
            <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              {error}
            </p>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2 }}
              disabled={submitting}
            >
              {submitting ? '…' : mode === 'login' ? 'Se connecter →' : 'Créer →'}
            </button>
          </div>
        </form>
        <p
          style={{
            marginTop: '1rem',
            fontSize: '0.78rem',
            color: 'var(--muted)',
            textAlign: 'center',
          }}
        >
          {mode === 'login' ? (
            <>
              Pas encore de compte ?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('register')
                  setError('')
                }}
              >
                Créer un compte
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode('login')
                  setError('')
                }}
              >
                Se connecter
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
