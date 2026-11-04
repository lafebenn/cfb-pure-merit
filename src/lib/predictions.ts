import bundled from "../../public/data/predictions.json";

/** Weekly ML output, committed by .github/workflows/predict.yml (schema in ml/src/cfbml/publish.py). */
export const PREDICTIONS_CACHE_TAG = "ml-predictions";
const PREDICTIONS_URL =
  "https://raw.githubusercontent.com/lafebenn/cfb-pure-merit/main/public/data/predictions.json";
const SCHEMA_VERSION = 1;
/** Hide panels if the weekly job hasn't run in this long. */
const MAX_AGE_DAYS = 10;

export interface PredTeam {
  teamId: number;
  school: string;
  conference: string | null;
  logo: string | null;
  color: string | null;
  meritRank: number | null;
  committeeRank: number | null;
}

export interface UpsetAlert {
  gameId: number;
  week: number;
  kickoff: string;
  neutralSite: boolean;
  homeTeamId: number;
  favorite: PredTeam;
  underdog: PredTeam;
  underdogWinProb: number;
  marketUnderdogWinProb: number | null;
  spread: number | null;
  model: "full" | "nomarket";
  score: number;
}

export interface TitleOddsRow extends PredTeam {
  playoff: number;
  bye: number;
  quarterfinal: number;
  semifinal: number;
  final: number;
  champion: number;
  avgSeed: number | null;
  confChampion: number;
}

export interface DarkHorse extends PredTeam {
  titleOdds: number;
  titleOddsMerit: number;
  playoffOdds: number;
  playoffOddsMerit: number;
  nextGame?: {
    gameId: number;
    week: number;
    opponent: string;
    home: boolean;
    winProb: number;
    marketWinProb: number | null;
    edge: number | null;
  };
}

export type BracketFormat = "real" | "merit";

export interface Predictions {
  schemaVersion: number;
  generatedAt: string;
  season: number;
  nextWeek: number | null;
  nSims: number;
  remainingGames: number;
  upsetAlerts: UpsetAlert[];
  titleOdds: Record<BracketFormat, TitleOddsRow[]>;
  projectedField: Record<
    BracketFormat,
    { seed: number; teamId: number; school: string; avgSeed: number; playoff: number }[]
  >;
  fieldOverlap: number;
  darkHorse: DarkHorse | null;
}

function usable(p: Predictions | null, season: number, now = Date.now()): p is Predictions {
  if (!p || p.schemaVersion !== SCHEMA_VERSION || p.season !== season) return false;
  const ageDays = (now - new Date(p.generatedAt).getTime()) / 86_400_000;
  return Number.isFinite(ageDays) && ageDays <= MAX_AGE_DAYS;
}

/**
 * Latest predictions from GitHub (busted by the Sunday refresh), falling back to the copy
 * bundled at build time. Returns null when nothing fresh exists for this season.
 */
export async function loadPredictions(season: number): Promise<Predictions | null> {
  let remote: Predictions | null = null;
  try {
    const res = await fetch(PREDICTIONS_URL, {
      next: { revalidate: 60 * 60 * 24, tags: [PREDICTIONS_CACHE_TAG] },
    });
    if (res.ok) remote = (await res.json()) as Predictions;
  } catch {
    remote = null;
  }
  if (usable(remote, season)) return remote;
  const local = bundled as unknown as Predictions;
  return usable(local, season) ? local : null;
}
