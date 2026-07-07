#!/usr/bin/env bun
/**
 * Set (or overwrite) the Yearbox puzzle for a specific date.
 * Accepts a puzzle index or a year to search by.
 *
 * Usage:
 *   bun yearbox:set today 0       # by index
 *   bun yearbox:set today 1994    # by year (picks first matching puzzle)
 *   bun yearbox:set 2026-08-01 7  # specific date + index
 */
import { db } from "../src/db";
import { yearboxDaily } from "../src/db/schema";
import { getPuzzle, getPuzzleCount } from "../src/lib/yearbox";

const [dateArg, queryArg] = process.argv.slice(2);

if (!dateArg || !queryArg) {
  console.error("Usage: bun yearbox:set <YYYY-MM-DD|today> <index|year>");
  console.error("  ex: bun yearbox:set today 1994");
  console.error("  ex: bun yearbox:set 2026-08-01 7");
  process.exit(1);
}

const dateStr =
  dateArg.toLowerCase() === "today" ? new Date().toISOString().slice(0, 10) : dateArg;

const query = Number.parseInt(queryArg, 10);
if (isNaN(query)) {
  console.error("Second argument must be a puzzle index (number) or a year (number).");
  process.exit(1);
}

const total = getPuzzleCount();

let puzzleIndex: number;

// If the value looks like an index (< total), treat it as index; otherwise search by year
if (query < total && query >= 0) {
  const p = getPuzzle(query);
  if (!p) {
    console.error(`No puzzle at index ${query}`);
    process.exit(1);
  }
  puzzleIndex = query;
  console.log(`Using index ${query}: year ${p.year}`);
} else {
  // Search by year
  const matches: number[] = [];
  for (let i = 0; i < total; i++) {
    if (getPuzzle(i)?.year === query) matches.push(i);
  }
  if (matches.length === 0) {
    console.error(`No puzzle found for year ${query}`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.log(`Multiple puzzles for year ${query}:`);
    for (const idx of matches) {
      const p = getPuzzle(idx)!;
      console.log(`  [${idx}] ${p.facts[0].text.slice(0, 60)}…`);
    }
    console.log(`\nUsing first match: [${matches[0]}]`);
    console.log("Use an index to be explicit: bun yearbox:set <date> <index>");
  }
  puzzleIndex = matches[0];
}

const puzzle = getPuzzle(puzzleIndex)!;

await db
  .insert(yearboxDaily)
  .values({ date: dateStr, puzzleIndex })
  .onConflictDoUpdate({ target: yearboxDaily.date, set: { puzzleIndex } });

console.log(`\nYearbox for ${dateStr}: [${puzzleIndex}] ${puzzle.year}`);
process.exit(0);
