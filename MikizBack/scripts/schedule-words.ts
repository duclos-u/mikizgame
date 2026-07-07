#!/usr/bin/env bun
/**
 * Reads words/fr-daily-words.txt and assigns one word per day starting from today.
 * Skips dates that already have a word. Safe to run multiple times.
 *
 * Usage:
 *   bun words:schedule           # schedule 30 days
 *   bun words:schedule 90        # schedule 90 days
 *   bun words:schedule 30 2026-06-01  # start from a specific date
 */
import { db } from "../src/db";
import { motivexDailyWords } from "../src/db/schema";
import { getDailyWordList } from "../src/lib/words";

const daysArg = Number.parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

const words = getDailyWordList().filter((w) => w.length >= 5);
if (words.length === 0) {
  console.error("Word list is empty — check words/fr-daily-words.txt");
  process.exit(1);
}

const startDate = startArg ? new Date(startArg) : new Date();

const shuffled = [...words];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}

const entries: { word: string; date: string }[] = [];
for (let i = 0; i < Math.min(daysArg, shuffled.length); i++) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  entries.push({ word: shuffled[i % shuffled.length], date: d.toISOString().slice(0, 10) });
}

const result = await db.insert(motivexDailyWords).values(entries).onConflictDoNothing().returning();

console.log(
  `Scheduled ${result.length} new words (${entries.length - result.length} already existed).`,
);
console.log(`Range: ${entries[0]?.date} → ${entries.at(-1)?.date}`);
process.exit(0);
