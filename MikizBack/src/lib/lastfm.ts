import type { VinymixArtist } from "./vinymix";

// ─── Raw API types ─────────────────────────────────────────────────────────────

type LastfmImage = {
  "#text": string;
  size: "small" | "medium" | "large" | "extralarge" | "mega" | "";
};

type LastfmSearchArtist = {
  name: string;
  listeners: string;
  mbid: string;
  url: string;
  image: LastfmImage[];
};

type LastfmChartArtist = {
  name: string;
  listeners: string;
  mbid: string;
  url: string;
  image: LastfmImage[];
};

type LastfmArtistInfo = {
  name: string;
  mbid: string;
  url: string;
  image: LastfmImage[];
  stats: { listeners: string; playcount: string };
  tags: { tag: { name: string; url: string }[] };
  bio: { summary: string; content: string };
  error?: number;
  message?: string;
};

type LastfmTrack = {
  name: string;
  playcount: string;
  url: string;
};

type LastfmSearchResponse = {
  results: { artistmatches: { artist: LastfmSearchArtist[] } };
};

type LastfmChartResponse = {
  artists: {
    artist: LastfmChartArtist[];
    "@attr": { page: string; perPage: string; totalPages: string; total: string };
  };
};

type LastfmInfoResponse = {
  artist?: LastfmArtistInfo;
  error?: number;
  message?: string;
};

type LastfmTopTracksResponse = {
  toptracks?: { track: LastfmTrack[] };
  error?: number;
};

// ─── Tag inference maps ────────────────────────────────────────────────────────

const COUNTRY_TAG_MAP: Record<string, string> = {
  french: "France",
  france: "France",
  british: "United Kingdom",
  uk: "United Kingdom",
  american: "United States",
  usa: "United States",
  german: "Germany",
  germany: "Germany",
  canadian: "Canada",
  canada: "Canada",
  australian: "Australia",
  swedish: "Sweden",
  japanese: "Japan",
  korean: "South Korea",
  "k-pop": "South Korea",
  brazilian: "Brazil",
  belgian: "Belgium",
  icelandic: "Iceland",
  spanish: "Spain",
  italian: "Italy",
  norwegian: "Norway",
  dutch: "Netherlands",
};

const LANGUAGE_TAG_MAP: Record<string, string> = {
  french: "French",
  france: "French",
  german: "German",
  spanish: "Spanish",
  italian: "Italian",
  japanese: "Japanese",
  "k-pop": "Korean",
  korean: "Korean",
  portuguese: "Portuguese",
  swedish: "Swedish",
  norwegian: "Norwegian",
};

const VOCAL_TAG_MAP: Record<string, string> = {
  "female vocalists": "Female",
  "female vocalist": "Female",
  "male vocalists": "Male",
  "male vocalist": "Male",
  instrumental: "Instrumental",
};

const MALE_GENRE_HINTS = new Set(["hip-hop", "hip hop", "rap", "metal", "hardcore", "punk"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeArtistId(mbid: string, name: string): string {
  if (mbid) return mbid;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function bestImage(images: LastfmImage[]): string | null {
  for (const size of ["extralarge", "mega", "large", "medium", "small"] as const) {
    const found = images.find((img) => img.size === size && img["#text"]);
    if (found) return found["#text"];
  }
  return images.find((img) => img["#text"])?.["#text"] ?? null;
}

function inferFromTags(tags: string[]): {
  country: string | null;
  primaryLanguage: string | null;
  vocalType: string | null;
} {
  const normalized = tags.map((t) => t.toLowerCase().trim());
  let country: string | null = null;
  let primaryLanguage: string | null = null;
  let vocalType: string | null = null;

  for (const tag of normalized) {
    if (!country && COUNTRY_TAG_MAP[tag]) country = COUNTRY_TAG_MAP[tag];
    if (!primaryLanguage && LANGUAGE_TAG_MAP[tag]) primaryLanguage = LANGUAGE_TAG_MAP[tag];
    if (!vocalType && VOCAL_TAG_MAP[tag]) vocalType = VOCAL_TAG_MAP[tag];
  }

  if (!primaryLanguage) {
    if (country === "France") primaryLanguage = "French";
    else if (country === "Germany") primaryLanguage = "German";
    else if (country === "Spain") primaryLanguage = "Spanish";
    else if (country === "Italy") primaryLanguage = "Italian";
    else if (country === "Japan") primaryLanguage = "Japanese";
    else if (country === "South Korea") primaryLanguage = "Korean";
    else if (country === "Sweden") primaryLanguage = "Swedish";
    else if (country === "Norway") primaryLanguage = "Norwegian";
    else if (country === "Brazil") primaryLanguage = "Portuguese";
  }

  if (!vocalType && normalized.some((t) => MALE_GENRE_HINTS.has(t))) {
    vocalType = "Male";
  }

  return { country, primaryLanguage, vocalType };
}

const BASE = "https://ws.audioscrobbler.com/2.0/";

// ─── Public API ───────────────────────────────────────────────────────────────

export type LastfmSearchResult = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  followers: number;
};

export async function searchArtists(q: string, apiKey: string): Promise<LastfmSearchResult[]> {
  const url = `${BASE}?method=artist.search&artist=${encodeURIComponent(q)}&limit=10&api_key=${apiKey}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Last.fm search failed: ${res.status}`);

  const data = (await res.json()) as LastfmSearchResponse;
  const artists = data.results?.artistmatches?.artist ?? [];

  return artists.map((a) => ({
    id: makeArtistId(a.mbid, a.name),
    name: a.name,
    imageUrl: bestImage(a.image),
    genres: [],
    followers: Number.parseInt(a.listeners, 10) || 0,
  }));
}

export type LastfmChartEntry = {
  id: string;
  name: string;
  listeners: number;
  mbid: string;
};

export async function getTopArtists(
  page: number,
  apiKey: string,
  limit = 50,
): Promise<{ artists: LastfmChartEntry[]; totalPages: number }> {
  const url = `${BASE}?method=chart.getTopArtists&limit=${limit}&page=${page}&api_key=${apiKey}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Last.fm chart.getTopArtists failed: ${res.status}`);

  const data = (await res.json()) as LastfmChartResponse;
  const totalPages = Number.parseInt(data.artists["@attr"].totalPages, 10);

  return {
    artists: data.artists.artist.map((a) => ({
      id: makeArtistId(a.mbid, a.name),
      name: a.name,
      listeners: Number.parseInt(a.listeners, 10) || 0,
      mbid: a.mbid,
    })),
    totalPages,
  };
}

export async function getArtistInfo(name: string, apiKey: string): Promise<VinymixArtist> {
  const [infoRes, tracksRes] = await Promise.all([
    fetch(
      `${BASE}?method=artist.getInfo&artist=${encodeURIComponent(name)}&autocorrect=1&api_key=${apiKey}&format=json`,
    ),
    fetch(
      `${BASE}?method=artist.getTopTracks&artist=${encodeURIComponent(name)}&limit=1&api_key=${apiKey}&format=json`,
    ),
  ]);

  if (!infoRes.ok) throw new Error(`Last.fm artist.getInfo failed: ${infoRes.status}`);

  const infoData = (await infoRes.json()) as LastfmInfoResponse;
  if (infoData.error || !infoData.artist) {
    throw new Error(`Last.fm artist.getInfo error: ${infoData.message ?? "unknown"}`);
  }

  const artist = infoData.artist;
  const tracksData = tracksRes.ok ? ((await tracksRes.json()) as LastfmTopTracksResponse) : null;
  const topTrack = tracksData?.toptracks?.track?.[0] ?? null;
  const tags = (artist.tags?.tag ?? []).map((t) => t.name);
  const { country, primaryLanguage, vocalType } = inferFromTags(tags);

  return {
    id: makeArtistId(artist.mbid, artist.name),
    name: artist.name,
    imageUrl: bestImage(artist.image),
    creationYear: null,
    memberCount: 1,
    spotifyFollowers: Number.parseInt(artist.stats?.listeners ?? "0", 10) || 0,
    genres: tags.slice(0, 5),
    country,
    vocalType,
    primaryLanguage,
    mostFamousSong: topTrack
      ? { title: topTrack.name, spotifyStreams: Number.parseInt(topTrack.playcount, 10) || 0 }
      : null,
    instrumentation: null,
    appearsOnSoundtracksWith: [],
  };
}
