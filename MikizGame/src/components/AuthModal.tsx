import { useEffect, useId, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'

type ModalMode = 'login' | 'register' | 'forgot' | 'reset'

type AuthModalProps = {
  open: boolean
  onClose: () => void
  initialMode?: ModalMode
  resetToken?: string
}

const TITLES: Record<ModalMode, string> = {
  login: 'Connexion',
  register: 'Créer un compte',
  forgot: 'Mot de passe oublié',
  reset: 'Nouveau mot de passe',
}

const DESCRIPTIONS: Record<ModalMode, string> = {
  login: 'Connecte-toi pour sauvegarder tes scores et apparaître au classement.',
  register: 'Crée un compte pour rejoindre le classement de ton équipe.',
  forgot: 'Saisis ton adresse email pour recevoir un lien de réinitialisation.',
  reset: 'Choisis un nouveau mot de passe pour ton compte.',
}

export function AuthModal({ open, onClose, initialMode, resetToken }: AuthModalProps) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<ModalMode>(initialMode ?? 'login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const titleId = useId()
  const usernameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const confirmPasswordId = useId()

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
      setSuccess('')
      setUsername('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setMode(initialMode ?? 'login')
    }
  }, [open, initialMode])

  const switchMode = (next: ModalMode) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        onClose()
      } else if (mode === 'register') {
        await register(username, email, password)
        onClose()
      } else if (mode === 'forgot') {
        await api.auth.forgotPassword(email)
        setSuccess('Si cet email est enregistré, un lien de réinitialisation a été envoyé.')
      } else if (mode === 'reset') {
        if (password !== confirmPassword) {
          setError('Les mots de passe ne correspondent pas.')
          return
        }
        await api.auth.resetPassword(resetToken ?? '', password)
        setSuccess('Mot de passe réinitialisé. Tu peux maintenant te connecter.')
        switchMode('login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setSubmitting(false)
    }
  }

  const submitLabel = () => {
    if (submitting) return '…'
    if (mode === 'login') return 'Se connecter →'
    if (mode === 'register') return 'Créer →'
    if (mode === 'forgot') return 'Envoyer le lien →'
    return 'Réinitialiser →'
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
        <h2 id={titleId}>{TITLES[mode]}</h2>
        <p>{DESCRIPTIONS[mode]}</p>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label htmlFor={usernameId}>Pseudo</label>
              <input
                id={usernameId}
                className="modal-input"
                type="text"
                placeholder="ex : steve"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </>
          )}
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <>
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
            </>
          )}
          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <>
              <label htmlFor={passwordId}>
                {mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
              </label>
              <input
                id={passwordId}
                className="modal-input"
                type="password"
                placeholder={mode === 'login' ? '' : '8 caractères minimum'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </>
          )}
          {mode === 'reset' && (
            <>
              <label htmlFor={confirmPasswordId}>Confirmer le mot de passe</label>
              <input
                id={confirmPasswordId}
                className="modal-input"
                type="password"
                placeholder="Répète le mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </>
          )}
          {error && (
            <p style={{ color: 'var(--red)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              {error}
            </p>
          )}
          {success && (
            <p
              style={{
                color: 'oklch(0.58 0.15 145)',
                fontSize: '0.82rem',
                marginBottom: '0.75rem',
              }}
            >
              {success}
            </p>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>
              Annuler
            </button>
            {!(mode === 'forgot' && success) && (
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={submitting}
              >
                {submitLabel()}
              </button>
            )}
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
              <button type="button" className="link-btn" onClick={() => switchMode('register')}>
                Créer un compte
              </button>
              {' · '}
              <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>
                Mot de passe oublié ?
              </button>
            </>
          ) : mode === 'register' ? (
            <>
              Déjà un compte ?{' '}
              <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                Se connecter
              </button>
            </>
          ) : (
            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
              ← Retour à la connexion
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
