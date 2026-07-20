import { useEffect, useRef, useState } from 'react'

type StreakShareCardProps = {
  open: boolean
  onClose: () => void
  streak: number
  milestone?: number | null
}

const CARD_SIZE = 1080

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function drawCard(canvas: HTMLCanvasElement, streak: number, milestone?: number | null) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const accent = cssVar('--accent') || 'oklch(0.70 0.17 45)'
  const bg = cssVar('--bg-2') || '#f4ede2'
  const text = cssVar('--text') || '#3a2c1f'

  ctx.clearRect(0, 0, CARD_SIZE, CARD_SIZE)

  const gradient = ctx.createLinearGradient(0, 0, CARD_SIZE, CARD_SIZE)
  gradient.addColorStop(0, bg)
  gradient.addColorStop(1, accent)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE)

  ctx.textAlign = 'center'

  ctx.font = '220px sans-serif'
  ctx.fillText('🔥', CARD_SIZE / 2, 420)

  ctx.fillStyle = text
  ctx.font = '700 220px "Baloo 2", sans-serif'
  ctx.fillText(String(streak), CARD_SIZE / 2, 650)

  ctx.font = '600 56px "Hanken Grotesk", sans-serif'
  ctx.fillText(streak > 1 ? 'jours de série' : 'jour de série', CARD_SIZE / 2, 730)

  if (milestone) {
    ctx.font = '600 42px "Hanken Grotesk", sans-serif'
    ctx.fillText(`Palier ${milestone} jours atteint !`, CARD_SIZE / 2, 830)
  }

  ctx.font = '500 36px "Hanken Grotesk", sans-serif'
  ctx.fillText('mikiz.fr', CARD_SIZE / 2, CARD_SIZE - 80)
}

export function StreakShareCard({ open, onClose, streak, milestone }: StreakShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !canvasRef.current) return
    drawCard(canvasRef.current, streak, milestone)
  }, [open, streak, milestone])

  async function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mikiz-streak-${streak}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  async function handleCopy() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) return
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      } catch {
        // Clipboard image write not supported — download remains available.
      }
    })
  }

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal streak-share-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Partager ta série</h2>
        <canvas
          ref={canvasRef}
          width={CARD_SIZE}
          height={CARD_SIZE}
          className="streak-share-canvas"
        />
        <div className="modal-footer">
          <button type="button" className="btn" style={{ flex: 1 }} onClick={onClose}>
            Fermer
          </button>
          {typeof ClipboardItem !== 'undefined' && (
            <button type="button" className="btn" style={{ flex: 1 }} onClick={handleCopy}>
              {copied ? 'Copié ✓' : 'Copier'}
            </button>
          )}
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleDownload}>
            Télécharger
          </button>
        </div>
      </div>
    </div>
  )
}
