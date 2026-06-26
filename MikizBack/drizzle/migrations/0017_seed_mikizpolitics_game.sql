-- Ensure the mikizpolitics game row exists so leaderboard entries can be written.
INSERT INTO "games" ("slug", "name", "active")
VALUES ('mikizpolitics', 'PolitiClue', true)
ON CONFLICT ("slug") DO NOTHING;