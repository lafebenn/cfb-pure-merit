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
  wins: number;
  losses: number;
  ties: number;
  recordLabel: string;
  meritScore: number;
  basePoints: number;
  qualityWins: number;
  roadWins: number;
  sosScore: number;
  owPct: number;
  oowPct: number;
  gameControl: number;
  avgPointDiff: number;
  lossBreakdown: LossBreakdown;
  fbsWins: number;
}

function isFbs(classification: string | null | undefined): boolean {
  return (classification ?? "").toLowerCase() === "fbs";
}

function isFcs(classification: string | null | undefined): boolean {
  return (classification ?? "").toLowerCase() === "fcs";
}

function winPct(wins: number, losses: number, ties = 0): number {
  const games = wins + losses + ties;
  if (games === 0) return 0;
  // Ties count as half a win for percentage purposes
  return (wins + ties * 0.5) / games;
}

function primaryLogo(team: CfbdTeam | undefined): string | null {
  const logos = team?.logos;
  if (!logos || logos.length === 0) return null;
  // Prefer https
  const https = logos.find((l) => l.startsWith("https://"));
  return https ?? logos[0].replace(/^http:\/\//, "https://");
}

interface TeamContext {
  id: number;
  school: string;
  classification: string | null;
  conference: string | null;
  logo: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  opponentIds: number[];
}

function buildTeamContexts(
  teams: CfbdTeam[],
  records: CfbdRecord[],
  completedGames: CfbdGame[],
): Map<number, TeamContext> {
  const byId = new Map<number, TeamContext>();
  const bySchool = new Map<string, CfbdTeam>();

  for (const team of teams) {
    bySchool.set(team.school, team);
    byId.set(team.id, {
      id: team.id,
      school: team.school,
      classification: team.classification,
      conference: team.conference,
      logo: primaryLogo(team),
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      opponentIds: [],
    });
  }

  // Prefer official records endpoint for W-L
  for (const rec of records) {
    const ctx =
      byId.get(rec.teamId) ??
      (bySchool.has(rec.team)
        ? byId.get(bySchool.get(rec.team)!.id)
        : undefined);
    if (!ctx) continue;
    ctx.wins = rec.total.wins;
    ctx.losses = rec.total.losses;
    ctx.ties = rec.total.ties;
    if (rec.classification) ctx.classification = rec.classification;
    if (rec.conference) ctx.conference = rec.conference;
  }

  // Opponent lists from completed games
  for (const game of completedGames) {
    const home = byId.get(game.homeId);
    const away = byId.get(game.awayId);
    if (home) home.opponentIds.push(game.awayId);
    if (away) away.opponentIds.push(game.homeId);
  }

  for (const ctx of byId.values()) {
    ctx.winPct = winPct(ctx.wins, ctx.losses, ctx.ties);
  }

  return byId;
}

function lossPenalty(
  opponent: TeamContext | undefined,
  isRoadLoss: boolean,
): { points: number; bucket: keyof LossBreakdown } {
  if (!opponent || isFcs(opponent.classification)) {
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

function computeOowPct(opponentIds: number[], byId: Map<number, TeamContext>): number {
  if (opponentIds.length === 0) return 0;
  let sum = 0;
  for (const oppId of opponentIds) {
    const opp = byId.get(oppId);
    if (!opp || opp.opponentIds.length === 0) {
      sum += 0;
      continue;
    }
    // Exclude games against the original team when averaging OOW% is ideal,
    // but CFBD opponent lists don't tag which game — use full opponent win%.
    sum += averageWinPct(opp.opponentIds, byId);
  }
  return sum / opponentIds.length;
}

export function calculateMeritRankings(data: CfbdSeasonData): TeamMeritResult[] {
  const completed = data.games.filter(
    (g) =>
      g.completed &&
      g.homePoints !== null &&
      g.awayPoints !== null &&
      g.seasonType === "regular",
  );

  const byId = buildTeamContexts(data.teams, data.records, completed);

  const fbsTeams = [...byId.values()].filter((t) => isFbs(t.classification));
  const results: Omit<TeamMeritResult, "rank">[] = [];

  for (const team of fbsTeams) {
    const lossBreakdown: LossBreakdown = {
      roadStrong: 0,
      standard: 0,
      weak: 0,
      fcs: 0,
    };

    let fbsWins = 0;
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

      pointsFor += teamPoints;
      pointsAgainst += oppPoints;
      gamesPlayed += 1;

      const won = teamPoints > oppPoints;
      const lost = teamPoints < oppPoints;
      const isRoad = isAway && !game.neutralSite;

      if (won) {
        // FCS wins are void (0 points) — only FBS wins count toward base
        if (opponent && isFbs(opponent.classification)) {
          fbsWins += 1;
        }
        if (isRoad) {
          roadWins += 1;
        }
        if (opponent && opponent.winPct > 0.5) {
          qualityWins += 1;
        }
      } else if (lost) {
        const { points, bucket } = lossPenalty(opponent, isRoad);
        lossPenaltyTotal += points;
        lossBreakdown[bucket] += 1;
      }
    }

    const basePoints = fbsWins + lossPenaltyTotal;

    const owPct = averageWinPct(team.opponentIds, byId);
    const oowPct = computeOowPct(team.opponentIds, byId);
    const sosScore = owPct + oowPct * 0.5;

    const avgPointDiff = gamesPlayed > 0 ? (pointsFor - pointsAgainst) / gamesPlayed : 0;
    const gameControl = Math.min(avgPointDiff / 100, 0.17);

    const difficulty = roadWins * 0.5 + qualityWins * 1.0;
    const meritScore = basePoints + difficulty + sosScore + gameControl;

    results.push({
      teamId: team.id,
      school: team.school,
      logo: team.logo,
      conference: team.conference,
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
      sosScore,
      owPct,
      oowPct,
      gameControl,
      avgPointDiff,
      lossBreakdown,
      fbsWins,
    });
  }

  results.sort((a, b) => b.meritScore - a.meritScore);

  return results.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function topN(results: TeamMeritResult[], n = 25): TeamMeritResult[] {
  return results.slice(0, n);
}
