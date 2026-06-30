ALTER TABLE "politiclue_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politiclue_daily" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "politiclue_politicians" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "politiclue_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "politiclue_daily" CASCADE;--> statement-breakpoint
DROP TABLE "politiclue_politicians" CASCADE;--> statement-breakpoint
ALTER TABLE "politeki_sessions" DROP CONSTRAINT "politics_sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cinemaxd_sessions" DROP CONSTRAINT "cineclue_sessions_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "idx_lb_game_date";--> statement-breakpoint
DROP INDEX "uq_lb_user_game_date";--> statement-breakpoint
ALTER TABLE "politeki_sessions" ADD CONSTRAINT "politeki_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinemaxd_sessions" ADD CONSTRAINT "cinemaxd_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_motivex_sessions_user_date" ON "motivex_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_politeki_sessions_user_date" ON "politeki_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_vinymix_sessions_user_date" ON "vinymix_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_cinemaxd_sessions_user_date" ON "cinemaxd_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_lb_game_date" ON "leaderboard_entries" USING btree ("game_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lb_user_game_date" ON "leaderboard_entries" USING btree ("user_id","game_id","date");--> statement-breakpoint
ALTER TABLE "vinymix_artists" DROP COLUMN "most_famous_song";--> statement-breakpoint
DROP TYPE "public"."politiclue_session_status";