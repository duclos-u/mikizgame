export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  JDJ2_STATE: 'jdj2',
  MOTIVEX_STATE: (date: string) => `motivexstate_${date}`,
  CINEMAXD_STATE: (date: string) => `filmdujourstate_${date}`,
  VINYMIX_STATE: (date: string) => `vinymixstate_${date}`,
  POLITICS_STATE: (date: string) => `politiclue2_${date}`,
  HUB_SCORES: (gameId: string, date: string) => `hub_scores_${gameId}_${date}`,
} as const
