import { relations } from "drizzle-orm/relations";
import { users, leaderboardEntries, games, motivexSessions, motivexDailyWords, politiclueSessions, politekiSessions, vinymixSessions, cinemaxdSessions, passwordResetTokens } from "./schema";

export const leaderboardEntriesRelations = relations(leaderboardEntries, ({one}) => ({
	user: one(users, {
		fields: [leaderboardEntries.userId],
		references: [users.id]
	}),
	game: one(games, {
		fields: [leaderboardEntries.gameId],
		references: [games.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	leaderboardEntries: many(leaderboardEntries),
	motivexSessions: many(motivexSessions),
	politiclueSessions: many(politiclueSessions),
	politekiSessions: many(politekiSessions),
	vinymixSessions: many(vinymixSessions),
	cinemaxdSessions: many(cinemaxdSessions),
	passwordResetTokens: many(passwordResetTokens),
}));

export const gamesRelations = relations(games, ({many}) => ({
	leaderboardEntries: many(leaderboardEntries),
}));

export const motivexSessionsRelations = relations(motivexSessions, ({one}) => ({
	user: one(users, {
		fields: [motivexSessions.userId],
		references: [users.id]
	}),
	motivexDailyWord: one(motivexDailyWords, {
		fields: [motivexSessions.wordId],
		references: [motivexDailyWords.id]
	}),
}));

export const motivexDailyWordsRelations = relations(motivexDailyWords, ({many}) => ({
	motivexSessions: many(motivexSessions),
}));

export const politiclueSessionsRelations = relations(politiclueSessions, ({one}) => ({
	user: one(users, {
		fields: [politiclueSessions.userId],
		references: [users.id]
	}),
}));

export const politekiSessionsRelations = relations(politekiSessions, ({one}) => ({
	user: one(users, {
		fields: [politekiSessions.userId],
		references: [users.id]
	}),
}));

export const vinymixSessionsRelations = relations(vinymixSessions, ({one}) => ({
	user: one(users, {
		fields: [vinymixSessions.userId],
		references: [users.id]
	}),
}));

export const cinemaxdSessionsRelations = relations(cinemaxdSessions, ({one}) => ({
	user: one(users, {
		fields: [cinemaxdSessions.userId],
		references: [users.id]
	}),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({one}) => ({
	user: one(users, {
		fields: [passwordResetTokens.userId],
		references: [users.id]
	}),
}));