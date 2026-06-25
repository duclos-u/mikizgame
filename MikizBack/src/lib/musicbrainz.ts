const MB_BASE = "https://musicbrainz.org/ws/2";
const MB_UA = "MikizStack/1.0 (https://github.com/mikizstack)";

export type MBArtistInfo = {
  creationYear: number | null;
  gender: string | null;
  country: string | null;
  genres: string[];
  type: string | null;
  memberCount: number | null;
};

type MBSearchArtist = {
  id: string;
  name: string;
  score?: number;
  type?: string | null;
  gender?: string | null;
  country?: string | null;
  "life-span"?: { begin?: string | null };
  tags?: Array<{ name: string; count: number }>;
};

type MBRelation = {
  type: string;
  direction: string;
  ended?: boolean;
  artist?: { id?: string; gender?: string | null };
};

type MBFullArtist = {
  relations?: MBRelation[];
};

type MBArtistDetail = {
  gender?: string | null;
};

const EMPTY: MBArtistInfo = {
  creationYear: null,
  gender: null,
  country: null,
  genres: [],
  type: null,
  memberCount: null,
};

async function mbFetch<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": MB_UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}

async function resolveGroupGender(mbid: string): Promise<{ gender: string | null; memberCount: number | null }> {
  await new Promise((r) => setTimeout(r, 1100));
  const full = await mbFetch<MBFullArtist>(`${MB_BASE}/artist/${mbid}?inc=artist-rels&fmt=json`);

  const relations = full?.relations ?? [];
  const isMember = (r: MBRelation) => r.type === "member of band" && r.direction === "backward";

  const currentMembers = relations.filter((r) => isMember(r) && !r.ended);
  const originalMembers = relations.filter((r) => isMember(r) && r.ended);

  // Prefer current members; fall back to original/past members for defunct bands
  const members = currentMembers.length > 0 ? currentMembers : originalMembers;
  if (members.length === 0) return { gender: null, memberCount: null };

  const memberIds = members.map((r) => r.artist?.id).filter((id): id is string => !!id);
  if (memberIds.length === 0) return { gender: null, memberCount: members.length };

  // Look up each member individually to get reliable gender data
  const genders: string[] = [];
  for (const memberId of memberIds.slice(0, 8)) {
    await new Promise((r) => setTimeout(r, 1100));
    const detail = await mbFetch<MBArtistDetail>(`${MB_BASE}/artist/${memberId}?fmt=json`);
    const g = detail?.gender?.toLowerCase();
    if (g) genders.push(g);
  }

  let gender: string | null = null;
  if (genders.length > 0) {
    const allMale = genders.every((g) => g === "male");
    const allFemale = genders.every((g) => g === "female");
    gender = allMale ? "male" : allFemale ? "female" : "mixed";
  }

  return { gender, memberCount: members.length };
}

export type MBCountryCandidate = {
  name: string;
  score: number;
  type: string | null;
};

export async function searchArtistsByCountry(
  countryCode: string,
  offset: number,
): Promise<MBCountryCandidate[]> {
  const data = await mbFetch<{ artists?: MBSearchArtist[] }>(
    `${MB_BASE}/artist?query=country:${countryCode}&limit=100&offset=${offset}&fmt=json`,
  );
  return (data?.artists ?? []).map((a) => ({
    name: a.name,
    score: a.score ?? 0,
    type: a.type ?? null,
  }));
}

export async function fetchMusicBrainzArtist(name: string): Promise<MBArtistInfo> {
  const data = await mbFetch<{ artists?: MBSearchArtist[] }>(
    `${MB_BASE}/artist?query=artist:${encodeURIComponent(name)}&limit=1&fmt=json`,
  );

  const top = data?.artists?.[0];
  if (!top || (top.score ?? 0) < 60) return EMPTY;

  const beginStr = top["life-span"]?.begin ?? null;
  const creationYear = beginStr ? Number(beginStr.slice(0, 4)) || null : null;
  const country = top.country ?? null;
  const type = top.type ?? null;
  const genres = (top.tags ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((t) => t.name);

  if (type === "Person") {
    return {
      creationYear,
      gender: top.gender?.toLowerCase() ?? null,
      country,
      genres,
      type,
      memberCount: 1,
    };
  }

  // For groups, derive gender from current members
  const { gender, memberCount } = await resolveGroupGender(top.id);
  return { creationYear, gender, country, genres, type, memberCount };
}
