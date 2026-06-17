import { date, index, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { games } from "./games";
import { users } from "./users";

export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
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
  },
  (table) => [
    index("idx_lb_game_date").on(table.gameId, table.date),
    uniqueIndex("uq_lb_user_game_date").on(table.userId, table.gameId, table.date),
  ],
);

export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
