-- Streak now tracks actual daily gameplay instead of login, plus longest-streak
-- tracking and milestone badges.

ALTER TABLE "users" RENAME COLUMN "last_login_date" TO "last_played_date";
ALTER TABLE "users" ADD COLUMN "longest_streak_count" integer NOT NULL DEFAULT 0;

CREATE TABLE "user_streak_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "milestone" integer NOT NULL,
  "achieved_at" timestamp DEFAULT now() NOT NULL,
  "shown_at" timestamp
);

ALTER TABLE "user_streak_milestones" ADD CONSTRAINT "user_streak_milestones_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "uq_user_milestone" ON "user_streak_milestones" ("user_id", "milestone");
