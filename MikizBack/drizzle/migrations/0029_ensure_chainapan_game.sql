-- Ensure chainapan exists in the games table.
-- Migration 0027 created the chainapan tables but did not seed the games row,
-- so production has no chainapan entry → leaderboard entries are never written
-- and chainapan never appears in any leaderboard query.
INSERT INTO games (slug, name, active)
VALUES ('chainapan', 'Chainapan', true)
ON CONFLICT (slug) DO UPDATE SET name = 'Chainapan', active = true;
