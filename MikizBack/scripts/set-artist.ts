#!/usr/bin/env bun
/**
 * Pins a specific artist to a given date in vinymix_daily.
 * Accepts either a Spotify artist ID or an artist name (searches Spotify for the top result).
 *
 * Usage:
 *   bun artists:set 2026-06-25 1McMsnEElThX1knmY4oliG   # by Spotify ID
 *   bun artists:set 2026-06-26 "Daft Punk"              # by name
 */
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { vinymixArtists, vinymixDaily } from "../src/db/schema";
import { fetchSpotifyArtist, getArtistInfo, searchSpotifyArtists } from "../src/lib/spotify";

const [dateArg, queryArg] = process.argv.slice(2);

if (!dateArg || !queryArg) {
  console.error("Usage: bun artists:set <YYYY-MM-DD> <spotifyId|artistName>");
  console.error('  ex: bun artists:set 2026-06-25 1McMsnEElThX1knmY4oliG');
  console.error('  ex: bun artists:set 2026-06-25 "Daft Punk"');
  process.exit(1);
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error("Date must be in YYYY-MM-DD format");
  process.exit(1);
}

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
  console.error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  process.exit(1);
}

// Detect Spotify ID (22 alphanumeric chars) vs artist name
const isSpotifyId = /^[A-Za-z0-9]{22}$/.test(queryArg);

let spotifyId: string;
let artistName: string;
let artistImageUrl: string | null;

if (isSpotifyId) {
  const artist = await fetchSpotifyArtist(queryArg);
  if (!artist) {
    console.error(`Artiste introuvable sur Spotify (id: ${queryArg})`);
    process.exit(1);
  }
  spotifyId = artist.id;
  artistName = artist.name;
  artistImageUrl = artist.imageUrl;
} else {
  const results = await searchSpotifyArtists(queryArg);
  if (results.length === 0) {
    console.error(`Aucun résultat Spotify pour "${queryArg}"`);
    process.exit(1);
  }
  const top = results[0];
  spotifyId = top.id;
  artistName = top.name;
  artistImageUrl = top.imageUrl;
  console.log(`  → Trouvé : ${artistName} (${spotifyId})`);
}

// Enrich with Spotify details + MusicBrainz metadata
console.log(`  → Enrichissement de ${artistName}…`);
const artist = await getArtistInfo(spotifyId, artistName, artistImageUrl);

// Upsert into artist pool
await db
  .insert(vinymixArtists)
  .values({
    id: artist.id,
    name: artist.name,
    imageUrl: artist.imageUrl,
    creationYear: artist.creationYear,
    memberCount: artist.memberCount,
    spotifyFollowers: artist.spotifyFollowers,
    genres: artist.genres,
    mostFamousSong: artist.mostFamousSong,
    gender: artist.gender,
    country: artist.country,
    updatedAt: new Date(),
  })
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
      creationYear: sql`excluded.creation_year`,
      updatedAt: sql`excluded.updated_at`,
    },
  });

// Pin to the requested date
await db
  .insert(vinymixDaily)
  .values({ date: dateArg, artistId: artist.id })
  .onConflictDoUpdate({ target: vinymixDaily.date, set: { artistId: artist.id } });

const meta = [
  artist.country,
  artist.creationYear,
  artist.gender,
].filter(Boolean).join(", ");

console.log(`\n✓ ${artist.name}${meta ? ` (${meta})` : ""} — ${dateArg}`);
process.exit(0);
