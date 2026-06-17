export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  JDJ2_STATE: 'jdj2',
  MOTIVEX_STATE: (date: string) => `motivexstate_${date}`,
  CINECLUE_STATE: (date: string) => `filmdujourstate_${date}`,
  HUB_SCORES: (gameId: string, date: string) => `hub_scores_${gameId}_${date}`,
} as const
