-- Yearbox: create tables and register the game

CREATE TYPE "public"."yearbox_status" AS ENUM('in_progress', 'won', 'lost');

CREATE TABLE "yearbox_daily" (
  "date" date PRIMARY KEY NOT NULL,
  "puzzle_index" integer NOT NULL
);

CREATE TABLE "yearbox_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "date" date NOT NULL,
  "guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "yearbox_status" DEFAULT 'in_progress' NOT NULL,
  "completed_at" timestamp
);

ALTER TABLE "yearbox_sessions" ADD CONSTRAINT "yearbox_sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "idx_yearbox_sessions_user_date" ON "yearbox_sessions" ("user_id", "date");

INSERT INTO games (slug, name, active)
VALUES ('yearbox', 'Yearbox', true)
ON CONFLICT (slug) DO UPDATE SET name = 'Yearbox', active = true;
