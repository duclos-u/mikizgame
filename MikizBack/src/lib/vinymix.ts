export type VinymixArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  creationYear: number | null;
  memberCount: number;
  spotifyFollowers: number;
  spotifyPopularity: number;
  genres: string[];
  gender: string | null;
  country: string | null;
};

export type MatchStatus = "match" | "close" | "miss" | "info" | "unknown";

export type ClueResult = {
  key: string;
  label: string;
  value: string;
  status: MatchStatus;
  direction?: "up" | "down";
};

export type VinymixGuess = {
  artist: VinymixArtist;
  clues: ClueResult[];
};

const FOLLOWER_TIERS = [
  { max: 1_000_000, label: "< 1M" },
  { max: 5_000_000, label: "1M–5M" },
  { max: 10_000_000, label: "5M–10M" },
  { max: 50_000_000, label: "10M–50M" },
  { max: Number.POSITIVE_INFINITY, label: "50M+" },
];

export function followerTier(n: number): number {
  for (let i = 0; i < FOLLOWER_TIERS.length; i++) {
    if (n < FOLLOWER_TIERS[i].max) return i;
  }
  return FOLLOWER_TIERS.length - 1;
}

export function followerTierLabel(n: number): string {
  return FOLLOWER_TIERS[followerTier(n)].label;
}

const POPULARITY_TIERS = [
  { max: 30,  label: "Peu connu" },
  { max: 50,  label: "Connu" },
  { max: 65,  label: "Populaire" },
  { max: 80,  label: "Très populaire" },
  { max: 101, label: "Star interplanétaire" },
];

export function popularityTier(n: number): number {
  for (let i = 0; i < POPULARITY_TIERS.length; i++) {
    if (n < POPULARITY_TIERS[i].max) return i;
  }
  return POPULARITY_TIERS.length - 1;
}

export function popularityTierLabel(n: number): string {
  return POPULARITY_TIERS[popularityTier(n)].label;
}

export function compareArtists(guess: VinymixArtist, target: VinymixArtist): ClueResult[] {
  const clues: ClueResult[] = [];

  // 1. Creation Year
  if (guess.creationYear === null) {
    clues.push({ key: "creationYear", label: "Année", value: "?", status: "unknown" });
  } else {
    const diff = target.creationYear !== null ? target.creationYear - guess.creationYear : null;
    clues.push({
      key: "creationYear",
      label: "Année",
      value: String(guess.creationYear),
      status:
        diff === null ? "unknown" : diff === 0 ? "match" : Math.abs(diff) <= 2 ? "close" : "miss",
      direction: diff !== null && diff !== 0 ? (diff > 0 ? "up" : "down") : undefined,
    });
  }

  // 2. Country
  clues.push({
    key: "country",
    label: "Pays",
    value: guess.country ?? "?",
    status: guess.country === null ? "unknown" : guess.country === target.country ? "match" : "miss",
  });

  // 3. Member Count
  const memberDiff = guess.memberCount - target.memberCount;
  clues.push({
    key: "memberCount",
    label: "Membres",
    value: guess.memberCount === 1 ? "Solo" : String(guess.memberCount),
    status: memberDiff === 0 ? "match" : Math.abs(memberDiff) === 1 ? "close" : "miss",
    direction: memberDiff !== 0 ? (memberDiff < 0 ? "up" : "down") : undefined,
  });

  // 3. Popularity (Spotify popularity score tier)
  const gTier = popularityTier(guess.spotifyPopularity);
  const tTier = popularityTier(target.spotifyPopularity);
  const tierDiff = tTier - gTier;
  clues.push({
    key: "popularity",
    label: "Popularité",
    value: POPULARITY_TIERS[gTier].label,
    status: tierDiff === 0 ? "match" : Math.abs(tierDiff) === 1 ? "close" : "miss",
    direction: tierDiff !== 0 ? (tierDiff > 0 ? "up" : "down") : undefined,
  });

  // 4. Genres (one pill per genre)
  if (guess.genres.length === 0) {
    clues.push({ key: "genre-0", label: "Genre", value: "?", status: "unknown" });
  } else {
    for (let i = 0; i < Math.min(guess.genres.length, 2); i++) {
      const g = guess.genres[i];
      clues.push({
        key: `genre-${i}`,
        label: "Genre",
        value: g,
        status: target.genres.includes(g) ? "match" : "miss",
      });
    }
  }

  // 5. Gender
  clues.push({
    key: "gender",
    label: "Sexe",
    value: guess.gender ?? "?",
    status: guess.gender === null ? "unknown" : guess.gender === target.gender ? "match" : "miss",
  });

  return clues;
}

export function dailySeed(dateStr: string, artistIds: string[]): string | null {
  if (artistIds.length === 0) return null;
  let hash = 0;
  for (const ch of dateStr) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return artistIds[hash % artistIds.length];
}
