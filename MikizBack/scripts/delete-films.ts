#!/usr/bin/env bun
import { and, gte, lte } from "drizzle-orm";
/**
 * Supprime les films planifiés dans une range de dates.
 *
 * Usage:
 *   bun films:delete 2026-07-01 2026-07-31   # supprime juillet
 *   bun films:delete 2026-07-01               # supprime à partir du 1er juillet
 */
import { db } from "../src/db";
import { cinemaxdDaily } from "../src/db/schema";

const [fromArg, toArg] = process.argv.slice(2);

if (!fromArg) {
  console.error("Usage: bun films:delete <date-debut> [date-fin]");
  console.error("  ex: bun films:delete 2026-07-01 2026-07-31");
  process.exit(1);
}

const from = fromArg;
const to = toArg ?? "2099-12-31";

console.log(`\nSuppression des films planifiés du ${from} au ${to}…`);

const deleted = await db
  .delete(cinemaxdDaily)
  .where(and(gte(cinemaxdDaily.date, from), lte(cinemaxdDaily.date, to)))
  .returning();

if (deleted.length === 0) {
  console.log("Aucun film trouvé sur cette période.");
} else {
  console.log(`\n${deleted.length} film(s) supprimé(s) :\n`);
  for (const row of deleted) {
    console.log(`  ${row.date}  tmdbId: ${row.tmdbId}`);
  }
}

process.exit(0);
