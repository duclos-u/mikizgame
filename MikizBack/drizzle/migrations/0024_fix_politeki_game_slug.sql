-- Fix: production games table may still have slug='mikizpolitics' because the UPDATE
-- in migration 0019 was a no-op (no row existed under that slug at the time), and
-- migration 0017 inserted 'politeki' separately — leaving both rows or the wrong one.
--
-- This migration consolidates everything under slug='politeki':
-- 1. If both 'mikizpolitics' and 'politeki' rows exist, move all leaderboard entries
--    to the 'mikizpolitics' game (which holds historical scores) then rename it to 'politeki'.
-- 2. If only 'mikizpolitics' exists, rename it to 'politeki'.
-- 3. If only 'politeki' exists (already correct), do nothing.
-- 4. If neither exists, insert 'politeki'.
-- All cases are idempotent.

DO $$
DECLARE
  miki_id uuid;
  poli_id uuid;
BEGIN
  SELECT id INTO miki_id FROM games WHERE slug = 'mikizpolitics';
  SELECT id INTO poli_id FROM games WHERE slug = 'politeki';

  IF miki_id IS NOT NULL AND poli_id IS NOT NULL THEN
    -- Both rows exist: consolidate entries onto the older 'mikizpolitics' row, then rename it.
    UPDATE leaderboard_entries SET game_id = miki_id WHERE game_id = poli_id;
    DELETE FROM games WHERE id = poli_id;
    UPDATE games SET slug = 'politeki', name = 'Politeki', active = true WHERE id = miki_id;
  ELSIF miki_id IS NOT NULL THEN
    -- Only 'mikizpolitics' exists: rename it.
    UPDATE games SET slug = 'politeki', name = 'Politeki', active = true WHERE id = miki_id;
  END IF;
  -- If only 'politeki' exists, nothing to do.
END $$;
--> statement-breakpoint
-- Ensure the row exists in all cases.
INSERT INTO games (slug, name, active) VALUES ('politeki', 'Politeki', true)
ON CONFLICT (slug) DO UPDATE SET name = 'Politeki', active = true;
