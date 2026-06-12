-- If both 'sutom' and 'motivex' rows exist, migrate leaderboard entries to the motivex row and delete sutom
UPDATE "leaderboard_entries"
SET "game_id" = (SELECT "id" FROM "games" WHERE "slug" = 'motivex')
WHERE "game_id" = (SELECT "id" FROM "games" WHERE "slug" = 'sutom')
  AND EXISTS (SELECT 1 FROM "games" WHERE "slug" = 'motivex')
  AND EXISTS (SELECT 1 FROM "games" WHERE "slug" = 'sutom');

DELETE FROM "games"
WHERE "slug" = 'sutom'
  AND EXISTS (SELECT 1 FROM "games" WHERE "slug" = 'motivex');

-- If only 'sutom' exists (no separate 'motivex' row), just rename it
UPDATE "games"
SET "slug" = 'motivex', "name" = 'Motivex'
WHERE "slug" = 'sutom'
  AND NOT EXISTS (SELECT 1 FROM "games" WHERE "slug" = 'motivex');
