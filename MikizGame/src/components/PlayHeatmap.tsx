import { useEffect, useMemo, useRef } from 'react'
import type { ProfileHistoryEntry } from '../api/client'
import { formatDayFr, today } from '../utils/date'

const HISTORY_DAYS = 365
const MONTH_LABELS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']
const WEEKDAY_LABELS = ['Lun', '', 'Mer', '', 'Ven', '', '']

type HeatCell = {
  date: string
  count: number
  future: boolean
}

function heatLevel(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

type PlayHeatmapProps = {
  history: ProfileHistoryEntry[]
  selectedDate: string | null
  onSelectDay: (date: string) => void
}

export function PlayHeatmap({ history, selectedDate, onSelectDay }: PlayHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayStr = today()

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of history) map.set(entry.date, (map.get(entry.date) ?? 0) + 1)
    return map
  }, [history])

  // Weeks as columns, Monday-start, all math in UTC to match the backend's day boundary.
  const weeks = useMemo(() => {
    const end = new Date(`${todayStr}T00:00:00Z`)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - (HISTORY_DAYS - 1))
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))

    const result: HeatCell[][] = []
    let week: HeatCell[] = []
    const cursor = new Date(start)
    while (cursor <= end) {
      const date = cursor.toISOString().slice(0, 10)
      week.push({ date, count: counts.get(date) ?? 0, future: false })
      if (week.length === 7) {
        result.push(week)
        week = []
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    if (week.length > 0) {
      while (week.length < 7) {
        const date = cursor.toISOString().slice(0, 10)
        week.push({ date, count: 0, future: true })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      result.push(week)
    }
    return result
  }, [counts, todayStr])

  const monthLabels = useMemo(() => {
    const labels: Array<{ col: number; label: string }> = []
    let prevMonth = -1
    for (let i = 0; i < weeks.length; i++) {
      const month = new Date(`${weeks[i][0].date}T00:00:00Z`).getUTCMonth()
      if (month !== prevMonth) {
        const last = labels[labels.length - 1]
        if (!last || i - last.col >= 2) labels.push({ col: i, label: MONTH_LABELS[month] })
        prevMonth = month
      }
    }
    return labels
  }, [weeks])

  // Land on today (right edge) on mount — matters on narrow viewports.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  return (
    <div className="heatmap">
      <div className="heatmap-body">
        <div className="heatmap-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={`wd-${i}`}>{label}</span>
          ))}
        </div>
        <div className="heatmap-scroll" ref={scrollRef}>
          <div
            className="heatmap-months"
            aria-hidden="true"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heat-cell))` }}
          >
            {monthLabels.map(({ col, label }) => (
              <span key={col} style={{ gridColumnStart: col + 1 }}>
                {label}
              </span>
            ))}
          </div>
          <div className="heatmap-grid">
            {weeks.flat().map((cell) =>
              cell.future ? (
                <div key={cell.date} className="heatmap-cell future" />
              ) : (
                <button
                  key={cell.date}
                  type="button"
                  className={`heatmap-cell heat-${heatLevel(cell.count)}${cell.date === todayStr ? ' today' : ''}${cell.date === selectedDate ? ' selected' : ''}`}
                  title={
                    cell.count > 0
                      ? `${cell.count} jeu${cell.count > 1 ? 'x' : ''} le ${formatDayFr(cell.date)}`
                      : `Aucun jeu le ${formatDayFr(cell.date)}`
                  }
                  aria-label={
                    cell.count > 0
                      ? `${cell.count} jeu${cell.count > 1 ? 'x' : ''} le ${formatDayFr(cell.date)}`
                      : `Aucun jeu le ${formatDayFr(cell.date)}`
                  }
                  onClick={() => onSelectDay(cell.date)}
                />
              ),
            )}
          </div>
        </div>
      </div>
      <div className="heatmap-legend">
        <span>Moins</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={`heatmap-cell heat-${level}`} />
        ))}
        <span>Plus</span>
      </div>
    </div>
  )
}
