ALTER TABLE "users" ADD COLUMN "last_login_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "streak_count" integer DEFAULT 0 NOT NULL;