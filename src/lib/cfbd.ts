const CFBD_BASE = "https://api.collegefootballdata.com";
/** Cache tag busted by Sunday cron at /api/refresh. */
export const CFBD_CACHE_TAG = "cfbd-season";
/** Safety-net revalidate if cron misses (36h). */
const REVALIDATE_SECONDS = 60 * 60 * 36;

export type CfbdClassification = "fbs" | "fcs" | string;

export interface CfbdTeam {
  id: number;
  school: string;
  mascot: string | null;
  abbreviation: string | null;
  conference: string | null;
  classification: CfbdClassification | null;
  color?: string | null;
  alt_color?: string | null;
  logos: string[] | null;
}

export interface CfbdGame {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  completed: boolean;
  neutralSite: boolean;
  conferenceGame: boolean;
  homeId: number;
  homeTeam: string;
  homePoints: number | null;
  /** True when the home side is an FBS program (CFBD). */
  homeFbs?: boolean;
  awayId: number;
  awayTeam: string;
  awayPoints: number | null;
  /** True when the away side is an FBS program (CFBD). */
  awayFbs?: boolean;
}

export interface CfbdRecord {
  year: number;
  teamId: number;
  team: string;
  conference: string | null;
  division: string | null;
  classification: CfbdClassification | null;
  total: {
    games: number;
    wins: number;
    losses: number;
    ties: number;
  };
}

export interface CfbdSeasonData {
  season: number;
  fetchedAt: string;
  teams: CfbdTeam[];
  fbsTeamIds: number[];
  games: CfbdGame[];
  records: CfbdRecord[];
}

function getApiKey(): string {
  const key = process.env.CFBD_API_KEY;
  if (!key) {
    throw new Error(
      "Missing CFBD_API_KEY. Copy .env.example to .env.local and add your key from collegefootballdata.com.",
    );
  }
  return key;
}

async function cfbdFetch<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${CFBD_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    },
    next: { revalidate: REVALIDATE_SECONDS, tags: [CFBD_CACHE_TAG] },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`CFBD ${path} failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/** Current calendar year if after July, else previous year (CFB season spans fall). */
export function currentCfbdSeason(now = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  return month >= 6 ? year : year - 1;
}

export async function fetchSeasonData(season?: number): Promise<CfbdSeasonData> {
  const year = season ?? currentCfbdSeason();
  const [teams, fbsTeams, games, records] = await Promise.all([
    cfbdFetch<CfbdTeam[]>("/teams", { year }),
    cfbdFetch<CfbdTeam[]>("/teams/fbs", { year }),
    cfbdFetch<CfbdGame[]>("/games", { year, seasonType: "regular" }),
    cfbdFetch<CfbdRecord[]>("/records", { year }),
  ]);

  // Prefer FBS endpoint logos/colors when present
  const fbsById = new Map(fbsTeams.map((t) => [t.id, t]));
  const mergedTeams = teams.map((t) => {
    const fbs = fbsById.get(t.id);
    if (!fbs) return t;
    return {
      ...t,
      classification: "fbs",
      logos: fbs.logos?.length ? fbs.logos : t.logos,
      color: fbs.color ?? t.color,
      alt_color: fbs.alt_color ?? t.alt_color,
      conference: fbs.conference ?? t.conference,
    };
  });

  return {
    season: year,
    fetchedAt: new Date().toISOString(),
    teams: mergedTeams,
    fbsTeamIds: fbsTeams.map((t) => t.id),
    games,
    records,
  };
}
