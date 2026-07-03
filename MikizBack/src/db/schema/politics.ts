import { date, index, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const politicsStatusEnum = pgEnum("politeki_status", ["in_progress", "won", "lost"]);

export const politicsDaily = pgTable("politeki_daily", {
  date: date("date").primaryKey(),
  politicianIndex: integer("politician_index").notNull(),
});

export const politicsSessions = pgTable(
  "politeki_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    tentatives: jsonb("tentatives").notNull().default([]),
    status: politicsStatusEnum("status").notNull().default("in_progress"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_politeki_sessions_user_date").on(table.userId, table.date)],
);

export type PoliticsSession = typeof politicsSessions.$inferSelect;
