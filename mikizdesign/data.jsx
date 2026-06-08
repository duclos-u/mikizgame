// data.jsx — game catalog, semantic word map for Sémantik, mock users & leaderboards.
// Everything is attached to window at the bottom for cross-script access.

// ---------------------------------------------------------------------------
// GAME CATALOG
// Each game carries a signature hue (oklch) so the shell stays neutral and the
// games bring the color. Accents share lightness/chroma, vary hue.
// ---------------------------------------------------------------------------
const GAMES = [
  {
    id: "semantik",
    name: "Sémantik",
    tagline: "Trouve le mot secret à l'instinct",
    blurb: "Devine le mot du jour grâce à la proximité de sens. Plus tu chauffes, plus tu approches.",
    hue: 45,
    glyph: "🌡️",
    status: "live",
    category: "Mots · Sémantique",
    players: 4821,
    avgTries: 38,
    accent: "oklch(0.74 0.16 45)",
  },
  {
    id: "lexio",
    name: "Lexio",
    tagline: "La grille de mots quotidienne",
    blurb: "Six essais pour retrouver le mot caché. Les lettres bien placées s'allument.",
    hue: 152,
    glyph: "🟩",
    status: "live",
    category: "Mots · Grille",
    players: 6390,
    avgTries: 4,
    accent: "oklch(0.74 0.16 152)",
  },
  {
    id: "cinedle",
    name: "Cinédle",
    tagline: "Un jour, un film à deviner",
    blurb: "L'affiche se dévoile floutée. Reconnais le film avant les autres cinéphiles.",
    hue: 292,
    glyph: "🎬",
    status: "live",
    category: "Cinéma",
    players: 3517,
    avgTries: 5,
    accent: "oklch(0.74 0.16 292)",
  },
  {
    id: "geodle",
    name: "Géodle",
    tagline: "Le pays mystère du jour",
    blurb: "Sa silhouette, ses indices. Trouve le pays en un minimum de coups.",
    hue: 232,
    glyph: "🗺️",
    status: "soon",
    category: "Géographie",
    players: 0,
    avgTries: 0,
    accent: "oklch(0.74 0.16 232)",
  },
  {
    id: "sondle",
    name: "Sondle",
    tagline: "Devine le titre à l'oreille",
    blurb: "Quelques secondes d'intro. Nomme le morceau avant la fin du refrain.",
    hue: 352,
    glyph: "🎵",
    status: "soon",
    category: "Musique",
    players: 0,
    avgTries: 0,
    accent: "oklch(0.74 0.16 352)",
  },
];

// ---------------------------------------------------------------------------
// SÉMANTIK — semantic proximity model (offline fake of word2vec).
// Secret word of the day + a curated map of words → temperature (0..100).
// 100 = the answer. Unknown words get a stable, cold pseudo-random score.
// ---------------------------------------------------------------------------
const SECRET_WORD = "soleil";

// score is a 0..100 "temperature". Higher = closer in meaning.
const PROXIMITY = {
  soleil: 100,
  soleils: 92, solaire: 85,
  étoile: 78, astre: 76, lune: 72, lumière: 70, ciel: 67,
  rayon: 66, planète: 64, chaleur: 63, briller: 61, terre: 60,
  éclat: 58, jour: 57, clarté: 56, lever: 55, coucher: 54,
  éclipse: 53, été: 52, chaud: 51, ensoleillé: 50, ombre: 49,
  aube: 48, crépuscule: 47, horizon: 46, midi: 45, nuage: 44,
  feu: 43, bronzer: 42, plage: 41, brûler: 40, galaxie: 39,
  espace: 38, univers: 37, système: 36, saison: 35, printemps: 34,
  matin: 33, soir: 32, nuit: 31, mer: 29, vacances: 28,
  sable: 27, lumineux: 30, météo: 26, vent: 22, ciels: 25,
  pluie: 20, hiver: 18, neige: 14, froid: 12, glace: 10,
  // clearly cold examples to make "froid/glacial" tiers obvious
  voiture: 4, ordinateur: 3, table: 2, chaise: 2, politique: 1,
  banane: 3, téléphone: 2, cravate: 1, brouette: 1,
};

// Strip diacritics + lowercase so "etoile" matches "étoile".
function normalizeWord(w) {
  return (w || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

// Build a normalized lookup once.
const NORM_PROX = {};
Object.keys(PROXIMITY).forEach((k) => {
  NORM_PROX[normalizeWord(k)] = { display: k, score: PROXIMITY[k] };
});

// Deterministic small "cold" score for unknown words, so the same guess always
// returns the same temperature (feels like a real model, never 0 twice the same).
function coldHash(norm) {
  let h = 0;
  for (let i = 0; i < norm.length; i++) h = (h * 31 + norm.charCodeAt(i)) >>> 0;
  return -2 + (h % 900) / 100; // ~ -2 .. +7
}

// Returns { display, score, known } for a raw guess, or null if empty/invalid.
function scoreGuess(raw) {
  const norm = normalizeWord(raw);
  if (!norm) return null;
  const hit = NORM_PROX[norm];
  if (hit) return { display: hit.display, score: hit.score, known: true, norm };
  return {
    display: raw.toLowerCase().trim(),
    score: Math.round(coldHash(norm) * 10) / 10,
    known: false,
    norm,
  };
}

// Temperature tiers → label + emoji + color stop.
function tierFor(score) {
  if (score >= 100) return { label: "TROUVÉ", emoji: "🎉", t: 1 };
  if (score >= 60) return { label: "Brûlant", emoji: "🔥", t: 0.92 };
  if (score >= 45) return { label: "Très chaud", emoji: "🥵", t: 0.78 };
  if (score >= 30) return { label: "Chaud", emoji: "😎", t: 0.6 };
  if (score >= 18) return { label: "Tiède", emoji: "🙂", t: 0.42 };
  if (score >= 8) return { label: "Frais", emoji: "😐", t: 0.28 };
  if (score >= 1) return { label: "Froid", emoji: "🥶", t: 0.14 };
  return { label: "Glacial", emoji: "🧊", t: 0.05 };
}

// ---------------------------------------------------------------------------
// USERS + LEADERBOARDS (mock)
// ---------------------------------------------------------------------------
const ME = { id: "me", name: "Mikiz", initials: "MK", color: "oklch(0.74 0.16 45)", friend: true };

function mk(id, name, color, friend) {
  const initials = name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return { id, name, initials, color, friend };
}

const USERS = [
  ME,
  mk("u1", "Léa", "oklch(0.74 0.16 152)", true),
  mk("u2", "Tom B.", "oklch(0.74 0.16 292)", true),
  mk("u3", "Nadia", "oklch(0.74 0.16 232)", false),
  mk("u4", "Sacha", "oklch(0.74 0.16 352)", true),
  mk("u5", "Inès", "oklch(0.74 0.16 110)", false),
  mk("u6", "Hugo", "oklch(0.74 0.16 20)", false),
  mk("u7", "Camille", "oklch(0.74 0.16 200)", true),
  mk("u8", "Yanis", "oklch(0.74 0.16 320)", false),
  mk("u9", "Manon", "oklch(0.74 0.16 60)", false),
  mk("u10", "Rayan", "oklch(0.74 0.16 170)", false),
  mk("u11", "Jade", "oklch(0.74 0.16 260)", false),
];

const usersById = Object.fromEntries(USERS.map((u) => [u.id, u]));

// Build a leaderboard for a game. For Sémantik the score metric is "essais"
// (fewer is better) + time; we generate plausible numbers.
function seededRows(gameId, scope) {
  const base = gameId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const salt = scope === "all" ? 7 : 1;
  return USERS.map((u, i) => {
    const seed = (base + i * 13 + salt * 5) % 97;
    const tries = 6 + (seed % 70); // essais
    const seconds = 120 + (seed * 7) % 900;
    const streak = scope === "all" ? 4 + (seed % 60) : (seed % 12);
    const plays = scope === "all" ? 40 + (seed % 220) : 1;
    const winRate = 70 + (seed % 30);
    return { user: u, tries, seconds, streak, plays, winRate };
  });
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function leaderboard(gameId, scope, friendsOnly) {
  let rows = seededRows(gameId, scope);
  if (friendsOnly) rows = rows.filter((r) => r.user.friend);
  // sort: fewer tries, then faster time; all-time sorts by streak then winrate
  if (scope === "all") {
    rows.sort((a, b) => b.streak - a.streak || b.winRate - a.winRate);
  } else {
    rows.sort((a, b) => a.tries - b.tries || a.seconds - b.seconds);
  }
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// "Puzzle number" for the day — fun flavor, deterministic-ish.
const PUZZLE_NO = 412;
const TODAY_LABEL = "Mardi 2 juin 2026";

Object.assign(window, {
  GAMES,
  SECRET_WORD,
  scoreGuess,
  tierFor,
  normalizeWord,
  USERS,
  usersById,
  ME,
  leaderboard,
  fmtTime,
  PUZZLE_NO,
  TODAY_LABEL,
});
