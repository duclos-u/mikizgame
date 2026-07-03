#!/usr/bin/env bun
/**
 * Set (or overwrite) the footballer for a specific date.
 * Accepts a footballer index or a name search string.
 *
 * Usage:
 *   bun footballers:set 2026-07-01 0         # by index
 *   bun footballers:set 2026-07-01 "mbappe"  # by name (picks first match)
 *   bun footballers:set today 0              # shorthand for today
 */
import { db } from "../src/db";
import { footixDaily } from "../src/db/schema";
import { getFootballer, searchFootballers } from "../src/lib/footix";

const [dateArg, queryArg] = process.argv.slice(2);

if (!dateArg || !queryArg) {
  console.error("Usage: bun footballers:set <YYYY-MM-DD|today> <index|name>");
  console.error('  ex: bun footballers:set 2026-07-01 "mbappe"');
  console.error("  ex: bun footballers:set today 0");
  process.exit(1);
}

const dateStr = dateArg.toLowerCase() === "today" ? new Date().toISOString().slice(0, 10) : dateArg;

let footballerIndex: number;
let footballerName: string;

const asIndex = Number.parseInt(queryArg, 10);
if (!isNaN(asIndex)) {
  const f = getFootballer(asIndex);
  if (!f) {
    console.error(`No footballer at index ${asIndex}`);
    process.exit(1);
  }
  footballerIndex = asIndex;
  footballerName = `${f.prenom} ${f.nom}`;
} else {
  const results = searchFootballers(queryArg);
  if (results.length === 0) {
    console.error(`No footballer found matching "${queryArg}"`);
    process.exit(1);
  }
  if (results.length > 1) {
    console.log(`Multiple matches for "${queryArg}":`);
    for (const r of results.slice(0, 10)) {
      console.log(`  [${r.index}] ${r.prenom} ${r.nom}  (${r.club}, ${r.nationalite})`);
    }
    console.log(
      `\nUsing first match: [${results[0].index}] ${results[0].prenom} ${results[0].nom}`,
    );
    console.log("Use an index to be explicit: bun footballers:set <date> <index>");
  }
  footballerIndex = results[0].index;
  footballerName = `${results[0].prenom} ${results[0].nom}`;
}

await db
  .insert(footixDaily)
  .values({ date: dateStr, footballerIndex })
  .onConflictDoUpdate({ target: footixDaily.date, set: { footballerIndex } });

console.log(`\nFootballer for ${dateStr}: [${footballerIndex}] ${footballerName}`);
process.exit(0);
