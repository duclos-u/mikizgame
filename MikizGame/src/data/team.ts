export type TeamMember = {
  name: string
  scores: boolean[]
  streak: number
  me?: boolean
}

export const TEAM: TeamMember[] = [
  { name: 'Thomas', scores: [true, true, false, true], streak: 12 },
  { name: 'Camille', scores: [true, false, true, true], streak: 8 },
  { name: 'Moi', scores: [true, true, true, false], streak: 5, me: true },
  { name: 'Raphaël', scores: [false, true, false, true], streak: 3 },
  { name: 'Sophie', scores: [false, false, true, false], streak: 1 },
]

export function completedTodayCount(scores: boolean[]): number {
  return scores.filter(Boolean).length
}
