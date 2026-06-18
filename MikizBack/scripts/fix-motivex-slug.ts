import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { games, leaderboardEntries } from "../src/db/schema";

const allGames = await db.select().from(games);
console.log("Current games table:", allGames);

const sutom = allGames.find((g) => g.slug === "sutom");
const motivex = allGames.find((g) => g.slug === "motivex");

if (!sutom && !motivex) {
  console.log("No sutom or motivex row found — inserting motivex row");
  await db.insert(games).values({ slug: "motivex", name: "Motivex", active: true });
  console.log("Done.");
} else if (sutom && motivex) {
  console.log(
    `Both exist. Migrating leaderboard entries from sutom (${sutom.id}) to motivex (${motivex.id})`,
  );
  const result = await db
    .update(leaderboardEntries)
    .set({ gameId: motivex.id })
    .where(eq(leaderboardEntries.gameId, sutom.id));
  console.log("Entries migrated:", result);
  await db.delete(games).where(eq(games.id, sutom.id));
  console.log("Deleted sutom row.");
} else if (sutom && !motivex) {
  console.log(`Only sutom found (${sutom.id}). Renaming to motivex.`);
  await db.update(games).set({ slug: "motivex", name: "Motivex" }).where(eq(games.id, sutom.id));
  console.log("Done.");
} else {
  console.log("motivex already exists, nothing to do.");
}

const finalGames = await db.select().from(games);
console.log("Final games table:", finalGames);
process.exit(0);
