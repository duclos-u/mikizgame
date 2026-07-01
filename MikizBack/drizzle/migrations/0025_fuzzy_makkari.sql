CREATE TYPE "public"."footix_status" AS ENUM('in_progress', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "footix_daily" (
	"date" date PRIMARY KEY NOT NULL,
	"footballer_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "footix_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"tentatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "footix_status" DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "footix_sessions" ADD CONSTRAINT "footix_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_footix_sessions_user_date" ON "footix_sessions" USING btree ("user_id","date");