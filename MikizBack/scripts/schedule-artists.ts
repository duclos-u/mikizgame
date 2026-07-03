#!/usr/bin/env bun
/**
 * Fetches popular artists from Spotify, upserts them into vinymix_artists,
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
import {
  type SpotifyChartEntry,
  getArtistInfo,
  getFrenchArtists,
  getPopularArtists,
} from "../src/lib/spotify";
import type { VinymixArtist } from "../src/lib/vinymix";

const daysArg = Number.parseInt(process.argv[2] ?? "30", 10);
const startArg = process.argv[3];

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set in environment");
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

// ─── Fetch 50/50 global + French pools from Spotify ──────────────────────────

const globalCount = Math.floor(daysArg / 2);
const frenchCount = Math.ceil(daysArg / 2);

// Always fetch a full global buffer so it can backfill if the French pool falls short
const globalBuffer = Math.max(globalCount, daysArg) * 3;
const [globalPool, frenchPool] = await Promise.all([
  getPopularArtists(globalBuffer),
  getFrenchArtists(frenchCount * 3),
]);

const eligibleGlobal = globalPool.filter((a) => !recentlyScheduledIds.has(a.id));
const eligibleFrench = frenchPool.filter((a) => !recentlyScheduledIds.has(a.id));

console.log(
  `\n  → ${globalPool.length} global artist(s) fetched, ${eligibleGlobal.length} eligible`,
);
console.log(`  → ${frenchPool.length} French artist(s) fetched, ${eligibleFrench.length} eligible`);

if (eligibleGlobal.length < globalCount) {
  console.warn(
    `\n⚠  Only ${eligibleGlobal.length} eligible global artists for ${globalCount} slots.`,
  );
}
if (eligibleFrench.length < frenchCount) {
  console.warn(
    `\n⚠  Only ${eligibleFrench.length} eligible French artists for ${frenchCount} slots.`,
  );
}

let selectedGlobal = eligibleGlobal.sort(() => Math.random() - 0.5).slice(0, globalCount);
const selectedFrench = eligibleFrench.sort(() => Math.random() - 0.5).slice(0, frenchCount);

// Backfill from the global pool when French pool doesn't have enough artists
const shortfall = daysArg - selectedGlobal.length - selectedFrench.length;
if (shortfall > 0) {
  const usedIds = new Set(selectedGlobal.map((a) => a.id));
  const extras = eligibleGlobal
    .filter((a) => !usedIds.has(a.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, shortfall);
  selectedGlobal = [...selectedGlobal, ...extras];
  if (extras.length > 0) console.log(`  → Backfilled ${extras.length} slot(s) from global pool`);
}

// Intersperse global and French days with a final shuffle
const selected = [...selectedGlobal, ...selectedFrench].sort(() => Math.random() - 0.5);

// ─── Enrich artists from Spotify ──────────────────────────────────────────────

console.log(`\nEnriching ${selected.length} artists from Spotify...`);

const enriched: VinymixArtist[] = [];

for (const entry of selected) {
  try {
    const artist = await getArtistInfo(entry.id, entry.name, entry.imageUrl);
    enriched.push(artist);
    process.stdout.write(`  ✓ ${artist.name}\n`);
  } catch (err) {
    console.warn(`  [skip] ${entry.name}: ${err}`);
  }
  await new Promise((r) => setTimeout(r, 1100));
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
      spotifyPopularity: a.spotifyPopularity,
      genres: a.genres,
      gender: a.gender,
      country: a.country,
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
      gender: sql`excluded.gender`,
      country: sql`excluded.country`,
      memberCount: sql`excluded.member_count`,
      updatedAt: sql`excluded.updated_at`,
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

if (entries.length === 0) {
  console.log("\nAll requested dates already scheduled. Nothing to do.");
  process.exit(0);
}

const inserted = await db.insert(vinymixDaily).values(entries).onConflictDoNothing().returning();

console.log(
  `\nScheduled ${inserted.length} artist(s) (${entries.length - inserted.length} already existed).`,
);
console.log(`Period: ${entries[0]?.date} → ${entries.at(-1)?.date}\n`);

for (const row of inserted) {
  const artist = enriched.find((a) => a.id === row.artistId);
  console.log(`  ${row.date}  ${artist?.name ?? row.artistId}`);
}

process.exit(0);
