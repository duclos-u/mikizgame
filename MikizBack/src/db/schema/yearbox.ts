import { date, index, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const yearboxStatusEnum = pgEnum("yearbox_status", ["in_progress", "won", "lost"]);

export const yearboxDaily = pgTable("yearbox_daily", {
  date: date("date").primaryKey(),
  puzzleIndex: integer("puzzle_index").notNull(),
});

export const yearboxSessions = pgTable(
  "yearbox_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    guesses: jsonb("guesses").notNull().default([]),
    status: yearboxStatusEnum("status").notNull().default("in_progress"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_yearbox_sessions_user_date").on(table.userId, table.date)],
);

export type YearboxSession = typeof yearboxSessions.$inferSelect;
