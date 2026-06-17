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

export type SpotifyArtistResult = {
  id: string;
  name: string;
  followers: number;
  genres: string[];
  imageUrl: string | null;
  popularity: number;
};

export async function searchSpotifyArtists(q: string): Promise<SpotifyArtistResult[]> {
  const token = await getToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=artist&limit=10`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);

  const data = (await res.json()) as {
    artists: {
      items: Array<{
        id: string;
        name: string;
        followers: { total: number };
        genres: string[];
        images: Array<{ url: string }>;
        popularity: number;
      }>;
    };
  };

  return data.artists.items.map((a) => ({
    id: a.id,
    name: a.name,
    followers: a.followers.total,
    genres: a.genres,
    imageUrl: a.images[0]?.url ?? null,
    popularity: a.popularity,
  }));
}

export async function fetchSpotifyArtist(id: string): Promise<SpotifyArtistResult | null> {
  const token = await getToken();
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const a = (await res.json()) as {
    id: string;
    name: string;
    followers: { total: number };
    genres: string[];
    images: Array<{ url: string }>;
    popularity: number;
  };

  return {
    id: a.id,
    name: a.name,
    followers: a.followers.total,
    genres: a.genres,
    imageUrl: a.images[0]?.url ?? null,
    popularity: a.popularity,
  };
}
