import TeamLogo from "@/components/TeamLogo";
import type { TeamMeritResult } from "@/lib/meritFormula";

function recordDisplay(label: string): string {
  return label.replace(/-/g, "–");
}

function ContenderCard({
  team,
  delayMs,
}: {
  team: TeamMeritResult;
  delayMs: number;
}) {
  return (
    <article
      className="animate-rise flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 sm:p-5"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-3xl font-semibold leading-none text-primary">
          {team.rank}
        </span>
        <TeamLogo team={team} size={44} />
      </div>
      <h3 className="mt-5 text-lg font-bold leading-tight">{team.school}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {team.conference ?? "FBS"} ·{" "}
        <span className="font-mono">{recordDisplay(team.recordLabel)}</span>
      </p>
      <p className="mt-auto pt-4 font-mono text-xl font-semibold text-gold-bright">
        {team.meritScore.toFixed(3)}
      </p>
    </article>
  );
}

function SeedChip({ team }: { team: TeamMeritResult }) {
  const isOne = team.rank === 1;
  return (
    <div
      className={`animate-rise flex flex-col items-center gap-1.5 ${
        isOne ? "scale-110 sm:scale-125" : "opacity-90"
      }`}
      style={{ animationDelay: `${80 + team.rank * 40}ms` }}
      title={`#${team.rank} ${team.school}`}
    >
      <TeamLogo team={team} size={isOne ? 56 : 36} prominent={isOne} />
      <span
        className={`font-mono text-[10px] font-semibold tracking-wider ${
          isOne ? "text-primary" : "text-muted-foreground"
        }`}
      >
        #{team.rank}
      </span>
    </div>
  );
}

export default function Podium({ teams }: { teams: TeamMeritResult[] }) {
  const [champ, ...rest] = teams.slice(0, 4);
  if (!champ) return null;
  const contenders = rest.slice(0, 3);
  const seedStrip = teams.slice(0, 8);

  return (
    <section className="pt-1">
      {/* Compact logo strip — draws the eye before copy */}
      <div className="mb-5 flex flex-wrap items-end justify-center gap-3 sm:gap-5">
        {seedStrip.map((team) => (
          <SeedChip key={team.teamId} team={team} />
        ))}
      </div>

      <div className="mb-4">
        <div className="rule-gold mb-4 opacity-60" />
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
          Top of the board
        </p>
      </div>

      {/* #1 champion — dominant visual */}
      <article
        className="animate-rise relative overflow-hidden rounded-xl border border-primary/50 bg-champion p-5 sm:p-7"
        style={{ animationDelay: "120ms" }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-52 w-52 rounded-full opacity-35 blur-2xl"
          style={{
            background: champ.color
              ? `color-mix(in srgb, ${champ.color} 55%, transparent)`
              : "var(--primary)",
          }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex flex-col items-start gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
                No. 1 seed
              </span>
              <span className="font-mono text-5xl font-semibold leading-none text-gold-gradient sm:text-6xl">
                1
              </span>
            </div>
            <TeamLogo team={champ} size={112} prominent />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                {champ.school}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {champ.conference ?? "FBS"} ·{" "}
                <span className="font-mono">{recordDisplay(champ.recordLabel)}</span>
              </p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Merit score
              </p>
              <p className="font-mono text-3xl font-semibold text-gold-bright sm:text-4xl">
                {champ.meritScore.toFixed(3)}
              </p>
            </div>
          </div>

          {/* Future ML slot */}
          <div className="w-full shrink-0 rounded-lg border border-dashed border-border/80 bg-background/40 px-4 py-3 sm:max-w-[220px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">
              Soon · ML layer
            </p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Upset alerts, title odds &amp; dark-horse picks once the pipelines land.
            </p>
          </div>
        </div>
      </article>

      {contenders.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {contenders.map((team, i) => (
            <ContenderCard key={team.teamId} team={team} delayMs={220 + i * 80} />
          ))}
        </div>
      )}
    </section>
  );
}
