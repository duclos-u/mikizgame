-- Idempotent rename: runs only if the old cineclue names still exist.
-- Needed because migration 0013 may have been recorded as applied in
-- __drizzle_migrations without the SQL actually executing in production.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cineclue_session_status' AND typnamespace = 'public'::regnamespace) THEN
    ALTER TYPE "public"."cineclue_session_status" RENAME TO "cinemaxd_session_status";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cineclue_sessions') THEN
    ALTER TABLE "cineclue_sessions" RENAME TO "cinemaxd_sessions";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cineclue_daily') THEN
    ALTER TABLE "cineclue_daily" RENAME TO "cinemaxd_daily";
  END IF;
END $$;