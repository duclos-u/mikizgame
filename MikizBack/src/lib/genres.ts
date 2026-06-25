const GENRE_MAP: Record<string, string> = {
  // ── Pop ──────────────────────────────────────────────────────────────────────
  pop: "pop",
  "dance-pop": "pop",
  "teen pop": "pop",
  "art pop": "pop",
  "synth-pop": "pop",
  synthpop: "pop",
  electropop: "pop",
  "indie pop": "pop",
  "dream pop": "pop",
  "folk pop": "pop",
  "pop rock": "pop",
  "alternative pop": "pop",
  "chamber pop": "pop",
  "dark pop": "pop",
  hyperpop: "pop",
  "bubblegum pop": "pop",
  "progressive pop": "pop",
  "french pop": "pop",
  "power pop": "pop",
  "jangle pop": "pop",

  // ── Rock ─────────────────────────────────────────────────────────────────────
  rock: "rock",
  "alternative rock": "rock",
  "indie rock": "rock",
  indie: "rock",
  "classic rock": "rock",
  "hard rock": "rock",
  "punk rock": "rock",
  punk: "rock",
  "post-punk": "rock",
  "new wave": "rock",
  "garage rock": "rock",
  "garage rock revival": "rock",
  "post-punk revival": "rock",
  grunge: "rock",
  "progressive rock": "rock",
  "psychedelic rock": "rock",
  "neo-psychedelia": "rock",
  "psychedelic pop": "rock",
  "art rock": "rock",
  "space rock": "rock",
  "noise rock": "rock",
  "soft rock": "rock",
  "arena rock": "rock",
  "blues rock": "rock",
  "roots rock": "rock",
  "post-grunge": "rock",
  emo: "rock",
  "emo-pop": "rock",
  "pop punk": "rock",
  "experimental rock": "rock",
  "gothic rock": "rock",
  rockabilly: "rock",
  "rock and roll": "rock",
  "funk rock": "rock",
  "rap rock": "rock",
  "christian rock": "rock",
  "nu metal": "rock",

  // ── Hip hop ───────────────────────────────────────────────────────────────────
  "hip hop": "hip hop",
  rap: "hip hop",
  trap: "hip hop",
  drill: "hip hop",
  "gangsta rap": "hip hop",
  "boom bap": "hip hop",
  "cloud rap": "hip hop",
  "conscious hip hop": "hip hop",
  "jazz rap": "hip hop",
  "east coast hip hop": "hip hop",
  "west coast hip hop": "hip hop",
  "southern hip hop": "hip hop",
  "hardcore hip hop": "hip hop",
  "experimental hip hop": "hip hop",
  "alternative hip hop": "hip hop",
  "alternative rap": "hip hop",
  horrorcore: "hip hop",
  "pop rap": "hip hop",
  "underground hip hop": "hip hop",
  "g-funk": "hip hop",
  digicore: "hip hop",

  // ── R&B / Soul ────────────────────────────────────────────────────────────────
  "r&b": "r&b",
  soul: "r&b",
  "neo soul": "r&b",
  funk: "r&b",
  "contemporary r&b": "r&b",
  "blue-eyed soul": "r&b",
  "pop soul": "r&b",
  disco: "r&b",
  "trap soul": "r&b",
  "alternative r&b": "r&b",

  // ── Electronic ────────────────────────────────────────────────────────────────
  electronic: "electronic",
  house: "electronic",
  techno: "electronic",
  edm: "electronic",
  dubstep: "electronic",
  "drum and bass": "electronic",
  trance: "electronic",
  electro: "electronic",
  "electro house": "electronic",
  "french house": "electronic",
  "french electro": "electronic",
  indietronica: "electronic",
  "trip hop": "electronic",
  ambient: "electronic",
  "hip house": "electronic",
  dance: "electronic",

  // ── Metal ─────────────────────────────────────────────────────────────────────
  metal: "metal",
  "heavy metal": "metal",
  "death metal": "metal",
  "black metal": "metal",
  "thrash metal": "metal",
  "symphonic metal": "metal",
  "christian metal": "metal",
  "glam metal": "metal",

  // ── Folk / Country / Chanson ──────────────────────────────────────────────────
  folk: "folk",
  country: "folk",
  "singer-songwriter": "folk",
  "singer/songwriter": "folk",
  acoustic: "folk",
  americana: "folk",
  "country pop": "folk",
  "chanson française": "folk",
  chanson: "folk",

  // ── Jazz / Blues ─────────────────────────────────────────────────────────────
  jazz: "jazz",
  blues: "jazz",
  swing: "jazz",
  bebop: "jazz",
  "vocal jazz": "jazz",
  "easy listening": "jazz",
  "adult contemporary": "jazz",

  // ── Classical ────────────────────────────────────────────────────────────────
  classical: "classical",
  opera: "classical",
  orchestral: "classical",
  "romantic classical": "classical",

  // ── Latin ────────────────────────────────────────────────────────────────────
  latin: "latin",
  "latin pop": "latin",
  reggaeton: "latin",
  salsa: "latin",
  "regional mexicano": "latin",
  "corrido tumbado": "latin",

  // ── K-pop / Asian pop ────────────────────────────────────────────────────────
  "k-pop": "k-pop",
  "j-pop": "k-pop",
  "c-pop": "k-pop",
  kpop: "k-pop",

  // ── World ────────────────────────────────────────────────────────────────────
  bollywood: "world",
  filmi: "world",
  "indian pop": "world",
  reggae: "world",
  afrobeats: "world",
  afropop: "world",
};

export function normalizeGenres(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of raw) {
    const broad = GENRE_MAP[tag.toLowerCase().trim()];
    if (broad && !seen.has(broad)) {
      seen.add(broad);
      result.push(broad);
    }
    if (result.length >= 5) break;
  }

  return result;
}
