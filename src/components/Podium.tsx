import type { TeamMeritResult } from "@/lib/meritFormula";

function Mark({ team }: { team: TeamMeritResult }) {
  if (team.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={team.logo} alt="" width={56} height={56} className="h-14 w-14 object-contain" />
    );
  }
  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-black"
      style={{ background: team.color || "#c9a227" }}
    >
      {team.school.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function Podium({ teams }: { teams: TeamMeritResult[] }) {
  const top = teams.slice(0, 4);
  if (top.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
          Contenders
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          Top of the board
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {top.map((team) => (
          <article
            key={team.teamId}
            className={`relative overflow-hidden rounded-2xl border border-border bg-surface-2/90 p-5 ${
              team.rank === 1 ? "rank-stripe ring-1 ring-gold/25" : ""
            }`}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Mark team={team} />
                <div>
                  <p className="font-mono text-xs text-gold">#{team.rank}</p>
                  <h3 className="text-lg font-semibold leading-tight text-white">{team.school}</h3>
                  <p className="text-xs text-muted">{team.conference ?? "FBS"}</p>
                </div>
              </div>
              <p className="font-mono text-sm text-zinc-300">{team.recordLabel}</p>
            </div>
            <div className="flex items-end justify-between border-t border-white/5 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Merit</p>
                <p className="font-mono text-2xl font-bold text-gold-bright">
                  {team.meritScore.toFixed(3)}
                </p>
              </div>
              <div className="text-right text-xs text-zinc-400">
                <p>Base {team.basePoints.toFixed(1)}</p>
                <p>
                  QW {team.qualityWins} · Road +{team.roadPoints.toFixed(1)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
