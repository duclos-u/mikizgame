import { date, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const cinemaxdSessionStatusEnum = pgEnum("cinemaxd_session_status", [
  "in_progress",
  "won",
  "lost",
]);

export const cinemaxdSessions = pgTable("cinemaxd_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  tentatives: jsonb("tentatives").notNull().default([]),
  indices: jsonb("indices").notNull().default({}),
  status: cinemaxdSessionStatusEnum("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
});

export type CinemaxdSession = typeof cinemaxdSessions.$inferSelect;

export const cinemaxdDaily = pgTable("cinemaxd_daily", {
  date: date("date").primaryKey(),
  tmdbId: integer("tmdb_id").notNull(),
});
