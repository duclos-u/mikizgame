#!/usr/bin/env bun
/**
 * Supprime les artistes planifiés dans une plage de dates.
 *
 * Usage:
 *   bun artists:delete 2026-07-01 2026-07-31   # supprime juillet
 *   bun artists:delete 2026-07-01               # supprime à partir du 1er juillet
 */
import { and, gte, lte } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { vinymixArtists, vinymixDaily } from "../src/db/schema";

const [fromArg, toArg] = process.argv.slice(2);

if (!fromArg) {
  console.error("Usage: bun artists:delete <date-debut> [date-fin]");
  console.error("  ex: bun artists:delete 2026-07-01 2026-07-31");
  process.exit(1);
}

const from = fromArg;
const to = toArg ?? "2099-12-31";

console.log(`\nSuppression des artistes planifiés du ${from} au ${to}…`);

const deleted = await db
  .delete(vinymixDaily)
  .where(and(gte(vinymixDaily.date, from), lte(vinymixDaily.date, to)))
  .returning();

if (deleted.length === 0) {
  console.log("Aucun artiste trouvé sur cette période.");
} else {
  console.log(`\n${deleted.length} artiste(s) supprimé(s) :\n`);
  for (const row of deleted) {
    const artist = await db.query.vinymixArtists.findFirst({
      where: eq(vinymixArtists.id, row.artistId),
    });
    console.log(`  ${row.date}  ${artist?.name ?? row.artistId}`);
  }
}

process.exit(0);
