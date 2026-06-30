-- Migrate politics_* → politeki_* (snapshot 0017 shows tables still named politics_*
-- because migrations 0016 and 0019 checked for politiclue_* which never existed).
-- Also adds performance indexes missing from the snapshot baseline.
-- All operations are idempotent.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'politics_status' AND typnamespace = 'public'::regnamespace) THEN
    ALTER TYPE "public"."politics_status" RENAME TO "politeki_status";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politics_sessions') THEN
    ALTER TABLE "politics_sessions" RENAME TO "politeki_sessions";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politics_daily') THEN
    ALTER TABLE "politics_daily" RENAME TO "politeki_daily";
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'politics_sessions_user_id_users_id_fk') THEN
    ALTER TABLE "politeki_sessions" RENAME CONSTRAINT "politics_sessions_user_id_users_id_fk" TO "politeki_sessions_user_id_users_id_fk";
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_motivex_sessions_user_date" ON "motivex_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_politeki_sessions_user_date" ON "politeki_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vinymix_sessions_user_date" ON "vinymix_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cinemaxd_sessions_user_date" ON "cinemaxd_sessions" USING btree ("user_id","date");--> statement-breakpoint
DROP INDEX IF EXISTS "idx_lb_game_date";--> statement-breakpoint
DROP INDEX IF EXISTS "uq_lb_user_game_date";--> statement-breakpoint
CREATE INDEX "idx_lb_game_date" ON "leaderboard_entries" USING btree ("game_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_lb_user_game_date" ON "leaderboard_entries" USING btree ("user_id","game_id","date");--> statement-breakpoint
ALTER TABLE "vinymix_artists" DROP COLUMN IF EXISTS "most_famous_song";--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vinymix_artists' AND column_name = 'spotify_popularity'
  ) THEN
    ALTER TABLE "vinymix_artists" ADD COLUMN "spotify_popularity" integer NOT NULL DEFAULT 0;
  END IF;
END $$;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."politiclue_session_status";
