import { date, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const spotleSessionStatusEnum = pgEnum("spotle_session_status", [
  "in_progress",
  "won",
  "lost",
]);

export const spotleArtists = pgTable("spotle_artists", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  creationYear: integer("creation_year"),
  memberCount: integer("member_count").notNull().default(1),
  spotifyFollowers: integer("spotify_followers").notNull().default(0),
  genres: jsonb("genres").notNull().$type<string[]>().default([]),
  country: text("country"),
  vocalType: text("vocal_type"),
  primaryLanguage: text("primary_language"),
  mostFamousSong: jsonb("most_famous_song").$type<{ title: string; spotifyStreams: number } | null>(),
  instrumentation: text("instrumentation"),
  appearsOnSoundtracksWith: jsonb("appears_on_soundtracks_with").notNull().$type<string[]>().default([]),
  imageUrl: text("image_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const spotleDaily = pgTable("spotle_daily", {
  date: date("date").primaryKey(),
  artistId: text("artist_id").notNull(),
});

export const spotleSessions = pgTable("spotle_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  guesses: jsonb("guesses").notNull().default([]),
  status: spotleSessionStatusEnum("status").notNull().default("in_progress"),
  completedAt: timestamp("completed_at"),
});

export type SpotleArtistRow = typeof spotleArtists.$inferSelect;
export type SpotleSessionRow = typeof spotleSessions.$inferSelect;
