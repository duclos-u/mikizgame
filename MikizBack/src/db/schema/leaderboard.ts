import { date, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { games } from "./games";
import { users } from "./users";

export const leaderboardEntries = pgTable("leaderboard_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id),
  date: date("date").notNull(),
  // Number of attempts to win; NULL means the user lost
  score: integer("score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
