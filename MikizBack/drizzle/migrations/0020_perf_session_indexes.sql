-- Performance: add (user_id, date) composite indexes on all session tables
-- These turn full-table scans into fast index lookups on every session read/write

CREATE INDEX IF NOT EXISTS "idx_motivex_sessions_user_date" ON "motivex_sessions" ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cinemaxd_sessions_user_date" ON "cinemaxd_sessions" ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_vinymix_sessions_user_date" ON "vinymix_sessions" ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_politeki_sessions_user_date" ON "politeki_sessions" ("user_id", "date");
