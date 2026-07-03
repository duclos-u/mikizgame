#!/usr/bin/env bun
/**
 * Schedule daily footballers for N days.
 *
 * Selection: weighted by popularityScore, avoiding repeats within ±90 days.
 * 60% drawn from high-popularity pool (score >= 85), 40% from full pool.
 *
 * Usage:
 *   bun footballers:schedule           # 30 days from today
 *   bun footballers:schedule 60        # 60 days from today
 *   bun footballers:schedule 30 2026-08-01  # 30 days from given date
 */
import { and, gte, lte } from "drizzle-orm";
import { db } from "../src/db";
import { footixDaily } from "../src/db/schema";
import { getAllFootballers } from "../src/lib/footix";

const daysArg = Number.parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

if (isNaN(daysArg) || daysArg < 1) {
  console.error("Usage: bun footballers:schedule [days] [YYYY-MM-DD]");
  process.exit(1);
}

const startDate = startArg ? new Date(startArg) : new Date();
startDate.setHours(0, 0, 0, 0);

const windowStart = new Date(startDate);
windowStart.setDate(windowStart.getDate() - 90);
const windowEnd = new Date(startDate);
windowEnd.setDate(windowEnd.getDate() + daysArg + 89);

const existing = await db
  .select({ footballerIndex: footixDaily.footballerIndex, date: footixDaily.date })
  .from(footixDaily)
  .where(
    and(
      gte(footixDaily.date, windowStart.toISOString().slice(0, 10)),
      lte(footixDaily.date, windowEnd.toISOString().slice(0, 10)),
    ),
  );

const excludedIndices = new Set(existing.map((r) => r.footballerIndex));
console.log(`\n${excludedIndices.size} footballer(s) excluded (already used within ±90 days)`);

const allFootballers = getAllFootballers();
const available = allFootballers.filter((f) => !excludedIndices.has(f.index));

if (available.length === 0) {
  console.error(
    "No available footballers after exclusion. Try a smaller window or clear some entries.",
  );
  process.exit(1);
}

const highPop = available.filter((f) => f.popularityScore >= 85);
const fullPool = available;

console.log(`Pool: ${highPop.length} high-popularity + ${fullPool.length} total available`);

function weightedPick<T extends { popularityScore: number }>(pool: T[]): T {
  const totalWeight = pool.reduce((s, f) => s + (f.popularityScore + 1), 0);
  let rand = Math.random() * totalWeight;
  for (const f of pool) {
    rand -= f.popularityScore + 1;
    if (rand <= 0) return f;
  }
  return pool[pool.length - 1];
}

const used = new Set(excludedIndices);
const entries: { date: string; footballerIndex: number }[] = [];
const names: string[] = [];

const highPopTarget = Math.round(daysArg * 0.6);

for (let i = 0; i < daysArg; i++) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  const dateStr = d.toISOString().slice(0, 10);

  const useHighPop = i < highPopTarget && highPop.filter((f) => !used.has(f.index)).length > 0;
  const pool = useHighPop
    ? highPop.filter((f) => !used.has(f.index))
    : fullPool.filter((f) => !used.has(f.index));

  if (pool.length === 0) {
    console.warn(`  ⚠ No more unique footballers for ${dateStr}, skipping.`);
    continue;
  }

  const pick = weightedPick(pool);
  used.add(pick.index);
  entries.push({ date: dateStr, footballerIndex: pick.index });
  names.push(`${pick.prenom} ${pick.nom}`);
}

if (entries.length === 0) {
  console.error("Nothing to schedule.");
  process.exit(1);
}

const inserted = await db.insert(footixDaily).values(entries).onConflictDoNothing().returning();

console.log(
  `\nScheduled ${inserted.length} footballer(s) (${entries.length - inserted.length} already existed):`,
);
console.log(`Period: ${entries[0].date} → ${entries.at(-1)!.date}\n`);

for (const row of inserted) {
  const name =
    names[
      entries.findIndex((e) => e.date === row.date && e.footballerIndex === row.footballerIndex)
    ];
  console.log(`  ${row.date}  ${name ?? `index:${row.footballerIndex}`}`);
}

process.exit(0);
