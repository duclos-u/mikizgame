-- Production recovery: ensure politeki tables exist.
-- Prior rename migrations (0016, 0019, 0023) are idempotent but apparently
-- did not create the tables on this production DB. All statements are safe to
-- re-run even if the tables already exist.

-- 1. Ensure the enum type exists.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'politeki_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "public"."politeki_status" AS ENUM('in_progress', 'won', 'lost');
  END IF;
END $$;
--> statement-breakpoint

-- 2. If the table was never renamed from the original politics_daily, rename it now.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politics_daily')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'politeki_daily') THEN
    ALTER TABLE "politics_daily" RENAME TO "politeki_daily";
  END IF;
END $$;
--> statement-breakpoint

-- 3. Create politeki_daily if it still doesn't exist.
CREATE TABLE IF NOT EXISTS "politeki_daily" (
  "date" date PRIMARY KEY NOT NULL,
  "politician_index" integer NOT NULL
);
--> statement-breakpoint

-- 4. Ensure sessions table exists.
CREATE TABLE IF NOT EXISTS "politeki_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "date" date NOT NULL,
  "tentatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "politeki_status" DEFAULT 'in_progress' NOT NULL,
  "completed_at" timestamp
);
--> statement-breakpoint

-- 5. Add FK constraint if missing.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'politeki_sessions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "politeki_sessions"
      ADD CONSTRAINT "politeki_sessions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint

-- 6. Index (IF NOT EXISTS is safe).
CREATE INDEX IF NOT EXISTS "idx_politeki_sessions_user_date" ON "politeki_sessions" USING btree ("user_id","date");
