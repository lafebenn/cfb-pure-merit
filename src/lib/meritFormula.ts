import type { CfbdGame, CfbdRecord, CfbdSeasonData, CfbdTeam } from "./cfbd";

export interface LossBreakdown {
  roadStrong: number; // opp win% > .660 on the road → -0.5 each
  standard: number; // opp win% >= .500 (not covered above) → -1.0 each
  weak: number; // opp win% < .500 → -2.0 each
  fcs: number; // loss to FCS → -3.0 each
}

export interface TeamMeritResult {
  rank: number;
  teamId: number;
  school: string;
  logo: string | null;
  conference: string | null;
  color: string | null;
  wins: number;
  losses: number;
  ties: number;
  recordLabel: string;
  meritScore: number;
  basePoints: number;
  qualityWins: number;
  roadWins: number;
  roadPoints: number;
  sosScore: number;
  owPct: number;
  oowPct: number;
  gameControl: number;
  avgPointDiff: number;
  lossBreakdown: LossBreakdown;
  fbsWins: number;
  voidedFcsWins: number;
}

interface TeamContext {
  id: number;
  school: string;
  classification: string | null;
  conference: string | null;
  logo: string | null;
  color: string | null;
  /** Display record (from CFBD records when available). */
  wins: number;
  losses: number;
  ties: number;
  /** Win% from completed regular-season games in this dataset. */
  winPct: number;
  opponentIds: number[];
}

function isFbsId(id: number, fbsIds: Set<number>): boolean {
  return fbsIds.has(id);
}

function winPct(wins: number, losses: number, ties = 0): number {
  const games = wins + losses + ties;
  if (games === 0) return 0;
  return (wins + ties * 0.5) / games;
}

function primaryLogo(team: CfbdTeam | undefined): string | null {
  const logos = team?.logos;
  if (!logos || logos.length === 0) return null;
  const https = logos.find((l) => l.startsWith("https://"));
  return https ?? logos[0].replace(/^http:\/\//, "https://");
}

function buildTeamContexts(
  teams: CfbdTeam[],
  records: CfbdRecord[],
  completedGames: CfbdGame[],
  fbsIds: Set<number>,
): Map<number, TeamContext> {
  const byId = new Map<number, TeamContext>();

  for (const team of teams) {
    byId.set(team.id, {
      id: team.id,
      school: team.school,
      classification: fbsIds.has(team.id) ? "fbs" : team.classification,
      conference: team.conference,
      logo: primaryLogo(team),
      color: team.color ?? null,
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      opponentIds: [],
    });
  }

  // Ensure every game participant exists even if missing from /teams?year=
  for (const game of completedGames) {
    for (const [id, school] of [
      [game.homeId, game.homeTeam] as const,
      [game.awayId, game.awayTeam] as const,
    ]) {
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        school,
        classification: fbsIds.has(id) ? "fbs" : "fcs",
        conference: null,
        logo: null,
        color: null,
        wins: 0,
        losses: 0,
        ties: 0,
        winPct: 0,
        opponentIds: [],
      });
    }
  }

  // Display W-L from records
  for (const rec of records) {
    const ctx = byId.get(rec.teamId);
    if (!ctx) continue;
    ctx.wins = rec.total.wins;
    ctx.losses = rec.total.losses;
    ctx.ties = rec.total.ties;
    if (rec.conference) ctx.conference = rec.conference;
    if (fbsIds.has(rec.teamId)) ctx.classification = "fbs";
    else if (rec.classification) ctx.classification = rec.classification;
  }

  // Game-derived win% + opponent lists (source of truth for formula math)
  const tallies = new Map<number, { w: number; l: number; t: number }>();
  const bump = (id: number) => {
    if (!tallies.has(id)) tallies.set(id, { w: 0, l: 0, t: 0 });
    return tallies.get(id)!;
  };

  for (const game of completedGames) {
    const home = byId.get(game.homeId);
    const away = byId.get(game.awayId);
    if (home) home.opponentIds.push(game.awayId);
    if (away) away.opponentIds.push(game.homeId);

    const ht = bump(game.homeId);
    const at = bump(game.awayId);
    const hp = game.homePoints!;
    const ap = game.awayPoints!;
    if (hp > ap) {
      ht.w += 1;
      at.l += 1;
    } else if (ap > hp) {
      at.w += 1;
      ht.l += 1;
    } else {
      ht.t += 1;
      at.t += 1;
    }
  }

  for (const ctx of byId.values()) {
    const t = tallies.get(ctx.id);
    if (t) {
      ctx.winPct = winPct(t.w, t.l, t.t);
      // If records were missing, fall back to game tally for display
      if (ctx.wins === 0 && ctx.losses === 0 && ctx.ties === 0 && t.w + t.l + t.t > 0) {
        ctx.wins = t.w;
        ctx.losses = t.l;
        ctx.ties = t.t;
      }
    }
  }

  return byId;
}

function lossPenalty(
  opponent: TeamContext | undefined,
  isRoadLoss: boolean,
  fbsIds: Set<number>,
): { points: number; bucket: keyof LossBreakdown } {
  if (!opponent || !isFbsId(opponent.id, fbsIds)) {
    return { points: -3.0, bucket: "fcs" };
  }

  const pct = opponent.winPct;
  if (pct > 0.66 && isRoadLoss) {
    return { points: -0.5, bucket: "roadStrong" };
  }
  if (pct >= 0.5) {
    return { points: -1.0, bucket: "standard" };
  }
  return { points: -2.0, bucket: "weak" };
}

function averageWinPct(ids: number[], byId: Map<number, TeamContext>): number {
  if (ids.length === 0) return 0;
  let sum = 0;
  for (const id of ids) {
    sum += byId.get(id)?.winPct ?? 0;
  }
  return sum / ids.length;
}

/** OOW%: average of each opponent's opponents' win%, excluding the original team. */
function computeOowPct(
  teamId: number,
  opponentIds: number[],
  byId: Map<number, TeamContext>,
): number {
  if (opponentIds.length === 0) return 0;
  let sum = 0;
  for (const oppId of opponentIds) {
    const opp = byId.get(oppId);
    if (!opp) {
      sum += 0;
      continue;
    }
    const filtered = opp.opponentIds.filter((id) => id !== teamId);
    sum += averageWinPct(filtered, byId);
  }
  return sum / opponentIds.length;
}

export function calculateMeritRankings(data: CfbdSeasonData): TeamMeritResult[] {
  const fbsIds = new Set(data.fbsTeamIds);
  const completed = data.games.filter(
    (g) =>
      g.completed &&
      g.homePoints !== null &&
      g.awayPoints !== null &&
      (g.seasonType === "regular" || !g.seasonType),
  );

  const byId = buildTeamContexts(data.teams, data.records, completed, fbsIds);
  const results: Omit<TeamMeritResult, "rank">[] = [];

  for (const teamId of fbsIds) {
    const team = byId.get(teamId);
    if (!team) continue;

    const lossBreakdown: LossBreakdown = {
      roadStrong: 0,
      standard: 0,
      weak: 0,
      fcs: 0,
    };

    let fbsWins = 0;
    let voidedFcsWins = 0;
    let roadWins = 0;
    let qualityWins = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    let gamesPlayed = 0;
    let lossPenaltyTotal = 0;

    for (const game of completed) {
      const isHome = game.homeId === team.id;
      const isAway = game.awayId === team.id;
      if (!isHome && !isAway) continue;

      const teamPoints = isHome ? game.homePoints! : game.awayPoints!;
      const oppPoints = isHome ? game.awayPoints! : game.homePoints!;
      const oppId = isHome ? game.awayId : game.homeId;
      const opponent = byId.get(oppId);
      const oppIsFbs = isFbsId(oppId, fbsIds);

      pointsFor += teamPoints;
      pointsAgainst += oppPoints;
      gamesPlayed += 1;

      const won = teamPoints > oppPoints;
      const lost = teamPoints < oppPoints;
      const isRoad = isAway && !game.neutralSite;

      if (won) {
        if (oppIsFbs) {
          fbsWins += 1;
        } else {
          voidedFcsWins += 1;
        }
        // True road wins only (neutral excluded), any opponent
        if (isRoad) {
          roadWins += 1;
        }
        // Quality wins: opponent currently above .500
        if (opponent && opponent.winPct > 0.5) {
          qualityWins += 1;
        }
      } else if (lost) {
        const { points, bucket } = lossPenalty(opponent, isRoad, fbsIds);
        lossPenaltyTotal += points;
        lossBreakdown[bucket] += 1;
      }
    }

    const basePoints = fbsWins + lossPenaltyTotal;
    const roadPoints = roadWins * 0.5;

    const owPct = averageWinPct(team.opponentIds, byId);
    const oowPct = computeOowPct(team.id, team.opponentIds, byId);
    const sosScore = owPct + oowPct * 0.5;

    const avgPointDiff = gamesPlayed > 0 ? (pointsFor - pointsAgainst) / gamesPlayed : 0;
    const gameControl = Math.min(avgPointDiff / 100, 0.17);

    const meritScore = basePoints + roadPoints + qualityWins * 1.0 + sosScore + gameControl;

    results.push({
      teamId: team.id,
      school: team.school,
      logo: team.logo,
      conference: team.conference,
      color: team.color,
      wins: team.wins,
      losses: team.losses,
      ties: team.ties,
      recordLabel:
        team.ties > 0
          ? `${team.wins}-${team.losses}-${team.ties}`
          : `${team.wins}-${team.losses}`,
      meritScore,
      basePoints,
      qualityWins,
      roadWins,
      roadPoints,
      sosScore,
      owPct,
      oowPct,
      gameControl,
      avgPointDiff,
      lossBreakdown,
      fbsWins,
      voidedFcsWins,
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
