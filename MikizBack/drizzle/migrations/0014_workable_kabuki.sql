CREATE TYPE "public"."politics_status" AS ENUM('in_progress', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "politics_daily" (
	"date" date PRIMARY KEY NOT NULL,
	"politician_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "politics_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"tentatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "politics_status" DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "politics_sessions" ADD CONSTRAINT "politics_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;