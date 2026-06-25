#!/usr/bin/env bun
/**
 * Schedule daily politicians for N days.
 *
 * Selection: weighted by popularityScore, avoiding repeats within ±90 days.
 * 60% drawn from high-popularity pool (score >= 50), 40% from full guessable pool.
 *
 * Usage:
 *   bun politicians:schedule           # 30 days from today
 *   bun politicians:schedule 60        # 60 days from today
 *   bun politicians:schedule 30 2026-08-01  # 30 days from given date
 */
import { and, gte, lte } from "drizzle-orm";
import { db } from "../src/db";
import { politicsDaily } from "../src/db/schema";
import { getGuessablePool } from "../src/lib/politics";

const daysArg = Number.parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

if (isNaN(daysArg) || daysArg < 1) {
  console.error("Usage: bun politicians:schedule [days] [YYYY-MM-DD]");
  process.exit(1);
}

const startDate = startArg ? new Date(startArg) : new Date();
startDate.setHours(0, 0, 0, 0);

// ─── Exclusion window: ±90 days around the scheduling period ─────────────────

const windowStart = new Date(startDate);
windowStart.setDate(windowStart.getDate() - 90);
const windowEnd = new Date(startDate);
windowEnd.setDate(windowEnd.getDate() + daysArg + 89);

const existing = await db
  .select({ politicianIndex: politicsDaily.politicianIndex, date: politicsDaily.date })
  .from(politicsDaily)
  .where(
    and(
      gte(politicsDaily.date, windowStart.toISOString().slice(0, 10)),
      lte(politicsDaily.date, windowEnd.toISOString().slice(0, 10)),
    ),
  );

const excludedIndices = new Set(existing.map((r) => r.politicianIndex));
console.log(`\n${excludedIndices.size} politician(s) excluded (already used within ±90 days)`);

// ─── Build pools ──────────────────────────────────────────────────────────────

const allGuessable = getGuessablePool();
const available = allGuessable.filter((p) => !excludedIndices.has(p.index));

if (available.length === 0) {
  console.error("No available politicians after exclusion. Try a smaller window or clear some entries.");
  process.exit(1);
}

const highPop = available.filter((p) => p.popularityScore >= 50);
const fullPool = available;

console.log(`Pool: ${highPop.length} high-popularity + ${fullPool.length} total available`);

// Weighted random: pick by pool, then weighted by popularityScore within pool
function weightedPick<T extends { popularityScore: number }>(pool: T[]): T {
  const totalWeight = pool.reduce((s, p) => s + (p.popularityScore + 1), 0);
  let rand = Math.random() * totalWeight;
  for (const p of pool) {
    rand -= p.popularityScore + 1;
    if (rand <= 0) return p;
  }
  return pool[pool.length - 1];
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

const used = new Set(excludedIndices);
const entries: { date: string; politicianIndex: number }[] = [];
const names: string[] = [];

const highPopTarget = Math.round(daysArg * 0.6);

for (let i = 0; i < daysArg; i++) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  const dateStr = d.toISOString().slice(0, 10);

  const useHighPop = i < highPopTarget && highPop.filter((p) => !used.has(p.index)).length > 0;
  const pool = useHighPop
    ? highPop.filter((p) => !used.has(p.index))
    : fullPool.filter((p) => !used.has(p.index));

  if (pool.length === 0) {
    console.warn(`  ⚠ No more unique politicians for ${dateStr}, skipping.`);
    continue;
  }

  const pick = weightedPick(pool);
  used.add(pick.index);
  entries.push({ date: dateStr, politicianIndex: pick.index });
  names.push(`${pick.prenom} ${pick.nom}`);
}

if (entries.length === 0) {
  console.error("Nothing to schedule.");
  process.exit(1);
}

const inserted = await db
  .insert(politicsDaily)
  .values(entries)
  .onConflictDoNothing()
  .returning();

console.log(`\nScheduled ${inserted.length} politician(s) (${entries.length - inserted.length} already existed):`);
console.log(`Period: ${entries[0].date} → ${entries.at(-1)!.date}\n`);

for (const row of inserted) {
  const name = names[entries.findIndex((e) => e.date === row.date && e.politicianIndex === row.politicianIndex)];
  console.log(`  ${row.date}  ${name ?? `index:${row.politicianIndex}`}`);
}

process.exit(0);
