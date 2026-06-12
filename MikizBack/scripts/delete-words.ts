#!/usr/bin/env bun
/**
 * Supprime les mots planifiés dans une range de dates.
 *
 * Usage:
 *   bun words:delete 2026-07-01 2026-07-31   # supprime juillet
 *   bun words:delete 2026-07-01               # supprime à partir du 1er juillet
 */
import { db } from "../src/db";
import { motivexDailyWords } from "../src/db/schema";
import { and, gte, lte } from "drizzle-orm";

const [fromArg, toArg] = process.argv.slice(2);

if (!fromArg) {
  console.error("Usage: bun words:delete <date-debut> [date-fin]");
  console.error("  ex: bun words:delete 2026-07-01 2026-07-31");
  process.exit(1);
}

const from = fromArg;
const to = toArg ?? "2099-12-31";

console.log(`\nSuppression des mots planifiés du ${from} au ${to}…`);

const deleted = await db
  .delete(motivexDailyWords)
  .where(and(gte(motivexDailyWords.date, from), lte(motivexDailyWords.date, to)))
  .returning();

if (deleted.length === 0) {
  console.log("Aucun mot trouvé sur cette période.");
} else {
  console.log(`\n${deleted.length} mot(s) supprimé(s) :\n`);
  for (const row of deleted) {
    console.log(`  ${row.date}  mot: ${row.word}`);
  }
}

process.exit(0);
