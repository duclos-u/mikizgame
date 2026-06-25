import { date, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const politicsStatusEnum = pgEnum("politics_status", ["in_progress", "won", "lost"]);

export const politicsDaily = pgTable("politics_daily", {
  date: date("date").primaryKey(),
  politicianIndex: integer("politician_index").notNull(),
});

export const politicsSessions = pgTable("politics_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  tentatives: jsonb("tentatives").notNull().default([]),
  status: politicsStatusEnum("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
});

export type PoliticsSession = typeof politicsSessions.$inferSelect;
