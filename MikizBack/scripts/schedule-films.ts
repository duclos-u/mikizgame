#!/usr/bin/env bun
/**
 * Planifie N jours avec un mix de films populaires et de films récents en salle FR.
 *
 * Pools :
 *   50% → films populaires établis  (popular, pages 1-50)
 *   40% → films récents en salle FR (discover, sortis dans les 24 derniers mois)
 *   10% → films les mieux notés      (top_rated, pages 1-50)
 *
 * Usage:
 *   bun films:schedule           # 30 jours depuis aujourd'hui
 *   bun films:schedule 90        # 90 jours depuis aujourd'hui
 *   bun films:schedule 30 2026-07-01  # 30 jours depuis une date donnée
 */
import { and, gte, lte } from "drizzle-orm";
import { db } from "../src/db";
import { cineclueDaily } from "../src/db/schema";

const daysArg = parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

const apiKey = process.env.TMDB_API_KEY;
if (!apiKey) {
  console.error("TMDB_API_KEY manquante dans l'environnement");
  process.exit(1);
}

type TmdbResult = { id: number; title: string };

// ─── Pool 1 : films populaires établis (pages 1-50) ──────────────────────────

async function fetchPopularFilms(needed: number): Promise<TmdbResult[]> {
  const MAX_PAGE = 50;
  const pagesNeeded = Math.ceil(needed / 20) + 2;
  const pageSet = new Set<number>();
  while (pageSet.size < pagesNeeded) {
    pageSet.add(Math.floor(Math.random() * MAX_PAGE) + 1);
  }

  const collected: TmdbResult[] = [];
  console.log(`[Popular] Récupération de ${pageSet.size} pages (1-${MAX_PAGE})…`);

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

  return collected;
}

// ─── Pool 2 : films récents sortis en salle en France ────────────────────────

async function fetchRecentFilms(needed: number): Promise<TmdbResult[]> {
  const twoYearsAgo = new Date();
  twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);
  const dateFrom = twoYearsAgo.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const pagesNeeded = Math.ceil(needed / 20) + 2;
  const collected: TmdbResult[] = [];

  console.log(`[Récents] Récupération de ${pagesNeeded} pages (sorties FR ${dateFrom} → ${today})…`);

  for (let page = 1; page <= pagesNeeded; page++) {
    const res = await fetch(
      `https://api.themoviedb.org/3/discover/movie` +
        `?language=fr-FR` +
        `&region=FR` +
        `&release_date.gte=${dateFrom}` +
        `&release_date.lte=${today}` +
        `&sort_by=popularity.desc` +
        `&vote_count.gte=10` +
        `&page=${page}` +
        `&api_key=${apiKey}`,
    );
    if (!res.ok) {
      console.warn(`  Page ${page} ignorée (HTTP ${res.status})`);
      continue;
    }
    const data = (await res.json()) as { results: TmdbResult[] };
    if (data.results.length === 0) break;
    collected.push(...data.results);
  }

  return collected;
}

// ─── Pool 3 : films les mieux notés (pages 1-50) ─────────────────────────────

async function fetchTopRatedFilms(needed: number): Promise<TmdbResult[]> {
  const MAX_PAGE = 50;
  const pagesNeeded = Math.ceil(needed / 20) + 2;
  const pageSet = new Set<number>();
  while (pageSet.size < pagesNeeded) {
    pageSet.add(Math.floor(Math.random() * MAX_PAGE) + 1);
  }

  const collected: TmdbResult[] = [];
  console.log(`[Top Rated] Récupération de ${pageSet.size} pages (1-${MAX_PAGE})…`);

  for (const page of pageSet) {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/top_rated?language=fr-FR&page=${page}&api_key=${apiKey}`,
    );
    if (!res.ok) {
      console.warn(`  Page ${page} ignorée (HTTP ${res.status})`);
      continue;
    }
    const data = (await res.json()) as { results: TmdbResult[] };
    collected.push(...data.results);
  }

  return collected;
}

// ─── Déduplication ────────────────────────────────────────────────────────────

function dedupe(films: TmdbResult[]): TmdbResult[] {
  const seen = new Set<number>();
  return films.filter((m) => !seen.has(m.id) && seen.add(m.id));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const popularNeeded = Math.round(daysArg * 0.5);
const recentNeeded = Math.round(daysArg * 0.4);
const ratedNeeded = daysArg - popularNeeded - recentNeeded;

console.log(`\nObjectif : ${daysArg} jours (${popularNeeded} populaires + ${recentNeeded} récents + ${ratedNeeded} notés)\n`);

const [rawPopular, rawRecent, rawRated] = await Promise.all([
  fetchPopularFilms(popularNeeded),
  fetchRecentFilms(recentNeeded),
  fetchTopRatedFilms(ratedNeeded),
]);

const popularFilms = dedupe(rawPopular);
const recentFilms = dedupe(rawRecent);
const ratedFilms = dedupe(rawRated);

console.log(`\n  → ${popularFilms.length} films populaires uniques`);
console.log(`  → ${recentFilms.length} films récents uniques`);
console.log(`  → ${ratedFilms.length} films les mieux notés uniques`);

// ─── Exclusion fenêtre 6 mois ─────────────────────────────────────────────────

const startDate = startArg ? new Date(startArg) : new Date();

const windowStart = new Date(startDate);
windowStart.setMonth(windowStart.getMonth() - 6);
const windowEnd = new Date(startDate);
windowEnd.setDate(windowEnd.getDate() + daysArg - 1);
windowEnd.setMonth(windowEnd.getMonth() + 6);

const existing = await db
  .select({ tmdbId: cineclueDaily.tmdbId })
  .from(cineclueDaily)
  .where(
    and(
      gte(cineclueDaily.date, windowStart.toISOString().slice(0, 10)),
      lte(cineclueDaily.date, windowEnd.toISOString().slice(0, 10)),
    ),
  );

const excludedIds = new Set(existing.map((r) => r.tmdbId));
console.log(`  → ${excludedIds.size} film(s) déjà planifié(s) dans la fenêtre ±6 mois exclus`);

const eligiblePopular = popularFilms.filter((m) => !excludedIds.has(m.id));
const eligibleRecent = recentFilms.filter((m) => !excludedIds.has(m.id));
const eligibleRated = ratedFilms.filter((m) => !excludedIds.has(m.id));

const shuffledPopular = eligiblePopular.sort(() => Math.random() - 0.5).slice(0, popularNeeded);
const shuffledRecent = eligibleRecent.sort(() => Math.random() - 0.5).slice(0, recentNeeded);
const shuffledRated = eligibleRated.sort(() => Math.random() - 0.5).slice(0, ratedNeeded);
const combined = [...shuffledPopular, ...shuffledRecent, ...shuffledRated].sort(() => Math.random() - 0.5);

if (combined.length < daysArg) {
  console.warn(`\n⚠  Seulement ${combined.length} films uniques récupérés pour ${daysArg} jours demandés.`);
}

const count = Math.min(daysArg, combined.length);
const entries = Array.from({ length: count }, (_, i) => {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  return { tmdbId: combined[i].id, date: d.toISOString().slice(0, 10) };
});

const inserted = await db
  .insert(cineclueDaily)
  .values(entries)
  .onConflictDoNothing()
  .returning();

console.log(`\nPlanifié ${inserted.length} film(s) (${entries.length - inserted.length} déjà existants).`);
console.log(`Période : ${entries[0]?.date} → ${entries.at(-1)?.date}\n`);

for (const row of inserted) {
  const film = combined.find((m) => m.id === row.tmdbId);
  console.log(`  ${row.date}  ${film?.title ?? row.tmdbId}`);
}

process.exit(0);
