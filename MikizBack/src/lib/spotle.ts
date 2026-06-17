export type SpotleArtist = {
  id: string;
  name: string;
  imageUrl: string | null;
  creationYear: number | null;
  memberCount: number;
  spotifyFollowers: number;
  genres: string[];
  country: string | null;
  vocalType: string | null;
  primaryLanguage: string | null;
  mostFamousSong: { title: string; spotifyStreams: number } | null;
  instrumentation: string | null;
  appearsOnSoundtracksWith: string[];
};

export type MatchStatus = "match" | "close" | "miss" | "info" | "unknown";

export type ClueResult = {
  key: string;
  label: string;
  value: string;
  status: MatchStatus;
  direction?: "up" | "down";
};

export type SpotleGuess = {
  artist: SpotleArtist;
  clues: ClueResult[];
};

const FOLLOWER_TIERS = [
  { max: 1_000_000, label: "< 1M" },
  { max: 5_000_000, label: "1M–5M" },
  { max: 10_000_000, label: "5M–10M" },
  { max: 50_000_000, label: "10M–50M" },
  { max: Infinity, label: "50M+" },
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

export function compareArtists(
  guess: SpotleArtist,
  target: SpotleArtist,
): ClueResult[] {
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
        diff === null ? "unknown" :
        diff === 0 ? "match" :
        Math.abs(diff) <= 2 ? "close" : "miss",
      direction: diff !== null && diff !== 0 ? (diff > 0 ? "up" : "down") : undefined,
    });
  }

  // 2. Member Count
  const memberDiff = guess.memberCount - target.memberCount;
  clues.push({
    key: "memberCount",
    label: "Membres",
    value: guess.memberCount === 1 ? "Solo" : String(guess.memberCount),
    status: memberDiff === 0 ? "match" : Math.abs(memberDiff) === 1 ? "close" : "miss",
    direction: memberDiff !== 0 ? (memberDiff < 0 ? "up" : "down") : undefined,
  });

  // 3. Popularity (follower tier)
  const gTier = followerTier(guess.spotifyFollowers);
  const tTier = followerTier(target.spotifyFollowers);
  const tierDiff = tTier - gTier;
  clues.push({
    key: "popularity",
    label: "Popularité",
    value: FOLLOWER_TIERS[gTier].label,
    status: tierDiff === 0 ? "match" : Math.abs(tierDiff) === 1 ? "close" : "miss",
    direction: tierDiff !== 0 ? (tierDiff > 0 ? "up" : "down") : undefined,
  });

  // 4. Genres
  const commonGenres = guess.genres.filter((g) => target.genres.includes(g));
  clues.push({
    key: "genres",
    label: "Genres",
    value: guess.genres.slice(0, 3).join(", ") || "?",
    status: guess.genres.length === 0 ? "unknown" : commonGenres.length > 0 ? "match" : "miss",
  });

  // 5. Country
  clues.push({
    key: "country",
    label: "Pays",
    value: guess.country ?? "?",
    status: guess.country === null ? "unknown" : guess.country === target.country ? "match" : "miss",
  });

  // 6. Vocal Type
  clues.push({
    key: "vocalType",
    label: "Voix",
    value: guess.vocalType ?? "?",
    status: guess.vocalType === null ? "unknown" : guess.vocalType === target.vocalType ? "match" : "miss",
  });

  // 7. Primary Language
  clues.push({
    key: "language",
    label: "Langue",
    value: guess.primaryLanguage ?? "?",
    status:
      guess.primaryLanguage === null ? "unknown" :
      guess.primaryLanguage === target.primaryLanguage ? "match" : "miss",
  });

  // 8. Same Soundtrack / collaboration
  const bothHaveData = target.appearsOnSoundtracksWith.length > 0 || guess.appearsOnSoundtracksWith.length > 0;
  const sharedCollab = bothHaveData && (
    target.appearsOnSoundtracksWith.includes(guess.id) ||
    guess.appearsOnSoundtracksWith.includes(target.id)
  );
  clues.push({
    key: "soundtrack",
    label: "Collab",
    value: !bothHaveData ? "?" : sharedCollab ? "Oui" : "Non",
    status: !bothHaveData ? "unknown" : sharedCollab ? "match" : "miss",
  });

  // 9. Most Famous Song (informational)
  clues.push({
    key: "famousSong",
    label: "Hit",
    value: guess.mostFamousSong?.title ?? "?",
    status: "info",
  });

  // 10. Instrumentation
  clues.push({
    key: "instrumentation",
    label: "Son",
    value: guess.instrumentation ?? "?",
    status:
      guess.instrumentation === null ? "unknown" :
      guess.instrumentation === target.instrumentation ? "match" :
      "miss",
  });

  return clues;
}

export function dailySeed(dateStr: string, artistIds: string[]): string | null {
  if (artistIds.length === 0) return null;
  let hash = 0;
  for (const ch of dateStr) hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
  return artistIds[hash % artistIds.length];
}
