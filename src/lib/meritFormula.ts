import type { CfbdSeasonData, CfbdTeam } from "./cfbd";

/** Pure Merit v2 constants — tune in one place. */
export const MERIT_CONSTANTS = {
  WIN_VALUE_BASE: 0.55,
  WIN_VALUE_SLOPE: 0.9,
  LOSS_ROAD_STRONG: -0.55,
  LOSS_STANDARD: -0.75,
  LOSS_WEAK_HOME: -1.1,
  LOSS_WEAK_ROAD: -0.7,
  LOSS_COMPOUND_K: 0.45,
  ROAD_WIN: 0.35,
  ROAD_POINTS_CAP: 1.0,
  RESUME_SCALE: 3.2,
  RESUME_OOW_WEIGHT: 1.0,
  GC_CAP: 0.02,
} as const;

export interface LossBreakdown {
  roadStrong: number;
  standard: number;
  weakHome: number;
  weakRoad: number;
  /** @deprecated always 0 after FCS scrub */
  fcs: number;
}

export interface TeamMeritResult {
  rank: number;
  teamId: number;
  school: string;
  logo: string | null;
  conference: string | null;
  color: string | null;
  /** FBS-only W-L used by the formula (FCS games discarded). */
  wins: number;
  losses: number;
  ties: number;
  recordLabel: string;
  meritScore: number;
  /** Sum of continuous win values (replaces flat +1 base). */
  winValueSum: number;
  /** @deprecated alias of winValueSum for older UI; prefer winValueSum */
  basePoints: number;
  /** Informational count of wins vs adj opp > .500 */
  qualityWins: number;
  roadWins: number;
  roadPoints: number;
  /** ResumeStrength = scale × (OW% + oowWeight × OOW%) */
  sosScore: number;
  owPct: number;
  oowPct: number;
  gameControl: number;
  avgPointDiff: number;
  lossBreakdown: LossBreakdown;
  /** Sum of tier hits before compounding */
  lossBaseSum: number;
  /** Applied loss penalty after compounding */
  lossPenalty: number;
  /** 1 for 0–1 losses; 1 + k×(L−1) for L≥2 */
  lossCompoundFactor: number;
  fbsWins: number;
  /** FCS games discarded from the schedule (informational). */
  voidedFcsWins: number;
}

interface FbsGame {
  homeId: number;
  awayId: number;
  homePoints: number;
  awayPoints: number;
  neutralSite: boolean;
  week: number;
  startDate: string;
}

interface TeamMeta {
  id: number;
  school: string;
  conference: string | null;
  logo: string | null;
  color: string | null;
}

interface RecordTally {
  wins: number;
  losses: number;
  ties: number;
  opponentIds: number[];
}

function winPct(wins: number, losses: number, ties = 0): number {
  const games = wins + losses + ties;
  if (games <= 0) return 0;
  return (wins + ties * 0.5) / games;
}

function primaryLogo(team: CfbdTeam | undefined): string | null {
  const logos = team?.logos;
  if (!logos || logos.length === 0) return null;
  const https = logos.find((l) => l.startsWith("https://"));
  return https ?? logos[0].replace(/^http:\/\//, "https://");
}

function lossTier(
  oppWinPct: number,
  isRoadLoss: boolean,
): { points: number; bucket: keyof LossBreakdown } {
  const C = MERIT_CONSTANTS;
  if (oppWinPct > 0.66 && isRoadLoss) {
    return { points: C.LOSS_ROAD_STRONG, bucket: "roadStrong" };
  }
  if (oppWinPct >= 0.5) {
    return { points: C.LOSS_STANDARD, bucket: "standard" };
  }
  if (isRoadLoss) {
    return { points: C.LOSS_WEAK_ROAD, bucket: "weakRoad" };
  }
  return { points: C.LOSS_WEAK_HOME, bucket: "weakHome" };
}

/**
 * Team B's FBS record with the A↔B game removed.
 * - A beat B → subtract 1 loss from B
 * - A lost to B → subtract 1 win from B
 * - Tie → subtract 1 tie from B
 */
function adjustedOppRecord(
  oppTally: RecordTally,
  teamBeatOpp: boolean,
  teamLostToOpp: boolean,
): { wins: number; losses: number; ties: number; winPct: number } {
  let { wins, losses, ties } = oppTally;
  if (teamBeatOpp) {
    losses = Math.max(0, losses - 1);
  } else if (teamLostToOpp) {
    wins = Math.max(0, wins - 1);
  } else {
    ties = Math.max(0, ties - 1);
  }
  return { wins, losses, ties, winPct: winPct(wins, losses, ties) };
}

function compoundLossFactor(lossCount: number): number {
  if (lossCount <= 1) return 1;
  return 1 + MERIT_CONSTANTS.LOSS_COMPOUND_K * (lossCount - 1);
}

export function calculateMeritRankings(data: CfbdSeasonData): TeamMeritResult[] {
  const C = MERIT_CONSTANTS;
  const fbsIds = new Set(data.fbsTeamIds);

  // Step 1: FBS vs FBS only
  const fbsGames: FbsGame[] = [];
  for (const g of data.games) {
    if (!g.completed || g.homePoints === null || g.awayPoints === null) continue;
    if (g.seasonType && g.seasonType !== "regular") continue;

    const homeFbs = g.homeFbs ?? fbsIds.has(g.homeId);
    const awayFbs = g.awayFbs ?? fbsIds.has(g.awayId);
    if (!homeFbs || !awayFbs) continue;

    fbsGames.push({
      homeId: g.homeId,
      awayId: g.awayId,
      homePoints: g.homePoints,
      awayPoints: g.awayPoints,
      neutralSite: g.neutralSite,
      week: g.week,
      startDate: g.startDate,
    });
  }

  const meta = new Map<number, TeamMeta>();
  for (const team of data.teams) {
    if (!fbsIds.has(team.id)) continue;
    meta.set(team.id, {
      id: team.id,
      school: team.school,
      conference: team.conference,
      logo: primaryLogo(team),
      color: team.color ?? null,
    });
  }
  for (const g of data.games) {
    for (const [id, school] of [
      [g.homeId, g.homeTeam] as const,
      [g.awayId, g.awayTeam] as const,
    ]) {
      if (!fbsIds.has(id) || meta.has(id)) continue;
      meta.set(id, { id, school, conference: null, logo: null, color: null });
    }
  }
  for (const rec of data.records) {
    if (!fbsIds.has(rec.teamId)) continue;
    const m = meta.get(rec.teamId);
    if (m && rec.conference) m.conference = rec.conference;
  }

  const tallies = new Map<number, RecordTally>();
  const ensure = (id: number) => {
    if (!tallies.has(id)) {
      tallies.set(id, { wins: 0, losses: 0, ties: 0, opponentIds: [] });
    }
    return tallies.get(id)!;
  };
  for (const id of fbsIds) ensure(id);

  for (const g of fbsGames) {
    const home = ensure(g.homeId);
    const away = ensure(g.awayId);
    home.opponentIds.push(g.awayId);
    away.opponentIds.push(g.homeId);
    if (g.homePoints > g.awayPoints) {
      home.wins += 1;
      away.losses += 1;
    } else if (g.awayPoints > g.homePoints) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }

  const globalWinPct = new Map<number, number>();
  for (const [id, t] of tallies) {
    globalWinPct.set(id, winPct(t.wins, t.losses, t.ties));
  }

  const fcsWinsDiscarded = new Map<number, number>();
  for (const g of data.games) {
    if (!g.completed || g.homePoints === null || g.awayPoints === null) continue;
    if (g.seasonType && g.seasonType !== "regular") continue;
    const homeFbs = g.homeFbs ?? fbsIds.has(g.homeId);
    const awayFbs = g.awayFbs ?? fbsIds.has(g.awayId);
    if (homeFbs === awayFbs) continue;
    if (homeFbs && g.homePoints > g.awayPoints) {
      fcsWinsDiscarded.set(g.homeId, (fcsWinsDiscarded.get(g.homeId) ?? 0) + 1);
    }
    if (awayFbs && g.awayPoints > g.homePoints) {
      fcsWinsDiscarded.set(g.awayId, (fcsWinsDiscarded.get(g.awayId) ?? 0) + 1);
    }
  }

  const results: Omit<TeamMeritResult, "rank">[] = [];

  for (const teamId of fbsIds) {
    const teamMeta = meta.get(teamId);
    const teamTally = tallies.get(teamId);
    if (!teamMeta || !teamTally) continue;

    const lossBreakdown: LossBreakdown = {
      roadStrong: 0,
      standard: 0,
      weakHome: 0,
      weakRoad: 0,
      fcs: 0,
    };

    let fbsWins = 0;
    let roadWins = 0;
    let qualityWins = 0;
    let winValueSum = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    let gamesPlayed = 0;
    let lossBaseSum = 0;
    let lossCount = 0;
    let owSum = 0;
    let owCount = 0;
    let oowSum = 0;
    let oowCount = 0;

    const teamGames = fbsGames
      .filter((g) => g.homeId === teamId || g.awayId === teamId)
      .sort(
        (a, b) =>
          a.week - b.week || a.startDate.localeCompare(b.startDate),
      );

    for (const g of teamGames) {
      const isHome = g.homeId === teamId;
      const teamPoints = isHome ? g.homePoints : g.awayPoints;
      const oppPoints = isHome ? g.awayPoints : g.homePoints;
      const oppId = isHome ? g.awayId : g.homeId;
      const oppTally = tallies.get(oppId);
      if (!oppTally) continue;

      pointsFor += teamPoints;
      pointsAgainst += oppPoints;
      gamesPlayed += 1;

      const won = teamPoints > oppPoints;
      const lost = teamPoints < oppPoints;
      const isRoad = !isHome && !g.neutralSite;
      const adj = adjustedOppRecord(oppTally, won, lost);

      owSum += adj.winPct;
      owCount += 1;

      const oppOpponents = oppTally.opponentIds.filter((id) => id !== teamId);
      if (oppOpponents.length > 0) {
        let s = 0;
        for (const oid of oppOpponents) s += globalWinPct.get(oid) ?? 0;
        oowSum += s / oppOpponents.length;
        oowCount += 1;
      }

      if (won) {
        fbsWins += 1;
        winValueSum += C.WIN_VALUE_BASE + C.WIN_VALUE_SLOPE * adj.winPct;
        if (isRoad) roadWins += 1;
        if (adj.winPct > 0.5) qualityWins += 1;
      } else if (lost) {
        const { points, bucket } = lossTier(adj.winPct, isRoad);
        lossBaseSum += points;
        lossCount += 1;
        lossBreakdown[bucket] += 1;
      }
    }

    const lossCompoundFactor = compoundLossFactor(lossCount);
    const lossPenalty = lossBaseSum * lossCompoundFactor;
    const roadPoints = Math.min(roadWins * C.ROAD_WIN, C.ROAD_POINTS_CAP);
    const owPct = owCount > 0 ? owSum / owCount : 0;
    const oowPct = oowCount > 0 ? oowSum / oowCount : 0;
    const sosScore = C.RESUME_SCALE * (owPct + C.RESUME_OOW_WEIGHT * oowPct);

    const avgPointDiff = gamesPlayed > 0 ? (pointsFor - pointsAgainst) / gamesPlayed : 0;
    const gameControl = Math.min(Math.max(avgPointDiff, 0) / 100, C.GC_CAP);

    const meritScore = winValueSum + lossPenalty + roadPoints + sosScore + gameControl;
    const { wins, losses, ties } = teamTally;

    results.push({
      teamId,
      school: teamMeta.school,
      logo: teamMeta.logo,
      conference: teamMeta.conference,
      color: teamMeta.color,
      wins,
      losses,
      ties,
      recordLabel: ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`,
      meritScore,
      winValueSum,
      basePoints: winValueSum,
      qualityWins,
      roadWins,
      roadPoints,
      sosScore,
      owPct,
      oowPct,
      gameControl,
      avgPointDiff,
      lossBreakdown,
      lossBaseSum,
      lossPenalty,
      lossCompoundFactor,
      fbsWins,
      voidedFcsWins: fcsWinsDiscarded.get(teamId) ?? 0,
    });
  }

  results.sort((a, b) => {
    if (b.meritScore !== a.meritScore) return b.meritScore - a.meritScore;
    return a.school.localeCompare(b.school);
  });

  return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function topN(results: TeamMeritResult[], n = 25): TeamMeritResult[] {
  return results.slice(0, n);
}
