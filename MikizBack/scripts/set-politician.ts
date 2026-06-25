#!/usr/bin/env bun
/**
 * Set (or overwrite) the politician for a specific date.
 * Accepts a politician index or a name search string.
 *
 * Usage:
 *   bun politicians:set 2026-07-01 120          # by index
 *   bun politicians:set 2026-07-01 "macron"     # by name (picks first match)
 *   bun politicians:set today 120               # shorthand for today
 */
import { db } from "../src/db";
import { politicsDaily } from "../src/db/schema";
import { getPolitician, searchPoliticians } from "../src/lib/politics";

const [dateArg, queryArg] = process.argv.slice(2);

if (!dateArg || !queryArg) {
  console.error("Usage: bun politicians:set <YYYY-MM-DD|today> <index|name>");
  console.error('  ex: bun politicians:set 2026-07-01 "macron"');
  console.error("  ex: bun politicians:set today 42");
  process.exit(1);
}

const dateStr =
  dateArg.toLowerCase() === "today"
    ? new Date().toISOString().slice(0, 10)
    : dateArg;

// Resolve politician: try numeric index first, then name search
let politicianIndex: number;
let politicianName: string;

const asIndex = Number.parseInt(queryArg, 10);
if (!isNaN(asIndex)) {
  const p = getPolitician(asIndex);
  if (!p) {
    console.error(`No politician at index ${asIndex}`);
    process.exit(1);
  }
  politicianIndex = asIndex;
  politicianName = `${p.prenom} ${p.nom}`;
} else {
  const results = searchPoliticians(queryArg);
  if (results.length === 0) {
    console.error(`No politician found matching "${queryArg}"`);
    process.exit(1);
  }
  if (results.length > 1) {
    console.log(`Multiple matches for "${queryArg}":`);
    for (const r of results.slice(0, 10)) {
      console.log(`  [${r.index}] ${r.prenom} ${r.nom}  (${r.currentOrLastParti ?? "?"})`);
    }
    console.log(`\nUsing first match: [${results[0].index}] ${results[0].prenom} ${results[0].nom}`);
    console.log('Use an index to be explicit: bun politicians:set <date> <index>');
  }
  politicianIndex = results[0].index;
  politicianName = `${results[0].prenom} ${results[0].nom}`;
}

await db
  .insert(politicsDaily)
  .values({ date: dateStr, politicianIndex })
  .onConflictDoUpdate({ target: politicsDaily.date, set: { politicianIndex } });

console.log(`\nPolitician for ${dateStr}: [${politicianIndex}] ${politicianName}`);
process.exit(0);
