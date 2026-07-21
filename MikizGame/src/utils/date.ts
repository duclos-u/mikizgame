export const today = (): string => new Date().toISOString().slice(0, 10)

// Formats a YYYY-MM-DD date as e.g. "12 juillet 2026", in UTC to match the backend's day boundary.
export const formatDayFr = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
