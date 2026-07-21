import { sql } from "drizzle-orm";
import { leaderboardEntries } from "../db/schema";

/**
 * F1-style points barème shared by leaderboard and profile routes.
 * Attempts 1→25, 2→18, 3→15, 4→12, 5→10, 6→8, 7→6, 8→5, 9→4, 10→3, loss/other→0.
 */
export const RANK_POINTS = [25, 18, 15, 12, 10, 8, 6, 5, 4, 3];

export const pointsExpr = sql`CASE ${leaderboardEntries.score} WHEN 1 THEN 25 WHEN 2 THEN 18 WHEN 3 THEN 15 WHEN 4 THEN 12 WHEN 5 THEN 10 WHEN 6 THEN 8 WHEN 7 THEN 6 WHEN 8 THEN 5 WHEN 9 THEN 4 WHEN 10 THEN 3 ELSE 0 END`;
