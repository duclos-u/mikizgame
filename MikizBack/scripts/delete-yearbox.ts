#!/usr/bin/env bun
/**
 * Deletes scheduled Yearbox puzzles in a date range.
 *
 * Usage:
 *   bun yearbox:delete 2026-08-01          # delete single date
 *   bun yearbox:delete 2026-08-01 2026-08-31
 */
import { between } from "drizzle-orm";
import { db } from "../src/db";
import { yearboxDaily } from "../src/db/schema";

const [fromArg, toArg] = process.argv.slice(2);

if (!fromArg) {
  console.error("Usage: bun yearbox:delete <from> [to]");
  process.exit(1);
}

const toDate = toArg ?? fromArg;

const deleted = await db
  .delete(yearboxDaily)
  .where(between(yearboxDaily.date, fromArg, toDate))
  .returning({ date: yearboxDaily.date });

console.log(`Deleted ${deleted.length} puzzle(s) from ${fromArg} to ${toDate}.`);
process.exit(0);
