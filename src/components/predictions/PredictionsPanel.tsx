import TeamLogo from "@/components/TeamLogo";
import type { DarkHorse, Predictions, UpsetAlert } from "@/lib/predictions";
import { pct, rankLabel } from "./format";
import TitleOdds from "./TitleOdds";

function UpsetRow({ alert }: { alert: UpsetAlert }) {
  const dogIsHome = alert.underdog.teamId === alert.homeTeamId;
  const venue = alert.neutralSite ? "vs" : dogIsHome ? "vs" : "@";
  const edge =
    alert.marketUnderdogWinProb === null
      ? null
      : alert.underdogWinProb - alert.marketUnderdogWinProb;
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <TeamLogo team={alert.underdog} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {alert.underdog.school}{" "}
          <span className="font-normal text-muted-foreground">
            {venue} {rankLabel(alert.favorite)} {alert.favorite.school}
          </span>
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          {alert.marketUnderdogWinProb === null
            ? "No line yet · model only"
            : `Vegas ${pct(alert.marketUnderdogWinProb)}`}
          {edge !== null && Math.abs(edge) >= 0.03 && (
            <span className={edge > 0 ? "text-gold-bright" : ""}>
              {" "}
              · model {edge > 0 ? "+" : ""}
              {(edge * 100).toFixed(0)} pts
            </span>
          )}
        </p>
      </div>
      <span className="font-mono text-lg font-semibold text-gold-bright">
        {pct(alert.underdogWinProb)}
      </span>
    </li>
  );
}

function UpsetAlerts({ predictions }: { predictions: Predictions }) {
  const alerts = predictions.upsetAlerts.slice(0, 3);
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Upset alerts
        </p>
        {predictions.nextWeek && (
          <span className="font-mono text-[10px] text-muted-foreground">
            Week {predictions.nextWeek}
          </span>
        )}
      </div>
      {alerts.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No ranked favorite is in real danger this week.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {alerts.map((a) => (
            <UpsetRow key={a.gameId} alert={a} />
          ))}
        </ul>
      )}
      <p className="mt-auto pt-4 text-xs leading-snug text-muted-foreground">
        Underdog win chance from the game model. Shown when a top-25 favorite is 35% or
        more likely to lose.
      </p>
    </article>
  );
}

function DarkHorseCard({ horse }: { horse: DarkHorse }) {
  const ng = horse.nextGame;
  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-primary/40 bg-card p-4 sm:p-5">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-25 blur-2xl"
        style={{
          background: horse.color
            ? `color-mix(in srgb, ${horse.color} 60%, transparent)`
            : "var(--primary)",
        }}
      />
      <p className="relative font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
        Dark horse
      </p>
      <div className="relative mt-4 flex items-center gap-4">
        <TeamLogo team={horse} size={52} prominent />
        <div className="min-w-0">
          <h3 className="truncate text-xl font-extrabold">{horse.school}</h3>
          <p className="font-mono text-[11px] text-muted-foreground">
            Merit #{horse.meritRank ?? "—"}
            {horse.committeeRank ? ` · Committee #${horse.committeeRank}` : ""}
          </p>
        </div>
      </div>
      <dl className="relative mt-5 grid grid-cols-2 gap-3">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Title · real CFP
          </dt>
          <dd className="font-mono text-2xl font-semibold text-gold-bright">
            {pct(horse.titleOdds, 1)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Title · Pure Merit
          </dt>
          <dd className="font-mono text-2xl font-semibold">{pct(horse.titleOddsMerit, 1)}</dd>
        </div>
      </dl>
      <p className="relative mt-3 text-xs leading-snug text-muted-foreground">
        Best title odds outside the top 8 and the six favorites. Makes the real playoff in{" "}
        {pct(horse.playoffOdds)} of simulations.
      </p>
      {ng && (
        <p className="relative mt-auto pt-4 font-mono text-[11px] text-muted-foreground">
          Next: {ng.home ? "vs" : "@"} {ng.opponent} · model {pct(ng.winProb)}
          {ng.marketWinProb !== null && ` vs Vegas ${pct(ng.marketWinProb)}`}
        </p>
      )}
    </article>
  );
}

export default function PredictionsPanel({ predictions }: { predictions: Predictions }) {
  return (
    <section className="mt-10" aria-label="Model predictions">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
          Model predictions
        </p>
        <a
          href="#predictions-method"
          className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          Updated{" "}
          {new Date(predictions.generatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/Denver",
          })}{" "}
          · how it works →
        </a>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <UpsetAlerts predictions={predictions} />
        <TitleOdds predictions={predictions} />
        {predictions.darkHorse ? (
          <DarkHorseCard horse={predictions.darkHorse} />
        ) : (
          <article className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            No dark horse this week. The top of the board owns every simulated title.
          </article>
        )}
      </div>
    </section>
  );
}
