-- Rename existing cineclue row to cinemaxd (handles the rename case)
UPDATE "games"
SET "slug" = 'cinemaxd', "name" = 'CineMaxD'
WHERE "slug" = 'cineclue';

-- Insert cinemaxd row if it still doesn't exist (handles the missing row case)
INSERT INTO "games" ("slug", "name", "active")
VALUES ('cinemaxd', 'CineMaxD', true)
ON CONFLICT ("slug") DO NOTHING;
