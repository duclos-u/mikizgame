#!/usr/bin/env bun
/**
 * Pins a specific word-ladder puzzle to a given date.
 *
 * Usage:
 *   bun chainapan:set 2026-08-01 CHAT LOUP
 */

import { db } from "../src/db";
import { chainapanDaily } from "../src/db/schema";
import { normalizeWord } from "../src/lib/normalize";
import { isValidWord } from "../src/lib/words";

const [dateArg, startArg, targetArg] = process.argv.slice(2);

if (!dateArg || !startArg || !targetArg) {
  console.error("Usage: bun chainapan:set <YYYY-MM-DD> <startWord> <targetWord>");
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error("Date must be in YYYY-MM-DD format");
  process.exit(1);
}

const startWord = normalizeWord(startArg);
const targetWord = normalizeWord(targetArg);

if (startWord.length !== 4 || targetWord.length !== 4) {
  console.error("Both words must be 4 letters");
  process.exit(1);
}

if (!isValidWord(startWord)) {
  console.error(`"${startWord}" is not a valid French word`);
  process.exit(1);
}

if (!isValidWord(targetWord)) {
  console.error(`"${targetWord}" is not a valid French word`);
  process.exit(1);
}

if (startWord === targetWord) {
  console.error("Start and target words must be different");
  process.exit(1);
}

await db
  .insert(chainapanDaily)
  .values({ date: dateArg, startWord, targetWord })
  .onConflictDoUpdate({
    target: chainapanDaily.date,
    set: { startWord, targetWord },
  });

console.log(`✓ ${dateArg}: ${startWord} → ${targetWord}`);
process.exit(0);
