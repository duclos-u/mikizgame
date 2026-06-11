#!/usr/bin/env bun
/**
 * Planifie N jours avec des films populaires aléatoires depuis TMDB.
 *
 * Usage:
 *   bun films:schedule           # 30 jours depuis aujourd'hui
 *   bun films:schedule 90        # 90 jours depuis aujourd'hui
 *   bun films:schedule 30 2026-07-01  # 30 jours depuis une date donnée
 */
import { db } from "../src/db";
import { cineclueDaily } from "../src/db/schema";

const daysArg = parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

const apiKey = process.env.TMDB_API_KEY;
if (!apiKey) {
  console.error("TMDB_API_KEY manquante dans l'environnement");
  process.exit(1);
}

// Tire des pages aléatoires dans le catalogue TMDB popular (max 500 pages × 20 films)
const PAGES_NEEDED = Math.ceil(daysArg / 20) + 2;
const pageSet = new Set<number>();
while (pageSet.size < PAGES_NEEDED) {
  pageSet.add(Math.floor(Math.random() * 500) + 1);
}

type TmdbResult = { id: number; title: string };
const collected: TmdbResult[] = [];

console.log(`Récupération de ${pageSet.size} pages TMDB…`);
for (const page of pageSet) {
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/popular?language=fr-FR&page=${page}&api_key=${apiKey}`,
  );
  if (!res.ok) {
    console.warn(`  Page ${page} ignorée (HTTP ${res.status})`);
    continue;
  }
  const data = (await res.json()) as { results: TmdbResult[] };
  collected.push(...data.results);
}

// Dédoublonnage + mélange
const seen = new Set<number>();
const unique = collected.filter((m) => !seen.has(m.id) && seen.add(m.id));
const shuffled = unique.sort(() => Math.random() - 0.5);

if (shuffled.length < daysArg) {
  console.warn(
    `⚠  Seulement ${shuffled.length} films uniques récupérés pour ${daysArg} jours demandés.`,
  );
}

const startDate = startArg ? new Date(startArg) : new Date();
const count = Math.min(daysArg, shuffled.length);
const entries = Array.from({ length: count }, (_, i) => {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  return { tmdbId: shuffled[i].id, date: d.toISOString().slice(0, 10) };
});

const inserted = await db
  .insert(cineclueDaily)
  .values(entries)
  .onConflictDoNothing()
  .returning();

console.log(
  `\nPlanifié ${inserted.length} film(s) (${entries.length - inserted.length} déjà existants).`,
);
console.log(`Période : ${entries[0]?.date} → ${entries.at(-1)?.date}\n`);

for (const row of inserted) {
  const film = shuffled.find((m) => m.id === row.tmdbId);
  console.log(`  ${row.date}  ${film?.title ?? row.tmdbId}`);
}

process.exit(0);
