-- Ensure the politeki game row exists so leaderboard entries can be written.
INSERT INTO "games" ("slug", "name", "active")
VALUES ('politeki', 'Politeki', true)
ON CONFLICT ("slug") DO NOTHING;