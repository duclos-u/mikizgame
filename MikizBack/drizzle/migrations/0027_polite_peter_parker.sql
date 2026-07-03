CREATE TYPE "public"."chainapan_session_status" AS ENUM('in_progress', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "chainapan_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_word" text NOT NULL,
	"target_word" text NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "chainapan_daily_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "chainapan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_id" uuid NOT NULL,
	"date" date NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "chainapan_session_status" DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "chainapan_sessions" ADD CONSTRAINT "chainapan_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chainapan_sessions" ADD CONSTRAINT "chainapan_sessions_daily_id_chainapan_daily_id_fk" FOREIGN KEY ("daily_id") REFERENCES "public"."chainapan_daily"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chainapan_sessions_user_date" ON "chainapan_sessions" USING btree ("user_id","date");