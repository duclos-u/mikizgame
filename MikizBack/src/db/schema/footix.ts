import { date, index, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const footixStatusEnum = pgEnum("footix_status", ["in_progress", "won", "lost"]);

export const footixDaily = pgTable("footix_daily", {
  date: date("date").primaryKey(),
  footballerIndex: integer("footballer_index").notNull(),
});

export const footixSessions = pgTable(
  "footix_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    tentatives: jsonb("tentatives").notNull().default([]),
    status: footixStatusEnum("status").notNull().default("in_progress"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_footix_sessions_user_date").on(table.userId, table.date)],
);

export type FootixSession = typeof footixSessions.$inferSelect;
