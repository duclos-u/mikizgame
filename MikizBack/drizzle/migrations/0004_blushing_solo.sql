ALTER TYPE "public"."sutom_session_status" RENAME TO "motivex_session_status";--> statement-breakpoint
ALTER TABLE "sutom_daily_words" RENAME TO "motivex_daily_words";--> statement-breakpoint
ALTER TABLE "sutom_sessions" RENAME TO "motivex_sessions";--> statement-breakpoint
ALTER TABLE "motivex_daily_words" DROP CONSTRAINT "sutom_daily_words_date_unique";--> statement-breakpoint
ALTER TABLE "motivex_sessions" DROP CONSTRAINT "sutom_sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "motivex_sessions" DROP CONSTRAINT "sutom_sessions_word_id_sutom_daily_words_id_fk";
--> statement-breakpoint
ALTER TABLE "motivex_sessions" ADD CONSTRAINT "motivex_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motivex_sessions" ADD CONSTRAINT "motivex_sessions_word_id_motivex_daily_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."motivex_daily_words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "motivex_daily_words" ADD CONSTRAINT "motivex_daily_words_date_unique" UNIQUE("date");