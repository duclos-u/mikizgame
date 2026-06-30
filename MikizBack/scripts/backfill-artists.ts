#!/usr/bin/env bun
/**
 * Backfills creationYear, gender, country, genres, and memberCount for
 * existing vinymix_artists rows, using MusicBrainz as the primary source.
 * With --popularity: backfills spotifyPopularity from Spotify instead.
 *
 * Usage:
 *   bun artists:backfill              # all artists missing any field
 *   bun artists:backfill --all        # re-process every artist (force refresh)
 *   bun artists:backfill --dry        # print what would be updated, no writes
 *   bun artists:backfill --popularity # backfill spotifyPopularity from Spotify
 */
import { eq, isNull, or } from "drizzle-orm";
import { db } from "../src/db";
import { vinymixArtists } from "../src/db/schema";
import { normalizeGenres } from "../src/lib/genres";
import { fetchMusicBrainzArtist } from "../src/lib/musicbrainz";
import { fetchSpotifyArtist } from "../src/lib/spotify";

const dry = process.argv.includes("--dry");
const all = process.argv.includes("--all");
const popularityMode = process.argv.includes("--popularity");

if (popularityMode) {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
    process.exit(1);
  }
  const allArtists = await db.select({ id: vinymixArtists.id, name: vinymixArtists.name }).from(vinymixArtists);
  console.log(`\n${allArtists.length} artist(s) to backfill popularity${dry ? " (dry run)" : ""}.\n`);
  let updated = 0;
  for (const row of allArtists) {
    const artist = await fetchSpotifyArtist(row.id);
    if (artist) {
      console.log(`  ✓ ${row.name} — popularity=${artist.popularity}`);
      if (!dry) await db.update(vinymixArtists).set({ spotifyPopularity: artist.popularity }).where(eq(vinymixArtists.id, row.id));
      updated++;
    } else {
      console.log(`  [skip] ${row.name} — not found on Spotify`);
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
  console.log(`\nDone. ${updated} updated${dry ? " (dry run — no writes)" : ""}.`);
  process.exit(0);
}

const rows = await db
  .select({ id: vinymixArtists.id, name: vinymixArtists.name, genres: vinymixArtists.genres })
  .from(vinymixArtists)
  .where(
    all
      ? undefined
      : or(
          isNull(vinymixArtists.creationYear),
          isNull(vinymixArtists.gender),
          isNull(vinymixArtists.country),
        ),
  );

console.log(`\n${rows.length} artist(s) to backfill${dry ? " (dry run)" : ""}.\n`);

if (rows.length === 0) process.exit(0);

let updated = 0;
let skipped = 0;

for (const row of rows) {
  const mb = await fetchMusicBrainzArtist(row.name);

  if (!mb.creationYear && !mb.gender && !mb.country && mb.genres.length === 0) {
    console.log(`  [skip] ${row.name} — no MB data found`);
    skipped++;
  } else {
    const memberCount = mb.memberCount ?? undefined;
    const genres = mb.genres.length > 0 ? normalizeGenres(mb.genres) : undefined;

    const parts = [
      mb.creationYear ? `year=${mb.creationYear}` : null,
      mb.gender ? `gender=${mb.gender}` : null,
      mb.country ? `country=${mb.country}` : null,
      genres ? `genres=[${genres.join(", ")}]` : null,
      mb.type ? `type=${mb.type}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    console.log(`  ✓ ${row.name} — ${parts}`);

    if (!dry) {
      await db
        .update(vinymixArtists)
        .set({
          creationYear: mb.creationYear ?? undefined,
          gender: mb.gender ?? undefined,
          country: mb.country ?? undefined,
          ...(genres ? { genres } : {}),
          ...(memberCount !== undefined ? { memberCount } : {}),
        })
        .where(eq(vinymixArtists.id, row.id));
    }
    updated++;
  }

  await new Promise((r) => setTimeout(r, 1100));
}

console.log(
  `\nDone. ${updated} updated, ${skipped} skipped${dry ? " (dry run — no writes)" : ""}.`,
);
process.exit(0);
