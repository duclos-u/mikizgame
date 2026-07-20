import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const yearboxStatusEnum = pgEnum("yearbox_status", ["in_progress", "won", "lost"]);
export const yearboxSuggestionStatusEnum = pgEnum("yearbox_suggestion_status", [
  "pending",
  "approved",
  "rejected",
]);
export const yearboxDomainEnum = pgEnum("yearbox_domain", [
  "cinema",
  "musique",
  "sport",
  "politique",
  "tech",
]);

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

export const yearboxEventSuggestions = pgTable("yearbox_event_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  domain: yearboxDomainEnum("domain").notNull(),
  text: varchar("text", { length: 500 }).notNull(),
  status: yearboxSuggestionStatusEnum("status").notNull().default("pending"),
  adminNote: varchar("admin_note", { length: 300 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export type YearboxSession = typeof yearboxSessions.$inferSelect;
export type YearboxEventSuggestionRow = typeof yearboxEventSuggestions.$inferSelect;
