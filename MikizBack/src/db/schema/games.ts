import { boolean, pgTable, text, uuid } from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
});

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
