-- Rename DB objects: politiclue → politeki, slug: mikizpolitics → politeki

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'politiclue_status' AND typnamespace = 'public'::regnamespace) THEN
    ALTER TYPE "public"."politiclue_status" RENAME TO "politeki_status";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politiclue_sessions') THEN
    ALTER TABLE "politiclue_sessions" RENAME TO "politeki_sessions";
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politiclue_daily') THEN
    ALTER TABLE "politiclue_daily" RENAME TO "politeki_daily";
  END IF;
END $$;
--> statement-breakpoint
UPDATE "games" SET slug = 'politeki', name = 'Politeki' WHERE slug = 'mikizpolitics';
