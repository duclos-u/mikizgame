import { date, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
// solution stores the BFS-shortest path as a text array (startWord included), proving solvability.
import { users } from "./users";

export const chainapanSessionStatusEnum = pgEnum("chainapan_session_status", [
  "in_progress",
  "won",
  "lost",
]);

export const chainapanDaily = pgTable("chainapan_daily", {
  id: uuid("id").primaryKey().defaultRandom(),
  startWord: text("start_word").notNull(),
  targetWord: text("target_word").notNull(),
  date: date("date").notNull().unique(),
  solution: jsonb("solution").$type<string[]>(),
});

export const chainapanSessions = pgTable(
  "chainapan_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dailyId: uuid("daily_id")
      .notNull()
      .references(() => chainapanDaily.id),
    date: date("date").notNull(),
    steps: jsonb("steps").notNull().default([]),
    status: chainapanSessionStatusEnum("status").notNull().default("in_progress"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_chainapan_sessions_user_date").on(table.userId, table.date)],
);

export type ChainapanDailyRow = typeof chainapanDaily.$inferSelect;
export type ChainapanSession = typeof chainapanSessions.$inferSelect;
