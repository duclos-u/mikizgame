#!/usr/bin/env bun
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { games } from "../src/db/schema";

const existing = await db.query.games.findFirst({ where: eq(games.slug, "mikizpolitics") });
if (existing) {
  console.log("Game already exists:", existing.slug);
} else {
  const result = await db.insert(games).values({ slug: "mikizpolitics", name: "Mikiz Politics" }).returning();
  console.log("Inserted:", result[0]);
}

process.exit(0);
