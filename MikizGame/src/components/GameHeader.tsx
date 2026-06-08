import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type GameHeaderProps = {
  /** Nom du jeu (affiché au centre). */
  title: string
  /** Sous-titre optionnel (catégorie, consigne courte, etc.). */
  subtitle?: string
  /** Destination du lien « retour » (liste des jeux du jour par défaut). */
  backHref?: string
  /** Libellé du lien retour. */
  backLabel?: string
  /** Lien du logo vers l’accueil. */
  homeHref?: string
  /** Affiche le bouton équipe lorsque le handler est fourni. */
  onTeamClick?: () => void
  /** Libellé du bouton équipe. */
  teamButtonLabel?: string
  /** Contenu à droite après date / équipe (score, timer, menu…). */
  trailing?: ReactNode
}

export function GameHeader({
  title,
  subtitle,
  backHref = '/',
  backLabel = 'Les jeux du jour',
  homeHref = '/',
  onTeamClick,
  teamButtonLabel = '+ Rejoindre une équipe',
  trailing,
}: GameHeaderProps) {

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [],
  )

  return (
    <header className="game-header">
      <div className="game-header-start">
        <Link className="game-header-back" to={backHref}>
          ← {backLabel}
        </Link>
        <Link className="logo game-header-logo" to={homeHref} aria-label="Accueil">
          <span className="logo-mark">
            <span className="logo-dot" style={{ background: 'oklch(0.74 0.16 45)' }} />
            <span className="logo-dot" style={{ background: 'oklch(0.74 0.16 152)' }} />
            <span className="logo-dot" style={{ background: 'oklch(0.74 0.16 292)' }} />
          </span>
          <span className="logo-word">Mikiz<span className="logo-word-accent">Game</span></span>
        </Link>
      </div>

      <div className="game-header-center">
        <h1 className="game-header-title">{title}</h1>
        {subtitle ? <p className="game-header-subtitle">{subtitle}</p> : null}
      </div>

      <div className="game-header-end">
        {dateLabel ? <span className="header-date">{dateLabel}</span> : null}
        {onTeamClick ? (
          <button type="button" className="btn btn-primary" onClick={onTeamClick}>
            {teamButtonLabel}
          </button>
        ) : null}
        {trailing}
      </div>
    </header>
  )
}
