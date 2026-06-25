#!/usr/bin/env bun
/**
 * Force un film spécifique à une date donnée.
 *
 * Usage:
 *   bun films:set 2026-06-15 872585
 */
import { db } from "../src/db";
import { cinemaxdDaily } from "../src/db/schema";

const [dateArg, tmdbIdArg] = process.argv.slice(2);

if (!dateArg || !tmdbIdArg) {
  console.error("Usage: bun films:set <YYYY-MM-DD> <tmdbId>");
  console.error("  ex: bun films:set 2026-06-15 872585");
  process.exit(1);
}

const tmdbId = Number.parseInt(tmdbIdArg, 10);
if (isNaN(tmdbId)) {
  console.error("tmdbId doit être un entier");
  process.exit(1);
}

const apiKey = process.env.TMDB_API_KEY;
if (apiKey) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdbId}?language=fr-FR&api_key=${apiKey}`,
  );
  if (!res.ok) {
    console.error(`Film introuvable sur TMDB (${res.status})`);
    process.exit(1);
  }
  const data = (await res.json()) as { title: string; release_date?: string };
  console.log(`  → ${data.title} (${data.release_date?.slice(0, 4) ?? "?"})`);
}

await db
  .insert(cinemaxdDaily)
  .values({ date: dateArg, tmdbId })
  .onConflictDoUpdate({ target: cinemaxdDaily.date, set: { tmdbId } });

console.log(`Film du jour ${dateArg} : tmdbId=${tmdbId}`);
process.exit(0);
