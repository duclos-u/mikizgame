#!/usr/bin/env bun
/**
 * Seeds the database with initial game definitions and a test word for today.
 * Run: bun run db:seed
 */
import { db } from "../src/db";
import { games, motivexDailyWords } from "../src/db/schema";

await db
  .insert(games)
  .values([
    { slug: "motivex", name: "Motivex" },
    { slug: "cinemaxd", name: "Cinemaxd" },
    { slug: "politeki", name: "Politeki" },
    { slug: "footix", name: "Footix" },
    { slug: "chainapan", name: "Chainapan" },
  ])
  .onConflictDoNothing();

const today = new Date().toISOString().slice(0, 10);

await db.insert(motivexDailyWords).values({ word: "MONDE", date: today }).onConflictDoNothing();

console.log(`Seeded: game 'motivex' + today's word MONDE (${today})`);
console.log("Run `bun words:schedule` to bulk-schedule words for upcoming days.");
process.exit(0);
