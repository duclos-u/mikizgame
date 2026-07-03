#!/usr/bin/env bun
/**
 * Deletes scheduled chainapan puzzles in a date range.
 *
 * Usage:
 *   bun chainapan:delete 2026-08-01          # delete single date
 *   bun chainapan:delete 2026-08-01 2026-08-31
 */

import { and, between, eq } from "drizzle-orm";
import { db } from "../src/db";
import { chainapanDaily } from "../src/db/schema";

const [fromArg, toArg] = process.argv.slice(2);

if (!fromArg) {
  console.error("Usage: bun chainapan:delete <from> [to]");
  process.exit(1);
}

const toDate = toArg ?? fromArg;

const deleted = await db
  .delete(chainapanDaily)
  .where(between(chainapanDaily.date, fromArg, toDate))
  .returning({ date: chainapanDaily.date });

console.log(`Deleted ${deleted.length} puzzle(s) from ${fromArg} to ${toDate}.`);
process.exit(0);
