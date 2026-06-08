CREATE TYPE "public"."cineclue_session_status" AS ENUM('in_progress', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "cineclue_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"tentatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"indices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "cineclue_session_status" DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "cineclue_sessions" ADD CONSTRAINT "cineclue_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;