import { useState, type ReactNode } from 'react'

export type GameResultModalProps = {
  /** e.g. "motivex" — builds classNames: `${classPrefix}-modal-overlay`, `-modal`, `-modal-close`, `-modal-title`, `-modal-share-text`, `-modal-actions`, `-btn-secondary` */
  classPrefix: string
  won: boolean
  /** Rendered as the title node with the shared win/lose color. Pass null/undefined to skip it (e.g. when headerExtra builds its own header block). */
  title?: ReactNode
  /** Content right under the title: points badge, chain summary, emoji+h2+p header block… */
  headerExtra?: ReactNode
  /** Game-specific result visualization (reveal card, tile grid, artist banner…). */
  children?: ReactNode
  /** Fully built share text (header + body + footer) — the modal only copies it. */
  shareText: string
  /** Whether to render the `<pre>` preview of shareText. Default true. */
  showSharePreview?: boolean
  shareLabel?: string
  sharedLabel?: string
  /** Default `${classPrefix}-btn-secondary`. */
  shareButtonClassName?: string
  showLeaderboardLink?: boolean
  /** Extra buttons rendered after the share/leaderboard actions (e.g. Cinemaxd's "Fermer"). */
  actionsExtra?: ReactNode
  /** Extra content rendered after the share preview, before the actions row (e.g. Vinymix's countdown). */
  preActionsExtra?: ReactNode
  /** Extra content rendered after the actions row (e.g. Yearbox's SuggestionForm). */
  footerExtra?: ReactNode
  showCloseButton?: boolean
  onClose: () => void
}

const WIN_COLOR = 'oklch(0.55 0.13 150)'
const LOSE_COLOR = 'oklch(0.58 0.18 25)'

export function GameResultModal({
  classPrefix,
  won,
  title,
  headerExtra,
  children,
  shareText,
  showSharePreview = true,
  shareLabel = 'Partager',
  sharedLabel = 'Copié ✓',
  shareButtonClassName,
  showLeaderboardLink = true,
  actionsExtra,
  preActionsExtra,
  footerExtra,
  showCloseButton = true,
  onClose,
}: GameResultModalProps) {
  const [shared, setShared] = useState(false)

  function share() {
    try {
      navigator.clipboard.writeText(shareText)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {}
  }

  return (
    <div className={`${classPrefix}-modal-overlay`} onClick={onClose}>
      <div
        className={`${classPrefix}-modal`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {showCloseButton && (
          <button type="button" className={`${classPrefix}-modal-close`} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        )}

        {title != null && (
          <div className={`${classPrefix}-modal-title`} style={{ color: won ? WIN_COLOR : LOSE_COLOR }}>
            {title}
          </div>
        )}

        {headerExtra}
        {children}

        {showSharePreview && <pre className={`${classPrefix}-modal-share-text`}>{shareText}</pre>}

        {preActionsExtra}

        <div className={`${classPrefix}-modal-actions`}>
          <button
            type="button"
            className={shareButtonClassName ?? `${classPrefix}-btn-secondary`}
            onClick={share}
          >
            {shared ? sharedLabel : shareLabel}
          </button>
          {showLeaderboardLink && (
            <a href="/leaderboard" className={`${classPrefix}-btn-secondary`}>
              Classement
            </a>
          )}
          {actionsExtra}
        </div>

        {footerExtra}
      </div>
    </div>
  )
}
