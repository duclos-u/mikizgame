#!/usr/bin/env bun
/**
 * Delete scheduled politicians in a date range.
 *
 * Usage:
 *   bun politicians:delete 2026-08-01 2026-08-31   # delete August
 *   bun politicians:delete 2026-08-01               # delete from date onwards
 */
import { and, gte, lte } from "drizzle-orm";
import { db } from "../src/db";
import { politicsDaily } from "../src/db/schema";
import { getPolitician } from "../src/lib/politics";

const [fromArg, toArg] = process.argv.slice(2);

if (!fromArg) {
  console.error("Usage: bun politicians:delete <from-date> [to-date]");
  console.error("  ex: bun politicians:delete 2026-08-01 2026-08-31");
  process.exit(1);
}

const from = fromArg;
const to = toArg ?? "2099-12-31";

console.log(`\nDeleting politicians scheduled from ${from} to ${to}…`);

const deleted = await db
  .delete(politicsDaily)
  .where(and(gte(politicsDaily.date, from), lte(politicsDaily.date, to)))
  .returning();

if (deleted.length === 0) {
  console.log("Nothing found in that date range.");
} else {
  console.log(`\n${deleted.length} entry/entries deleted:\n`);
  for (const row of deleted) {
    const p = getPolitician(row.politicianIndex);
    const name = p ? `${p.prenom} ${p.nom}` : `index:${row.politicianIndex}`;
    console.log(`  ${row.date}  ${name}`);
  }
}

process.exit(0);
