-- Prevent duplicate chainapan sessions for the same user/day and enable
-- onConflictDoNothing() as a real concurrency guard (was only a non-unique index).
DROP INDEX IF EXISTS "idx_chainapan_sessions_user_date";
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chainapan_sessions_user_date" ON "chainapan_sessions" ("user_id", "date");
