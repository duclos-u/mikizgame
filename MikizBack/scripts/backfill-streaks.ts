import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { leaderboardEntries, users } from "../src/db/schema";
import { todayDate } from "../src/lib/date";

const allUsers = await db.select({ id: users.id }).from(users);

console.log(`Backfilling streaks for ${allUsers.length} user(s) from leaderboard_entries...`);

const today = todayDate();
const yesterday = new Date(today);
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const yesterdayStr = yesterday.toISOString().slice(0, 10);

let updated = 0;

for (const user of allUsers) {
  const rows = await db
    .selectDistinct({ date: leaderboardEntries.date })
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.userId, user.id));

  const dates = rows.map((r) => r.date).sort();
  if (dates.length === 0) continue;

  let longest = 1;
  let currentRun = 1;
  let currentRunEnd = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    prev.setUTCDate(prev.getUTCDate() + 1);
    const expectedNext = prev.toISOString().slice(0, 10);

    if (dates[i] === expectedNext) {
      currentRun++;
    } else {
      currentRun = 1;
    }
    currentRunEnd = dates[i];
    longest = Math.max(longest, currentRun);
  }

  const isRunOngoing = currentRunEnd === today || currentRunEnd === yesterdayStr;
  const streakCount = isRunOngoing ? currentRun : 0;
  const lastPlayedDate = isRunOngoing ? currentRunEnd : null;

  await db
    .update(users)
    .set({ streakCount, longestStreakCount: longest, lastPlayedDate })
    .where(eq(users.id, user.id));

  console.log(
    `  userId=${user.id} streak=${streakCount} longest=${longest} lastPlayed=${lastPlayedDate ?? "n/a"}`,
  );
  updated++;
}

console.log(`\nDone. Updated ${updated} user(s) with play history.`);
process.exit(0);
