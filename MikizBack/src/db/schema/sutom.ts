import { date, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const sutomSessionStatusEnum = pgEnum("sutom_session_status", [
  "in_progress",
  "won",
  "lost",
]);

export const sutomDailyWords = pgTable("sutom_daily_words", {
  id: uuid("id").primaryKey().defaultRandom(),
  word: text("word").notNull(),
  date: date("date").notNull().unique(),
});

export const sutomSessions = pgTable("sutom_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  wordId: uuid("word_id")
    .notNull()
    .references(() => sutomDailyWords.id),
  date: date("date").notNull(),
  attempts: jsonb("attempts").notNull().default([]),
  status: sutomSessionStatusEnum("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
});

export type SutomDailyWord = typeof sutomDailyWords.$inferSelect;
export type SutomSession = typeof sutomSessions.$inferSelect;
