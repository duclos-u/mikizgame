-- Idempotent rename: runs only if the old politics_* names still exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'politics_status' AND typnamespace = 'public'::regnamespace) THEN
    ALTER TYPE "public"."politics_status" RENAME TO "politiclue_status";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politics_sessions') THEN
    ALTER TABLE "politics_sessions" RENAME TO "politiclue_sessions";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politics_daily') THEN
    ALTER TABLE "politics_daily" RENAME TO "politiclue_daily";
  END IF;
END $$;