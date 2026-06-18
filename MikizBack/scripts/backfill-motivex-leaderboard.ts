import { and, eq, ne } from "drizzle-orm";
import { db } from "../src/db";
import { games, leaderboardEntries, motivexSessions } from "../src/db/schema";

const motivexGame = await db
  .select()
  .from(games)
  .where(eq(games.slug, "motivex"))
  .then((r) => r[0]);

if (!motivexGame) {
  console.error("No motivex game row found in games table. Aborting.");
  process.exit(1);
}

const gameId = motivexGame.id;

const completedSessions = await db
  .select()
  .from(motivexSessions)
  .where(ne(motivexSessions.status, "in_progress"));

console.log(`Found ${completedSessions.length} completed motivex session(s).`);

let inserted = 0;
let alreadyPresent = 0;

for (const session of completedSessions) {
  const existing = await db
    .select()
    .from(leaderboardEntries)
    .where(
      and(
        eq(leaderboardEntries.userId, session.userId),
        eq(leaderboardEntries.gameId, gameId),
        eq(leaderboardEntries.date, session.date),
      ),
    );

  if (existing.length > 0) {
    console.log(`  SKIP  userId=${session.userId} date=${session.date} — entry already exists`);
    alreadyPresent++;
    continue;
  }

  const score = session.status === "won" ? (session.attempts as unknown[]).length : null;

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

console.log(`\nDone. Inserted: ${inserted}, already present: ${alreadyPresent}.`);
process.exit(0);
