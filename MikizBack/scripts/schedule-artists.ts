#!/usr/bin/env bun
/**
 * Fetches top artists from Last.fm chart, upserts them into vinymix_artists,
 * and schedules them in vinymix_daily.
 *
 * Usage:
 *   bun artists:schedule           # 30 days from today
 *   bun artists:schedule 90        # 90 days from today
 *   bun artists:schedule 30 2026-07-01  # 30 days from a specific date
 */
import { and, gte, lte, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vinymixArtists, vinymixDaily } from "../src/db/schema";
import { type LastfmChartEntry, getArtistInfo, getTopArtists } from "../src/lib/lastfm";
import type { VinymixArtist } from "../src/lib/vinymix";

const daysArg = Number.parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

const apiKey = process.env.LASTFM_API_KEY;
if (!apiKey) {
  console.error("LASTFM_API_KEY missing from environment");
  process.exit(1);
}

// ─── Date range ───────────────────────────────────────────────────────────────

const startDate = startArg ? new Date(startArg) : new Date();
const startStr = startDate.toISOString().slice(0, 10);

const windowStart = new Date(startDate);
windowStart.setDate(windowStart.getDate() - 30);
const windowEnd = new Date(startDate);
windowEnd.setDate(windowEnd.getDate() + daysArg - 1 + 30);

console.log(`\nTarget: ${daysArg} day(s) from ${startStr}\n`);

// ─── Exclusion window ─────────────────────────────────────────────────────────

const existing = await db
  .select({ artistId: vinymixDaily.artistId, date: vinymixDaily.date })
  .from(vinymixDaily)
  .where(
    and(
      gte(vinymixDaily.date, windowStart.toISOString().slice(0, 10)),
      lte(vinymixDaily.date, windowEnd.toISOString().slice(0, 10)),
    ),
  );

const recentlyScheduledIds = new Set(existing.map((r) => r.artistId));
const alreadyScheduledDates = new Set(existing.map((r) => r.date));
console.log(`  → ${recentlyScheduledIds.size} artist(s) in exclusion window (±30 days)`);
console.log(`  → ${alreadyScheduledDates.size} date(s) already scheduled`);

// ─── Fetch chart pool ─────────────────────────────────────────────────────────

async function fetchChartPool(needed: number): Promise<LastfmChartEntry[]> {
  const pagesNeeded = Math.ceil((needed * 2.5) / 50) + 1;
  const collected: LastfmChartEntry[] = [];
  const seen = new Set<string>();

  console.log(`\n[Chart] Fetching ${pagesNeeded} page(s) of top artists...`);

  for (let page = 1; page <= pagesNeeded; page++) {
    try {
      const { artists, totalPages } = await getTopArtists(page, apiKey as string);
      for (const a of artists) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          collected.push(a);
        }
      }
      console.log(
        `  Page ${page}/${Math.min(pagesNeeded, totalPages)}: +${artists.length} artists (total: ${collected.length})`,
      );
      if (page >= totalPages) break;
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.warn(`  Page ${page} failed: ${err}`);
    }
  }

  return collected;
}

const chartPool = await fetchChartPool(daysArg);
const eligible = chartPool.filter((a) => !recentlyScheduledIds.has(a.id));

console.log(`\n  → ${chartPool.length} chart artists fetched`);
console.log(`  → ${eligible.length} eligible after exclusion window`);

if (eligible.length < daysArg) {
  console.warn(`\n⚠  Only ${eligible.length} eligible artists for ${daysArg} days requested.`);
}

const selected = eligible.sort(() => Math.random() - 0.5).slice(0, daysArg);

// ─── Enrich artists from Last.fm ──────────────────────────────────────────────

console.log(`\nEnriching ${selected.length} artists from Last.fm...`);

const enriched: VinymixArtist[] = [];

for (const entry of selected) {
  try {
    const artist = await getArtistInfo(entry.name, apiKey as string);
    enriched.push(artist);
    process.stdout.write(`  ✓ ${artist.name}\n`);
  } catch (err) {
    console.warn(`  [skip] ${entry.name}: ${err}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`\n  → ${enriched.length} artist(s) enriched successfully`);

if (enriched.length === 0) {
  console.error("No artists enriched, aborting.");
  process.exit(1);
}

// ─── Upsert artists into pool ─────────────────────────────────────────────────

await db
  .insert(vinymixArtists)
  .values(
    enriched.map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      creationYear: a.creationYear,
      memberCount: a.memberCount,
      spotifyFollowers: a.spotifyFollowers,
      genres: a.genres,
      country: a.country,
      vocalType: a.vocalType,
      primaryLanguage: a.primaryLanguage,
      mostFamousSong: a.mostFamousSong,
      instrumentation: a.instrumentation,
      appearsOnSoundtracksWith: a.appearsOnSoundtracksWith,
      updatedAt: new Date(),
    })),
  )
  .onConflictDoUpdate({
    target: vinymixArtists.id,
    set: {
      name: sql`excluded.name`,
      imageUrl: sql`excluded.image_url`,
      spotifyFollowers: sql`excluded.spotify_followers`,
      genres: sql`excluded.genres`,
      country: sql`excluded.country`,
      vocalType: sql`excluded.vocal_type`,
      primaryLanguage: sql`excluded.primary_language`,
      mostFamousSong: sql`excluded.most_famous_song`,
      updatedAt: sql`excluded.updated_at`,
      // creationYear, memberCount, instrumentation, appearsOnSoundtracksWith are NOT updated
      // to preserve any values manually curated via the admin route
    },
  });

console.log(`  → Upserted ${enriched.length} artist(s) into vinymix_artists`);

// ─── Schedule daily artists ───────────────────────────────────────────────────

const entries: { date: string; artistId: string }[] = [];
for (let i = 0; i < enriched.length; i++) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  const dateStr = d.toISOString().slice(0, 10);
  if (!alreadyScheduledDates.has(dateStr)) {
    entries.push({ date: dateStr, artistId: enriched[i].id });
  }
}

const inserted = await db.insert(vinymixDaily).values(entries).onConflictDoNothing().returning();

console.log(
  `\nScheduled ${inserted.length} artist(s) (${entries.length - inserted.length} already existed).`,
);
if (entries.length > 0) {
  console.log(`Period: ${entries[0]?.date} → ${entries.at(-1)?.date}\n`);
}

for (const row of inserted) {
  const artist = enriched.find((a) => a.id === row.artistId);
  console.log(`  ${row.date}  ${artist?.name ?? row.artistId}`);
}

process.exit(0);
