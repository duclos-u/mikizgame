import type { VinymixArtist } from "./vinymix";

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Spotify credentials not configured");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

// ─── Minimal artist shape returned by Spotify's basic developer tier ──────────
// The full artist object (genres, followers, popularity) requires Extended Quota.

type SpotifyMinimalArtist = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
};

// ─── Public types ─────────────────────────────────────────────────────────────

export type SpotifyArtistResult = {
  id: string;
  name: string;
  followers: number;
  genres: string[];
  imageUrl: string | null;
  popularity: number;
};

export type SpotifyChartEntry = {
  id: string;
  name: string;
  imageUrl: string | null;
};

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchSpotifyArtists(q: string): Promise<SpotifyArtistResult[]> {
  const token = await getToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist&limit=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);

  const data = (await res.json()) as { artists: { items: SpotifyMinimalArtist[] } };

  return data.artists.items.map((a) => ({
    id: a.id,
    name: a.name,
    followers: 0,
    genres: [],
    imageUrl: a.images?.[0]?.url ?? null,
    popularity: 0,
  }));
}

export async function fetchSpotifyArtist(id: string): Promise<SpotifyArtistResult | null> {
  const token = await getToken();
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const a = (await res.json()) as SpotifyMinimalArtist;

  return {
    id: a.id,
    name: a.name,
    followers: 0,
    genres: [],
    imageUrl: a.images?.[0]?.url ?? null,
    popularity: 0,
  };
}

// ─── Chart pool ───────────────────────────────────────────────────────────────
// Spotify's basic tier caps search at 10 results per request.

const GENRE_SEEDS = [
  "pop",
  "rock",
  "hip-hop",
  "electronic",
  "r-n-b",
  "metal",
  "indie",
  "latin",
  "country",
  "jazz",
];

const SEARCH_LIMIT = 10;
const MAX_PAGES_PER_GENRE = 5;

export async function getPopularArtists(targetCount: number): Promise<SpotifyChartEntry[]> {
  const token = await getToken();
  const seen = new Set<string>();
  const collected: SpotifyChartEntry[] = [];

  console.log(`[Spotify] Searching ${GENRE_SEEDS.length} genre(s) for ~${targetCount} artists...`);

  for (const genre of GENRE_SEEDS) {
    if (collected.length >= targetCount) break;

    for (let page = 0; page < MAX_PAGES_PER_GENRE; page++) {
      if (collected.length >= targetCount) break;

      try {
        const offset = page * SEARCH_LIMIT;
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(`genre:${genre}`)}&type=artist&limit=${SEARCH_LIMIT}&offset=${offset}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          console.warn(`  [skip] genre:${genre} page ${page + 1} — ${res.status}`);
          break;
        }

        const data = (await res.json()) as {
          artists: { items: SpotifyMinimalArtist[]; total: number };
        };

        let added = 0;
        for (const a of data.artists.items) {
          if (!seen.has(a.id)) {
            seen.add(a.id);
            collected.push({ id: a.id, name: a.name, imageUrl: a.images?.[0]?.url ?? null });
            added++;
          }
        }
        console.log(`  genre:${genre} p${page + 1} → +${added} (total: ${collected.length})`);

        if (data.artists.items.length < SEARCH_LIMIT) break;
      } catch (err) {
        console.warn(`  [skip] genre:${genre}: ${err}`);
        break;
      }

      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return collected;
}

// ─── Artist enrichment ────────────────────────────────────────────────────────

export async function getArtistInfo(
  id: string,
  name: string,
  imageUrl: string | null,
): Promise<VinymixArtist> {
  return {
    id,
    name,
    imageUrl,
    creationYear: null,
    memberCount: 1,
    spotifyFollowers: 0,
    genres: [],
    vocalType: null,
    mostFamousSong: null,
    instrumentation: null,
    appearsOnSoundtracksWith: [],
  };
}
