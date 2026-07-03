#!/usr/bin/env bun
/**
 * Fetch the most famous footballers from API-Football and regenerate src/data/footballers.json.
 *
 * Strategy (~17 requests out of 100/day limit):
 *   - topscorers × 7 leagues      → offensive players across all leagues
 *   - topassists × 7 leagues      → midfielders + secondary attackers
 *   - /players?team=X × 5 clubs   → ensures elite GKs/defenders are included
 *
 * Requires: API_FOOTBALL_KEY in .env
 *
 * Usage:
 *   bun run scripts/fetch-footballers.ts
 *   FOOTBALL_SEASON=2025 bun run scripts/fetch-footballers.ts
 *   DRY_RUN=1 bun run scripts/fetch-footballers.ts   # prints JSON, does not write file
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const API_KEY = process.env.API_FOOTBALL_KEY;
const SEASON = process.env.FOOTBALL_SEASON ?? "2024";
const DRY_RUN = process.env.DRY_RUN === "1";
const OUT_PATH = join(import.meta.dir, "../src/data/footballers.json");
const BASE_URL = "https://v3.football.api-sports.io";

if (!API_KEY) {
  console.error("❌  Missing API_FOOTBALL_KEY in environment.");
  console.error("    Add it to .env: API_FOOTBALL_KEY=your_key_here");
  console.error("    Get a key at https://dashboard.api-football.com/");
  process.exit(1);
}

// ─── League config ─────────────────────────────────────────────────────────────

const LEAGUES = [
  { id: 39, name: "Premier League", ligueLabel: "Premier League", prestige: 100 },
  { id: 140, name: "La Liga", ligueLabel: "La Liga", prestige: 97 },
  { id: 78, name: "Bundesliga", ligueLabel: "Bundesliga", prestige: 93 },
  { id: 135, name: "Serie A", ligueLabel: "Serie A", prestige: 93 },
  { id: 61, name: "Ligue 1", ligueLabel: "Ligue 1", prestige: 88 },
  { id: 307, name: "Saudi Pro League", ligueLabel: "Saudi Pro League", prestige: 73 },
  { id: 253, name: "MLS", ligueLabel: "MLS", prestige: 65 },
] as const;

// Teams fetched directly to ensure elite GKs & defenders are captured
const TOP_CLUBS_FOR_SQUAD = [
  { id: 541, label: "Real Madrid" }, // Courtois, Rüdiger, Alexander-Arnold, Bellingham
  { id: 40, label: "Liverpool" }, // Alisson, van Dijk, Robertson
  { id: 50, label: "Manchester City" }, // Ederson, Dias, Gvardiol, Rodri
  { id: 85, label: "PSG" }, // Donnarumma, Marquinhos, Hakimi
  { id: 157, label: "Bayern Munich" }, // Neuer, Upamecano, Musiala, Wirtz/Sané
] as const;

const LEAGUE_PRESTIGE: Record<number, number> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, l.prestige]),
);

// ─── Translation tables ────────────────────────────────────────────────────────

const NATIONALITY_FR: Record<string, string> = {
  France: "France",
  England: "Angleterre",
  Spain: "Espagne",
  Germany: "Allemagne",
  Portugal: "Portugal",
  Italy: "Italie",
  Belgium: "Belgique",
  Netherlands: "Pays-Bas",
  Croatia: "Croatie",
  Austria: "Autriche",
  Scotland: "Écosse",
  Georgia: "Géorgie",
  Norway: "Norvège",
  Poland: "Pologne",
  Sweden: "Suède",
  Switzerland: "Suisse",
  Denmark: "Danemark",
  "Czech Republic": "République tchèque",
  Czechia: "République tchèque",
  Slovakia: "Slovaquie",
  Serbia: "Serbie",
  Turkey: "Turquie",
  Ukraine: "Ukraine",
  "Bosnia and Herzegovina": "Bosnie-Herzégovine",
  Albania: "Albanie",
  Wales: "Pays de Galles",
  Hungary: "Hongrie",
  Greece: "Grèce",
  Romania: "Roumanie",
  Russia: "Russie",
  Slovenia: "Slovénie",
  Montenegro: "Monténégro",
  "North Macedonia": "Macédoine du Nord",
  Finland: "Finlande",
  Ireland: "Irlande",
  Iceland: "Islande",
  Luxembourg: "Luxembourg",
  Brazil: "Brésil",
  Argentina: "Argentine",
  Uruguay: "Uruguay",
  Colombia: "Colombie",
  Chile: "Chili",
  Peru: "Pérou",
  Ecuador: "Équateur",
  Venezuela: "Venezuela",
  Paraguay: "Paraguay",
  Bolivia: "Bolivie",
  "United States": "États-Unis",
  USA: "États-Unis",
  Canada: "Canada",
  Mexico: "Mexique",
  "Costa Rica": "Costa Rica",
  Jamaica: "Jamaïque",
  Honduras: "Honduras",
  Egypt: "Égypte",
  Morocco: "Maroc",
  Nigeria: "Nigeria",
  Senegal: "Sénégal",
  "Ivory Coast": "Côte d'Ivoire",
  Algeria: "Algérie",
  Ghana: "Ghana",
  Cameroon: "Cameroun",
  "Congo DR": "RD Congo",
  "DR Congo": "RD Congo",
  "Democratic Republic of Congo": "RD Congo",
  Mali: "Mali",
  Guinea: "Guinée",
  "Guinea Bissau": "Guinée-Bissau",
  "Burkina Faso": "Burkina Faso",
  Gabon: "Gabon",
  Angola: "Angola",
  Benin: "Bénin",
  Togo: "Togo",
  Tunisia: "Tunisie",
  "South Korea": "Corée du Sud",
  "Korea Republic": "Corée du Sud",
  Japan: "Japon",
  "Saudi Arabia": "Arabie Saoudite",
  Iran: "Iran",
  Australia: "Australie",
  Iraq: "Irak",
};

const CONFEDERATION_MAP: Record<string, string> = {
  France: "UEFA",
  England: "UEFA",
  Spain: "UEFA",
  Germany: "UEFA",
  Portugal: "UEFA",
  Italy: "UEFA",
  Belgium: "UEFA",
  Netherlands: "UEFA",
  Croatia: "UEFA",
  Austria: "UEFA",
  Scotland: "UEFA",
  Georgia: "UEFA",
  Norway: "UEFA",
  Poland: "UEFA",
  Sweden: "UEFA",
  Switzerland: "UEFA",
  Denmark: "UEFA",
  "Czech Republic": "UEFA",
  Czechia: "UEFA",
  Slovakia: "UEFA",
  Serbia: "UEFA",
  Turkey: "UEFA",
  Ukraine: "UEFA",
  "Bosnia and Herzegovina": "UEFA",
  Albania: "UEFA",
  Wales: "UEFA",
  Hungary: "UEFA",
  Greece: "UEFA",
  Romania: "UEFA",
  Russia: "UEFA",
  Slovenia: "UEFA",
  Montenegro: "UEFA",
  "North Macedonia": "UEFA",
  Finland: "UEFA",
  Ireland: "UEFA",
  Iceland: "UEFA",
  Luxembourg: "UEFA",
  Brazil: "CONMEBOL",
  Argentina: "CONMEBOL",
  Uruguay: "CONMEBOL",
  Colombia: "CONMEBOL",
  Chile: "CONMEBOL",
  Peru: "CONMEBOL",
  Ecuador: "CONMEBOL",
  Venezuela: "CONMEBOL",
  Paraguay: "CONMEBOL",
  Bolivia: "CONMEBOL",
  "United States": "CONCACAF",
  USA: "CONCACAF",
  Mexico: "CONCACAF",
  Canada: "CONCACAF",
  "Costa Rica": "CONCACAF",
  Jamaica: "CONCACAF",
  Honduras: "CONCACAF",
  Egypt: "CAF",
  Morocco: "CAF",
  Nigeria: "CAF",
  Senegal: "CAF",
  "Ivory Coast": "CAF",
  Algeria: "CAF",
  Ghana: "CAF",
  Cameroon: "CAF",
  "Congo DR": "CAF",
  "DR Congo": "CAF",
  "Democratic Republic of Congo": "CAF",
  Mali: "CAF",
  Guinea: "CAF",
  "Guinea Bissau": "CAF",
  "Burkina Faso": "CAF",
  Gabon: "CAF",
  Angola: "CAF",
  Benin: "CAF",
  Togo: "CAF",
  Tunisia: "CAF",
  "South Korea": "AFC",
  "Korea Republic": "AFC",
  Japan: "AFC",
  "Saudi Arabia": "AFC",
  Iran: "AFC",
  Australia: "AFC",
  Iraq: "AFC",
};

const POSITION_FR: Record<string, string> = {
  Goalkeeper: "Gardien",
  Defender: "Défenseur",
  Midfielder: "Milieu",
  Attacker: "Attaquant",
};

const CLUB_NORMALIZE: Record<string, string> = {
  "Paris Saint-Germain": "PSG",
  "FC Bayern München": "Bayern Munich",
  "Bayern München": "Bayern Munich",
  "Atlético Madrid": "Atlético Madrid",
  "Atletico Madrid": "Atlético Madrid",
  Inter: "Inter Milan",
  "FC Internazionale": "Inter Milan",
  Internazionale: "Inter Milan",
  "AS Roma": "Roma",
  "SS Lazio": "Lazio",
  "SSC Napoli": "Napoli",
  "Borussia Dortmund": "Dortmund",
  "RB Leipzig": "Leipzig",
  "Bayer Leverkusen": "Leverkusen",
  "Tottenham Hotspur": "Tottenham",
  "Newcastle United": "Newcastle",
  "West Ham United": "West Ham",
  "Wolverhampton Wanderers": "Wolves",
  "Al-Nassr": "Al-Nassr",
  "Al Nassr": "Al-Nassr",
  "Al-Ittihad": "Al-Ittihad",
  "Al Ittihad": "Al-Ittihad",
  "Al-Hilal": "Al-Hilal",
  "Al Hilal": "Al-Hilal",
  "Al-Ahli": "Al-Ahli",
  "Al Ahli": "Al-Ahli",
  "Inter Miami CF": "Inter Miami",
  "CF Montreal": "CF Montréal",
};

// ─── API types ─────────────────────────────────────────────────────────────────

type ApiStatistics = {
  team: { id: number; name: string };
  league: { id: number; name: string; season: number };
  games: {
    appearances: number;
    lineups: number;
    minutes: number | null;
    position: string;
    rating: string | null;
    captain: boolean;
  };
  goals: { total: number | null; assists: number | null };
  shots: { total: number | null; on: number | null };
  passes: { total: number | null; key: number | null; accuracy: number | null };
  tackles: { total: number | null; blocks: number | null; interceptions: number | null };
  duels: { total: number | null; won: number | null };
  dribbles: { attempts: number | null; success: number | null };
  cards: { yellow: number; yellowred: number; red: number };
  penalty: { won: number | null; committed: number | null; scored: number; missed: number };
};

type ApiPlayer = {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: { date: string | null; place: string | null; country: string | null };
    nationality: string;
    height: string | null;
    weight: string | null;
    photo: string;
    injured: boolean;
  };
  statistics: ApiStatistics[];
};

type ApiResponse<T> = {
  response: T[];
  results: number;
  errors: unknown;
  paging: { current: number; total: number };
};

// ─── Fetch helper ──────────────────────────────────────────────────────────────

let requestCount = 0;

async function apiGet<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  requestCount++;
  process.stdout.write(
    `  [req ${String(requestCount).padStart(2, "0")}] GET /${path}?${url.searchParams} … `,
  );

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_KEY as string },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`HTTP ${res.status}: ${text}`);
    return [];
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    console.error(`API error: ${JSON.stringify(json.errors)}`);
    return [];
  }

  console.log(`${json.results} results`);
  return json.response;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function normalizeClub(raw: string): string {
  return CLUB_NORMALIZE[raw] ?? raw;
}

function normalizeNationality(raw: string): string {
  return NATIONALITY_FR[raw] ?? raw;
}

function getConfederation(nationality: string): string {
  return CONFEDERATION_MAP[nationality] ?? "UEFA";
}

function parseHeight(h: string | null): number | null {
  if (!h) return null;
  const m = h.match(/(\d+)/);
  return m ? Number.parseInt(m[1], 10) : null;
}

// Pick the statistics row from the most-played league for the target season
function pickBestStats(stats: ApiStatistics[]): ApiStatistics | null {
  const season = Number.parseInt(SEASON, 10);
  const inSeason = stats.filter((s) => s.league.season === season);
  if (inSeason.length === 0) return stats[0] ?? null;
  return inSeason.sort((a, b) => (b.games.appearances ?? 0) - (a.games.appearances ?? 0))[0];
}

function popularityScore(stats: ApiStatistics, leaguePrestige: number): number {
  const rating = Number.parseFloat(stats.games.rating ?? "7.0");
  const apps = Math.min(stats.games.appearances ?? 0, 30);
  const goals = stats.goals.total ?? 0;
  const assists = stats.goals.assists ?? 0;
  const prestige = leaguePrestige / 100;

  // rating drives 70% (captures defensive/GK quality), goals/assists 20%, appearances 10%
  const raw =
    rating * 10 * prestige * 0.7 +
    (goals + assists * 0.6) * prestige * 0.35 +
    (apps / 30) * prestige * 10;

  return Math.min(100, Math.max(1, Math.round(raw)));
}

// ─── Data collection ───────────────────────────────────────────────────────────

console.log(`\n⚽  Fetching top footballers — season ${SEASON}\n`);

const seen = new Map<
  number,
  { player: ApiPlayer["player"]; stats: ApiStatistics; leaguePrestige: number }
>();

function addPlayer(entry: ApiPlayer, leaguePrestige: number) {
  const { player, statistics } = entry;
  if (!statistics || statistics.length === 0) return;

  const bestStats = pickBestStats(statistics);
  if (!bestStats) return;

  const existing = seen.get(player.id);
  // Keep the entry from the more prestigious / more-appearance league
  if (existing) {
    const existingApps = existing.stats.games.appearances ?? 0;
    const newApps = bestStats.games.appearances ?? 0;
    if (leaguePrestige < existing.leaguePrestige || newApps <= existingApps) return;
  }

  seen.set(player.id, { player, stats: bestStats, leaguePrestige });
}

// 1. topscorers + topassists per league
for (const league of LEAGUES) {
  for (const endpoint of ["players/topscorers", "players/topassists"] as const) {
    const results = await apiGet<ApiPlayer>(endpoint, {
      league: league.id,
      season: SEASON,
    });
    for (const entry of results) addPlayer(entry, league.prestige);
    await sleep(250);
  }
}

// 2. Squad pages for elite clubs (page 1 only) — catches GKs/defenders
console.log("\n  — fetching elite club squads for GKs & defenders —\n");
for (const club of TOP_CLUBS_FOR_SQUAD) {
  const results = await apiGet<ApiPlayer>("players", {
    team: club.id,
    season: SEASON,
    page: 1,
  });
  // Use league prestige from the best league this team plays in (mapped by team stats)
  for (const entry of results) {
    const bestStats = pickBestStats(entry.statistics);
    const leaguePrestige = bestStats ? (LEAGUE_PRESTIGE[bestStats.league.id] ?? 90) : 90;
    addPlayer(entry, leaguePrestige);
  }
  await sleep(250);
}

console.log(`\n✓  Collected ${seen.size} unique players across all sources\n`);

// ─── Build final dataset ───────────────────────────────────────────────────────

type FootballerRecord = {
  prenom: string;
  nom: string;
  nationalite: string;
  confederation: string;
  poste: string;
  club: string;
  ligue: string;
  naissance: number | null;
  popularityScore: number;
  // enriched fields
  playerId: number;
  photo: string;
  height: number | null;
  apparitions: number;
  buts: number;
  assists: number;
  note: string | null;
  yellowCards: number;
  redCards: number;
  minutesJouees: number | null;
};

const joueurs: FootballerRecord[] = [];

for (const { player, stats, leaguePrestige } of seen.values()) {
  const posteEn = stats.games.position ?? "";
  const poste = POSITION_FR[posteEn] ?? "Milieu";
  const club = normalizeClub(stats.team.name);
  const ligue = stats.league.name;
  const nationalityEn = player.nationality ?? "";
  const nationalite = normalizeNationality(nationalityEn);
  const confederation = getConfederation(nationalityEn);

  let naissance: number | null = null;
  if (player.birth?.date) {
    const year = Number.parseInt(player.birth.date.slice(0, 4), 10);
    if (!Number.isNaN(year)) naissance = year;
  }

  const score = popularityScore(stats, leaguePrestige);

  joueurs.push({
    prenom: player.firstname || player.name.split(" ")[0],
    nom: player.lastname || player.name.split(" ").slice(1).join(" "),
    nationalite,
    confederation,
    poste,
    club,
    ligue,
    naissance,
    popularityScore: score,
    // enriched
    playerId: player.id,
    photo: player.photo,
    height: parseHeight(player.height),
    apparitions: stats.games.appearances ?? 0,
    buts: stats.goals.total ?? 0,
    assists: stats.goals.assists ?? 0,
    note: stats.games.rating ? Number.parseFloat(stats.games.rating).toFixed(2) : null,
    yellowCards: stats.cards.yellow ?? 0,
    redCards: stats.cards.red ?? 0,
    minutesJouees: stats.games.minutes ?? null,
  });
}

// Sort by popularity score descending
joueurs.sort((a, b) => b.popularityScore - a.popularityScore);

// ─── Summary ───────────────────────────────────────────────────────────────────

console.log("Top 20 players by popularity score:");
for (const j of joueurs.slice(0, 20)) {
  console.log(
    `  ${String(j.popularityScore).padStart(3)}  ${`${j.prenom} ${j.nom}`.padEnd(28)}  ${j.poste.padEnd(12)}  ${j.club.padEnd(22)}  ${j.nationalite}`,
  );
}

const posteCount = joueurs.reduce<Record<string, number>>((acc, j) => {
  acc[j.poste] = (acc[j.poste] ?? 0) + 1;
  return acc;
}, {});

console.log(`\nTotal: ${joueurs.length} players`);
console.log(`Positions: ${JSON.stringify(posteCount)}`);
console.log(`Requests used: ${requestCount}`);

// ─── Write output ─────────────────────────────────────────────────────────────

const output = { joueurs };
const json = JSON.stringify(output, null, 2);

if (DRY_RUN) {
  console.log("\nDRY_RUN=1 — not writing file. Preview of first 3 entries:");
  console.log(JSON.stringify(joueurs.slice(0, 3), null, 2));
} else {
  await writeFile(OUT_PATH, json, "utf-8");
  console.log(`\n✅  Written to ${OUT_PATH}`);
  console.log("    Run `bun footballers:schedule 30` to schedule the next 30 days.");
}

process.exit(0);
