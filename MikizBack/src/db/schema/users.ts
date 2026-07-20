import { boolean, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastPlayedDate: date("last_played_date"),
  streakCount: integer("streak_count").notNull().default(0),
  longestStreakCount: integer("longest_streak_count").notNull().default(0),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
