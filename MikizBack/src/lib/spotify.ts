import { normalizeGenres } from "./genres";
import { fetchMusicBrainzArtist } from "./musicbrainz";
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

type SpotifyMinimalArtist = {
  id: string;
  name: string;
  images?: Array<{ url: string }>;
  followers?: { total: number };
  genres?: string[];
  popularity?: number;
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

// ─── Fetch wrapper with 429 retry ─────────────────────────────────────────────

async function spotifyFetch(url: string, retries = 3): Promise<Response> {
  const token = await getToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429 && retries > 0) {
    const wait = Math.min((Number(res.headers.get("Retry-After") ?? "5") + 1) * 1000, 30_000);
    console.warn(`  [Spotify] 429 — retrying in ${Math.round(wait / 1000)}s...`);
    await new Promise((r) => setTimeout(r, wait));
    return spotifyFetch(url, retries - 1);
  }
  return res;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchSpotifyArtists(q: string): Promise<SpotifyArtistResult[]> {
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist&limit=10`;
  const res = await spotifyFetch(url);
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);

  const data = (await res.json()) as { artists: { items: SpotifyMinimalArtist[] } };

  return data.artists.items.map((a) => ({
    id: a.id,
    name: a.name,
    followers: a.followers?.total ?? 0,
    genres: a.genres ?? [],
    imageUrl: a.images?.[0]?.url ?? null,
    popularity: a.popularity ?? 0,
  }));
}

export async function fetchSpotifyArtist(id: string): Promise<SpotifyArtistResult | null> {
  const res = await spotifyFetch(`https://api.spotify.com/v1/artists/${id}`);
  if (!res.ok) return null;

  const a = (await res.json()) as SpotifyMinimalArtist;

  return {
    id: a.id,
    name: a.name,
    followers: a.followers?.total ?? 0,
    genres: a.genres ?? [],
    imageUrl: a.images?.[0]?.url ?? null,
    popularity: a.popularity ?? 0,
  };
}

// ─── Genre-seed pool builder ──────────────────────────────────────────────────

const SEARCH_LIMIT = 10;
const MAX_PAGES_PER_GENRE = 5;

async function fetchArtistsByGenreSeeds(seeds: string[], targetCount: number, label: string): Promise<SpotifyChartEntry[]> {
  const seen = new Set<string>();
  const collected: SpotifyChartEntry[] = [];

  if (targetCount === 0) return collected;

  console.log(`[Spotify] Searching ${seeds.length} ${label} genre(s) for ~${targetCount} artists...`);

  for (const genre of seeds) {
    if (collected.length >= targetCount) break;

    for (let page = 0; page < MAX_PAGES_PER_GENRE; page++) {
      if (collected.length >= targetCount) break;

      try {
        const offset = page * SEARCH_LIMIT;
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(`genre:${genre}`)}&type=artist&limit=${SEARCH_LIMIT}&offset=${offset}`;
        const res = await spotifyFetch(url);
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

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return collected;
}

// ─── Pools ────────────────────────────────────────────────────────────────────

const GLOBAL_GENRE_SEEDS = [
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

// Curated list of French/Francophone Spotify artist IDs.
// Genre search doesn't work reliably for French music in Spotify's search API.
const FRENCH_ARTIST_IDS: string[] = [
  "4tZwfgrHOc3mvqYlEYSvVi", // Daft Punk
  "5j4HeCoUlzhfWtjAfM1acR", // Stromae
  "1Cs0zKBU1kc0i8ypK3B9ai", // David Guetta
  "7IlRNXHjoOCgEAWN5qYksg", // Aya Nakamura
  "3IW7ScrzXmPvZhB27hmfgy", // Jul
  "1mbgj8ERPs8lWi7t5cYrdy", // Zaz
  "7knmbOGe07k85GmK50vACB", // Indochine
  "63MQldklfxkjYDoUE4Tppz", // M83
  "1P6U1dCeHxPui5pIrGmndZ", // Air
  "4FpJcNgOvIpSBeJgRg3OfN", // Orelsan
  "3NH8t45zOTqzlZgBvZRjvB", // PNL
  "4LXBc13z5EWsc5N32bLxfH", // Nekfeu
  "2RJBv9wXbW6m539q9NOfW1", // Soprano
  "04vj3iPUiVh5melWr0w3xT", // Christine and the Queens
  "6gK1Uct5FEdaUWRWpU4Cl2", // Petit Biscuit
  "3CnCGFxXbOA8bAK54jR8js", // Vald
  "3QVolfxko2UyCOtexhVTli", // Angèle
  "45yEuthJ9yq1rNXAOpBnqM", // Polo & Pan
  "0iui2Be5CP8EWxvHYsVspL", // Breakbot
  "0wuuYZFptujAsRthrdea2B", // Vendredi sur Mer
  "2oVrruuEI0Dr2I4NvLtQS0", // Clara Luciani
  "0WbqAlM1WvfUD6dF7omThd", // Yelle
  "5Nq9MbzweBc5oL4WzsECx4", // Calogero
  "26Kq9bSJsElA93PflKEB1A", // Benjamin Biolay
  "1Yfe3ONJlioHys7jwHdfVm", // Lomepal
  "6Te49r3A6f5BiIgBRxH7FH", // Ninho
  "0GOx72r5AAEKRGQFn3xqXK", // GIMS
  "6L34dW6SKMSDaGIfYDU19j", // Maes
  "7CUFPNi1TU8RowpnFRSsZV", // Niska
  "3DCWeG2J1fZeu0Oe6i5Q6m", // PLK
  "0LnhY2fzptb0QEs5Q5gM7S", // Laylow
  "5gs4Sm2WQUkcGeikMcVHbh", // Hamza
  "2UwqpfQtNuhBwviIC0f2ie", // Damso
  "1eTRyiHsWMoWKPD6s4Kiqt", // Lujipeka
  "5gqmbbfjcikQBzPB5Hv13I", // Gazo
  "3vUMXQ9kPnZAQkMkZZ7Hfh", // Tiakola
  "4uJNQGa3L2frXDxwgouTIw", // Franglish
  "2kXKa3aAFngGz2P4GjG5w2", // SCH
  "7DUTsWY3RBd64vh8UtgtYA", // Lacrim
  "58wXmynHaAWI5hwlPZP3qL", // Booba
];

export function getPopularArtists(targetCount: number): Promise<SpotifyChartEntry[]> {
  return fetchArtistsByGenreSeeds(GLOBAL_GENRE_SEEDS, targetCount, "global");
}

export async function getFrenchArtists(targetCount: number): Promise<SpotifyChartEntry[]> {
  if (targetCount === 0) return [];

  console.log(`[French] Sampling ${targetCount} artist(s) from curated list of ${FRENCH_ARTIST_IDS.length}...`);

  // Shuffle and take targetCount IDs
  const shuffled = [...FRENCH_ARTIST_IDS].sort(() => Math.random() - 0.5);
  const ids = shuffled.slice(0, Math.min(targetCount, shuffled.length));

  const results: SpotifyChartEntry[] = [];
  for (const id of ids) {
    const artist = await fetchSpotifyArtist(id);
    if (artist) {
      results.push({ id: artist.id, name: artist.name, imageUrl: artist.imageUrl });
      process.stdout.write(`  ✓ ${artist.name}\n`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`[French] Found ${results.length} French artist(s).`);
  return results;
}

// ─── Artist enrichment ────────────────────────────────────────────────────────

export async function getArtistInfo(
  id: string,
  name: string,
  imageUrl: string | null,
): Promise<VinymixArtist> {
  const [artist, mb] = await Promise.all([
    fetchSpotifyArtist(id),
    fetchMusicBrainzArtist(name),
  ]);
  const genres = normalizeGenres(mb.genres.length > 0 ? mb.genres : (artist?.genres ?? []));
  const memberCount = mb.memberCount ?? 1;

  return {
    id,
    name,
    imageUrl: artist?.imageUrl ?? imageUrl,
    creationYear: mb.creationYear,
    memberCount,
    spotifyFollowers: artist?.followers ?? 0,
    genres,
    mostFamousSong: null,
    gender: mb.gender,
    country: mb.country,
  };
}
