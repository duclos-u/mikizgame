import { pgTable, index, uniqueIndex, foreignKey, uuid, date, integer, timestamp, unique, text, boolean, jsonb, varchar, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const cinemaxdSessionStatus = pgEnum("cinemaxd_session_status", ['in_progress', 'won', 'lost'])
export const motivexSessionStatus = pgEnum("motivex_session_status", ['in_progress', 'won', 'lost'])
export const politekiStatus = pgEnum("politeki_status", ['in_progress', 'won', 'lost'])
export const politiclueSessionStatus = pgEnum("politiclue_session_status", ['in_progress', 'won', 'lost'])
export const vinymixSessionStatus = pgEnum("vinymix_session_status", ['in_progress', 'won', 'lost'])


export const leaderboardEntries = pgTable("leaderboard_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	gameId: uuid("game_id").notNull(),
	date: date().notNull(),
	score: integer(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_lb_game_date").using("btree", table.gameId.asc().nullsLast().op("date_ops"), table.date.asc().nullsLast().op("date_ops")),
	uniqueIndex("uq_lb_user_game_date").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.gameId.asc().nullsLast().op("uuid_ops"), table.date.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "leaderboard_entries_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "leaderboard_entries_game_id_games_id_fk"
		}),
]);

export const games = pgTable("games", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	active: boolean().default(true).notNull(),
}, (table) => [
	unique("games_slug_unique").on(table.slug),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	username: text().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	lastLoginDate: date("last_login_date"),
	streakCount: integer("streak_count").default(0).notNull(),
}, (table) => [
	unique("users_username_unique").on(table.username),
	unique("users_email_unique").on(table.email),
]);

export const motivexDailyWords = pgTable("motivex_daily_words", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	word: text().notNull(),
	date: date().notNull(),
}, (table) => [
	unique("motivex_daily_words_date_unique").on(table.date),
]);

export const motivexSessions = pgTable("motivex_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	wordId: uuid("word_id").notNull(),
	date: date().notNull(),
	attempts: jsonb().default([]).notNull(),
	status: motivexSessionStatus().default('in_progress').notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "motivex_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.wordId],
			foreignColumns: [motivexDailyWords.id],
			name: "motivex_sessions_word_id_motivex_daily_words_id_fk"
		}),
]);

export const politiclueSessions = pgTable("politiclue_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	date: date().notNull(),
	guesses: jsonb().default([]).notNull(),
	cluesRevealed: integer("clues_revealed").default(1).notNull(),
	status: politiclueSessionStatus().default('in_progress').notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "politiclue_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const vinymixArtists = pgTable("vinymix_artists", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	creationYear: integer("creation_year"),
	memberCount: integer("member_count").default(1).notNull(),
	spotifyFollowers: integer("spotify_followers").default(0).notNull(),
	genres: jsonb().default([]).notNull(),
	mostFamousSong: jsonb("most_famous_song"),
	imageUrl: text("image_url"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	gender: text(),
	country: text(),
	spotifyPopularity: integer("spotify_popularity").default(0).notNull(),
});

export const vinymixDaily = pgTable("vinymix_daily", {
	date: date().primaryKey().notNull(),
	artistId: text("artist_id").notNull(),
});

export const politekiSessions = pgTable("politeki_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	date: date().notNull(),
	tentatives: jsonb().default([]).notNull(),
	status: politekiStatus().default('in_progress').notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "politics_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const vinymixSessions = pgTable("vinymix_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	date: date().notNull(),
	guesses: jsonb().default([]).notNull(),
	status: vinymixSessionStatus().default('in_progress').notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "vinymix_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const cinemaxdSessions = pgTable("cinemaxd_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	date: date().notNull(),
	tentatives: jsonb().default([]).notNull(),
	indices: jsonb().default({}).notNull(),
	status: cinemaxdSessionStatus().default('in_progress').notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cineclue_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const politekiDaily = pgTable("politeki_daily", {
	date: date().primaryKey().notNull(),
	politicianIndex: integer("politician_index").notNull(),
});

export const cinemaxdDaily = pgTable("cinemaxd_daily", {
	date: date().primaryKey().notNull(),
	tmdbId: integer("tmdb_id").notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: varchar({ length: 64 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_reset_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("password_reset_tokens_token_unique").on(table.token),
]);

export const politiclueDaily = pgTable("politiclue_daily", {
	date: date().primaryKey().notNull(),
	politicianId: uuid("politician_id").notNull(),
});

export const politicluePoliticians = pgTable("politiclue_politicians", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	prenom: text().notNull(),
	nom: text().notNull(),
	politiscore: integer().notNull(),
	partis: jsonb().default([]).notNull(),
	mandats: jsonb().default([]).notNull(),
}, (table) => [
	uniqueIndex("politiclue_politicians_prenom_nom_idx").using("btree", table.prenom.asc().nullsLast().op("text_ops"), table.nom.asc().nullsLast().op("text_ops")),
]);
