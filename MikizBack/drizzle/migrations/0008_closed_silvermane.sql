ALTER TYPE "public"."spotle_session_status" RENAME TO "vinymix_session_status";--> statement-breakpoint
ALTER TABLE "spotle_artists" RENAME TO "vinymix_artists";--> statement-breakpoint
ALTER TABLE "spotle_daily" RENAME TO "vinymix_daily";--> statement-breakpoint
ALTER TABLE "spotle_sessions" RENAME TO "vinymix_sessions";--> statement-breakpoint
ALTER TABLE "vinymix_sessions" DROP CONSTRAINT "spotle_sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "vinymix_sessions" ADD CONSTRAINT "vinymix_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;