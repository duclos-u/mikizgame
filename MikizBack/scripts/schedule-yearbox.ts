#!/usr/bin/env bun
/**
 * Schedule daily Yearbox puzzles for N days.
 *
 * Selection: random, avoiding repeats within ±60 days.
 *
 * Usage:
 *   bun yearbox:schedule           # 30 days from today
 *   bun yearbox:schedule 60        # 60 days from today
 *   bun yearbox:schedule 30 2026-08-01  # 30 days from given date
 */
import { and, gte, lte } from "drizzle-orm";
import { db } from "../src/db";
import { yearboxDaily } from "../src/db/schema";
import { getPuzzle, getPuzzleCount } from "../src/lib/yearbox";

const daysArg = Number.parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

if (isNaN(daysArg) || daysArg < 1) {
  console.error("Usage: bun yearbox:schedule [days] [YYYY-MM-DD]");
  process.exit(1);
}

const startDate = startArg ? new Date(startArg) : new Date();
startDate.setHours(0, 0, 0, 0);

const windowStart = new Date(startDate);
windowStart.setDate(windowStart.getDate() - 60);
const windowEnd = new Date(startDate);
windowEnd.setDate(windowEnd.getDate() + daysArg + 59);

const existing = await db
  .select({ puzzleIndex: yearboxDaily.puzzleIndex, date: yearboxDaily.date })
  .from(yearboxDaily)
  .where(
    and(
      gte(yearboxDaily.date, windowStart.toISOString().slice(0, 10)),
      lte(yearboxDaily.date, windowEnd.toISOString().slice(0, 10)),
    ),
  );

const excludedIndices = new Set(existing.map((r) => r.puzzleIndex));
console.log(`\n${excludedIndices.size} puzzle(s) excluded (already used within ±60 days)`);

const total = getPuzzleCount();
const available = Array.from({ length: total }, (_, i) => i).filter(
  (i) => !excludedIndices.has(i),
);

if (available.length === 0) {
  console.error("No available puzzles after exclusion. Try a smaller window or clear some entries.");
  process.exit(1);
}

console.log(`Pool: ${available.length} / ${total} puzzles available`);

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pool = shuffle(available);
const used = new Set(excludedIndices);
const entries: { date: string; puzzleIndex: number }[] = [];

for (let i = 0; i < daysArg; i++) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  const dateStr = d.toISOString().slice(0, 10);

  const remaining = pool.filter((idx) => !used.has(idx));
  if (remaining.length === 0) {
    console.warn(`  ⚠ No more unique puzzles for ${dateStr}, skipping.`);
    continue;
  }

  const pick = remaining[0];
  used.add(pick);
  pool.splice(pool.indexOf(pick), 1);
  entries.push({ date: dateStr, puzzleIndex: pick });
}

if (entries.length === 0) {
  console.error("Nothing to schedule.");
  process.exit(1);
}

const inserted = await db.insert(yearboxDaily).values(entries).onConflictDoNothing().returning();

console.log(
  `\nScheduled ${inserted.length} puzzle(s) (${entries.length - inserted.length} already existed):`,
);
console.log(`Period: ${entries[0].date} → ${entries.at(-1)!.date}\n`);

for (const row of inserted) {
  const puzzle = getPuzzle(row.puzzleIndex);
  console.log(`  ${row.date}  [${row.puzzleIndex}] ${puzzle?.year ?? '?'}`);
}

process.exit(0);
