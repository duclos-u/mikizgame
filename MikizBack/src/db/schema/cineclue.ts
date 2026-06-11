import { date, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const cineclueSessionStatusEnum = pgEnum("cineclue_session_status", [
  "in_progress",
  "won",
  "lost",
]);

export const cineclueSessions = pgTable("cineclue_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  // Tableau des tentatives : [{ tmdbId, filmSoumis }]
  tentatives: jsonb("tentatives").notNull().default([]),
  // Indices cumulés révélés au fil des tentatives
  indices: jsonb("indices").notNull().default({}),
  status: cineclueSessionStatusEnum("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
});

export type CineclueSession = typeof cineclueSessions.$inferSelect;

export const cineclueDaily = pgTable("cineclue_daily", {
  date: date("date").primaryKey(),
  tmdbId: integer("tmdb_id").notNull(),
});
