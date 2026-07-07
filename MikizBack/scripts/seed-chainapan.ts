#!/usr/bin/env bun
/**
 * Seeds chainapan_daily with BFS-generated word-ladder puzzles.
 * Uses the exact same word set as the backend validation layer (fr-daily-words.txt +
 * fr-valid-words.txt, normalized and filtered to 4 letters). Stores the BFS-shortest
 * solution path in the `solution` column, proving each puzzle is solvable within 8 steps.
 *
 * Usage:
 *   bun chainapan:seed           # 30 puzzles from today
 *   bun chainapan:seed 60        # 60 puzzles from today
 *   bun chainapan:seed 30 2026-08-01
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db";
import { chainapanDaily } from "../src/db/schema";
import { normalizeWord } from "../src/lib/normalize";

const MAX_STEPS = 8;

const [daysArg, startArg] = process.argv.slice(2);
const days = Math.max(1, Number(daysArg ?? 30));
const startDate = startArg ?? new Date().toISOString().slice(0, 10);

if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
  console.error("Start date must be in YYYY-MM-DD format");
  process.exit(1);
}

const wordsDir = join(import.meta.dir, "../words");

// Mirror words.ts parse() exactly so the BFS graph matches validation
function parse(content: string): string[] {
  return content
    .split("\n")
    .map((line) => normalizeWord(line.trim()))
    .filter((w) => w.length >= 4 && w.length <= 9);
}

const dailyList = parse(readFileSync(join(wordsDir, "fr-daily-words.txt"), "utf-8")).filter(
  (w) => w.length === 4,
);
const validSet = new Set([
  ...parse(readFileSync(join(wordsDir, "fr-valid-words.txt"), "utf-8")),
  ...dailyList,
]);
const words4 = [...validSet].filter((w) => w.length === 4);
const dailySet = new Set(dailyList);

console.log(`Loaded ${words4.length} valid 4-letter words, ${dailyList.length} daily candidates.`);

/**
 * BFS from start, returns the shortest path to a reachable target in [minSteps, maxSteps]
 * whose target word is in the daily word pool (good puzzle words, not obscure intermediates).
 * Returns the full path including startWord, or null if none found.
 */
function bfsPath(start: string, minSteps: number, maxSteps: number): string[] | null {
  const prev = new Map<string, string | null>([[start, null]]);
  const dist = new Map<string, number>([[start, 0]]);
  const queue: string[] = [start];
  const candidates: string[] = [];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === undefined) break;
    const d = dist.get(cur) ?? 0;
    if (d >= maxSteps) continue;

    for (const w of words4) {
      if (prev.has(w)) continue;
      let diff = 0;
      for (let i = 0; i < cur.length; i++) {
        if (cur[i] !== w[i]) diff++;
      }
      if (diff !== 1) continue;
      prev.set(w, cur);
      const newDist = d + 1;
      dist.set(w, newDist);
      if (newDist >= minSteps && newDist <= maxSteps && dailySet.has(w)) {
        candidates.push(w);
      }
      queue.push(w);
    }
  }

  if (candidates.length === 0) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];

  // Reconstruct path
  const path: string[] = [];
  let cur: string | null = target;
  while (cur !== null) {
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  return path.reverse();
}

function dateAddDays(base: string, n: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Find dates that already have a solution stored
const existingDates = new Set(
  (await db.select({ date: chainapanDaily.date }).from(chainapanDaily)).map((r) => r.date),
);

const shuffled = [...dailyList].sort(() => Math.random() - 0.5);
let puzzlesSeeded = 0;
let offset = 0;
let wordIdx = 0;

while (puzzlesSeeded < days) {
  const date = dateAddDays(startDate, offset);
  offset++;

  if (existingDates.has(date)) {
    console.log(`  skip ${date} (already has a puzzle)`);
    continue;
  }

  if (wordIdx >= shuffled.length) {
    console.error("Ran out of daily words to try as start words.");
    break;
  }

  const startWord = shuffled[wordIdx++];
  const path = bfsPath(startWord, 3, MAX_STEPS - 1);

  if (!path) {
    console.log(`  skip ${startWord} — no solvable target in 3–${MAX_STEPS - 1} steps`);
    continue;
  }

  const targetWord = path[path.length - 1];
  await db
    .insert(chainapanDaily)
    .values({ date, startWord, targetWord, solution: path })
    .onConflictDoNothing();

  console.log(
    `  ${date}: ${startWord} → ${targetWord} (${path.length - 1} steps) — ${path.join(" → ")}`,
  );
  existingDates.add(date);
  puzzlesSeeded++;
}

console.log(`\nDone. Seeded ${puzzlesSeeded} puzzle(s) starting from ${startDate}.`);
process.exit(0);
