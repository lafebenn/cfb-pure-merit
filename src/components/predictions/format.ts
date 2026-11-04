export function pct(p: number, digits = 0): string {
  if (p > 0 && p < 0.01) return "<1%";
  if (p > 0.99 && p < 1) return ">99%";
  return `${(p * 100).toFixed(digits)}%`;
}

export function rankLabel(team: { committeeRank: number | null; meritRank: number | null }): string {
  if (team.committeeRank) return `#${team.committeeRank}`;
  if (team.meritRank && team.meritRank <= 25) return `M${team.meritRank}`;
  return "";
}
