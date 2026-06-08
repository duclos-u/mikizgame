#!/usr/bin/env bun
/**
 * Overwrite (or insert) the word for a specific date.
 *
 * Usage:
 *   bun words:set 2026-06-08 MOTEUR
 */
import { db } from "../src/db";
import { sutomDailyWords } from "../src/db/schema";
import { eq } from "drizzle-orm";

const [dateArg, wordArg] = process.argv.slice(2);

if (!dateArg || !wordArg) {
  console.error("Usage: bun words:set <YYYY-MM-DD> <WORD>");
  process.exit(1);
}

const word = wordArg.toUpperCase();

await db
  .insert(sutomDailyWords)
  .values({ word, date: dateArg })
  .onConflictDoUpdate({ target: sutomDailyWords.date, set: { word } });

console.log(`Set word for ${dateArg}: ${word}`);
process.exit(0);
