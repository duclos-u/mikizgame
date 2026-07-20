import { integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userStreakMilestones = pgTable(
  "user_streak_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    milestone: integer("milestone").notNull(),
    achievedAt: timestamp("achieved_at").notNull().defaultNow(),
    shownAt: timestamp("shown_at"),
  },
  (table) => [uniqueIndex("uq_user_milestone").on(table.userId, table.milestone)],
);

export type UserStreakMilestone = typeof userStreakMilestones.$inferSelect;
