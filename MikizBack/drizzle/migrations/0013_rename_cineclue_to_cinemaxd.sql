ALTER TYPE "public"."cineclue_session_status" RENAME TO "cinemaxd_session_status";--> statement-breakpoint
ALTER TABLE "cineclue_sessions" RENAME TO "cinemaxd_sessions";--> statement-breakpoint
ALTER TABLE "cineclue_daily" RENAME TO "cinemaxd_daily";
