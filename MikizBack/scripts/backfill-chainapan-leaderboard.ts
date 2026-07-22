import { and, eq, ne } from "drizzle-orm";
import { db } from "../src/db";
import { chainapanDaily, chainapanSessions, games, leaderboardEntries } from "../src/db/schema";

const chainapanGame = await db
  .select()
  .from(games)
  .where(eq(games.slug, "chainapan"))
  .then((r) => r[0]);

if (!chainapanGame) {
  console.error("No chainapan game row found in games table. Aborting.");
  process.exit(1);
}

const gameId = chainapanGame.id;

const completedSessions = await db
  .select()
  .from(chainapanSessions)
  .where(ne(chainapanSessions.status, "in_progress"));

console.log(`Found ${completedSessions.length} completed chainapan session(s).`);

let inserted = 0;
let alreadyPresent = 0;
let corrected = 0;

for (const session of completedSessions) {
  const daily = await db.query.chainapanDaily.findFirst({
    where: eq(chainapanDaily.id, session.dailyId),
  });
  const minSteps = (daily?.solution?.length ?? 2) - 1;
  const steps = session.steps as string[];
  const score = session.status === "won" ? Math.max(1, steps.length - minSteps + 1) : null;

  const [existing] = await db
    .select()
    .from(leaderboardEntries)
    .where(
      and(
        eq(leaderboardEntries.userId, session.userId),
        eq(leaderboardEntries.gameId, gameId),
        eq(leaderboardEntries.date, session.date),
      ),
    );

  if (existing) {
    if (existing.score !== null && existing.score <= 0) {
      await db
        .update(leaderboardEntries)
        .set({ score: Math.max(1, existing.score) })
        .where(eq(leaderboardEntries.id, existing.id));
      console.log(
        `  FIX   userId=${session.userId} date=${session.date} score ${existing.score} -> ${Math.max(1, existing.score)}`,
      );
      corrected++;
    } else {
      console.log(`  SKIP  userId=${session.userId} date=${session.date} — entry already exists`);
      alreadyPresent++;
    }
    continue;
  }

  await db.insert(leaderboardEntries).values({
    userId: session.userId,
    gameId,
    date: session.date,
    score,
  });

  console.log(
    `  INSERT userId=${session.userId} date=${session.date} score=${score ?? "null (loss)"}`,
  );
  inserted++;
}

console.log(
  `\nDone. Inserted: ${inserted}, corrected: ${corrected}, already present: ${alreadyPresent}.`,
);
process.exit(0);
