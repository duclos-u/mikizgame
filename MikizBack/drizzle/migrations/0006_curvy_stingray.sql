CREATE TYPE "public"."spotle_session_status" AS ENUM('in_progress', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "spotle_artists" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"creation_year" integer,
	"member_count" integer DEFAULT 1 NOT NULL,
	"spotify_followers" integer DEFAULT 0 NOT NULL,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"country" text,
	"vocal_type" text,
	"primary_language" text,
	"most_famous_song" jsonb,
	"instrumentation" text,
	"appears_on_soundtracks_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spotle_daily" (
	"date" date PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotle_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"guesses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "spotle_session_status" DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "spotle_sessions" ADD CONSTRAINT "spotle_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;