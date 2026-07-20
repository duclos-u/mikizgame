import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { userStreakMilestones, users } from "../db/schema";
import { todayDate } from "./date";

export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

export type StreakFields = {
  streakCount: number;
  longestStreakCount: number;
  lastPlayedDate: string | null;
};

export type StreakUpdate = StreakFields & {
  changed: boolean;
  newMilestone: number | null;
};

function findNewMilestone(previousStreak: number, newStreak: number): number | null {
  return STREAK_MILESTONES.find((m) => previousStreak < m && newStreak >= m) ?? null;
}

/**
 * Pure streak-transition logic: same-day → no-op, consecutive day → +1,
 * any gap → reset to 1. Longest streak tracks the running max.
 */
export function computeStreakUpdate(current: StreakFields, today: string): StreakUpdate {
  const { streakCount, longestStreakCount, lastPlayedDate } = current;

  if (lastPlayedDate === today) {
    return { streakCount, longestStreakCount, lastPlayedDate, changed: false, newMilestone: null };
  }

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const newStreak = lastPlayedDate === yesterdayStr ? streakCount + 1 : 1;
  const newLongest = Math.max(longestStreakCount, newStreak);
  const newMilestone = findNewMilestone(streakCount, newStreak);

  return {
    streakCount: newStreak,
    longestStreakCount: newLongest,
    lastPlayedDate: today,
    changed: true,
    newMilestone,
  };
}

/**
 * Call once per completed game session. No-ops if the user already
 * played today, so completing several games the same day is harmless.
 */
export async function recordDailyPlay(userId: string): Promise<StreakUpdate> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streakCount: true, longestStreakCount: true, lastPlayedDate: true },
  });
  if (!user) {
    return {
      streakCount: 0,
      longestStreakCount: 0,
      lastPlayedDate: null,
      changed: false,
      newMilestone: null,
    };
  }

  const today = todayDate();
  const update = computeStreakUpdate(user, today);
  if (!update.changed) return update;

  await db
    .update(users)
    .set({
      streakCount: update.streakCount,
      longestStreakCount: update.longestStreakCount,
      lastPlayedDate: update.lastPlayedDate,
    })
    .where(
      and(
        eq(users.id, userId),
        sql`${users.lastPlayedDate} IS DISTINCT FROM ${update.lastPlayedDate}`,
      ),
    );

  if (update.newMilestone) {
    await db
      .insert(userStreakMilestones)
      .values({ userId, milestone: update.newMilestone })
      .onConflictDoNothing();
  }

  return update;
}
