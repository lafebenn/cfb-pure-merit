// Runs the production TypeScript formula on a CfbdSeasonData JSON file (argv[2]) and prints results.
import { readFileSync } from "node:fs";
import { calculateMeritRankings } from "../../src/lib/meritFormula.ts";

const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = calculateMeritRankings(data).map((r) => ({
  teamId: r.teamId,
  rank: r.rank,
  meritScore: r.meritScore,
}));
process.stdout.write(JSON.stringify(out));
