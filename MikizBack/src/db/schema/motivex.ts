import { date, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const motivexSessionStatusEnum = pgEnum("motivex_session_status", [
  "in_progress",
  "won",
  "lost",
]);

export const motivexDailyWords = pgTable("motivex_daily_words", {
  id: uuid("id").primaryKey().defaultRandom(),
  word: text("word").notNull(),
  date: date("date").notNull().unique(),
});

export const motivexSessions = pgTable("motivex_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  wordId: uuid("word_id")
    .notNull()
    .references(() => motivexDailyWords.id),
  date: date("date").notNull(),
  attempts: jsonb("attempts").notNull().default([]),
  status: motivexSessionStatusEnum("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
});

export type MotivexDailyWord = typeof motivexDailyWords.$inferSelect;
export type MotivexSession = typeof motivexSessions.$inferSelect;
