import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const vinymixSessionStatusEnum = pgEnum("vinymix_session_status", [
  "in_progress",
  "won",
  "lost",
]);

export const vinymixArtists = pgTable("vinymix_artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  creationYear: integer("creation_year"),
  memberCount: integer("member_count").notNull().default(1),
  spotifyFollowers: integer("spotify_followers").notNull().default(0),
  spotifyPopularity: integer("spotify_popularity").notNull().default(0),
  genres: jsonb("genres").notNull().$type<string[]>().default([]),
  gender: text("gender"),
  country: text("country"),
  imageUrl: text("image_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const vinymixDaily = pgTable("vinymix_daily", {
  date: date("date").primaryKey(),
  artistId: text("artist_id").notNull(),
});

export const vinymixSessions = pgTable(
  "vinymix_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    guesses: jsonb("guesses").notNull().default([]),
    status: vinymixSessionStatusEnum("status").notNull().default("in_progress"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("idx_vinymix_sessions_user_date").on(table.userId, table.date)],
);

export type VinymixArtistRow = typeof vinymixArtists.$inferSelect;
export type VinymixSessionRow = typeof vinymixSessions.$inferSelect;
