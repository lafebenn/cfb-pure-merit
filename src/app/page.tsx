import Podium, { type ChampOdds } from "@/components/Podium";
import PredictionsPanel from "@/components/predictions/PredictionsPanel";
import RankingsTable from "@/components/RankingsTable";
import { currentCfbdSeason, fetchSeasonData } from "@/lib/cfbd";
import { calculateMeritRankings, topN } from "@/lib/meritFormula";
import { loadPredictions, type Predictions } from "@/lib/predictions";

export const revalidate = 86400; // fallback daily; Sunday cron forces a fresh pull

function formatUpdated(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Denver",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const FORMULA_BLOCKS = [
  {
    n: "01",
    title: "Data scrub",
    items: [
      "Only FBS vs FBS games count (homeFbs & awayFbs)",
      "FCS games discarded for W/L, PD, OW%, and OOW%",
      "Opponent records are H2H-adjusted (remove the game vs you)",
    ],
  },
  {
    n: "02",
    title: "Win value & road",
    items: [
      "Each FBS win: 0.55 + 0.90 × opponent’s adjusted win%",
      "True road wins: +0.35 each, capped at +1.00 total",
    ],
  },
  {
    n: "03",
    title: "Tiered losses (compounded)",
    items: [
      "Road vs adj >.660: −0.55 · Standard ≥.500: −0.75",
      "Weak home: −1.10 · Weak road: −0.70",
      "2+ losses: total loss hit × (1 + 0.45 × (losses − 1))",
    ],
  },
  {
    n: "04",
    title: "Resume & control",
    items: [
      "Resume = 3.2 × (OW% + OOW%) from adjusted W/L% graph only",
      "Game control = avg FBS margin ÷ 100, capped at +0.02 (near-ties)",
    ],
  },
] as const;

const PREDICTION_BLOCKS = [
  {
    n: "A",
    title: "Game model",
    items: [
      "LightGBM predicts each FBS game's margin; isotonic calibration turns it into a win %",
      "Inputs as of kickoff only: opponent-adjusted EPA & success rate, Elo, last year's SP+, the closing line when one exists",
      "Coach résumé (career win %, years at school, wins over expectation) and roster experience (returning production, QB back, upperclass & transfer usage)",
      "No conference or brand inputs",
    ],
  },
  {
    n: "B",
    title: "Committee emulator",
    items: [
      "LambdaRank trained on every CFP committee ranking since 2014",
      "Sees the Pure Merit résumé plus conference and program brand, because the real committee does",
      "Backtest on 2024–25: 10.75 of the committee's top 12 matched each week",
    ],
  },
  {
    n: "C",
    title: "Season simulator",
    items: [
      "10,000 runs of the remaining schedule, then conference title games (top two in the standings)",
      "Real CFP: 5 highest-ranked champs + 7 at-large, top 4 get byes, 5–8 host round one",
      "Pure Merit: top 12 of this board, seeded straight, so you can see what the formula would pick",
    ],
  },
  {
    n: "D",
    title: "Honest scoreboard",
    items: [
      "Trained on 2014–21, tuned on 2022–23, tested on 2024–25 seasons it never saw",
      "With lines: Brier 0.179 vs Vegas 0.179 and Elo 0.190. It matches the market rather than beating it",
      "NIL era is noisier: SP+ year-over-year correlation fell from 0.83 to 0.76, so recent seasons are weighted more",
    ],
  },
] as const;

function champOddsFor(p: Predictions | null, teamId: number | undefined): ChampOdds | null {
  if (!p || teamId === undefined) return null;
  const real = p.titleOdds.real.find((t) => t.teamId === teamId);
  const merit = p.titleOdds.merit.find((t) => t.teamId === teamId);
  if (!real) return null;
  return { real: real.champion, merit: merit?.champion ?? 0, playoff: real.playoff };
}

export default async function Home() {
  let error: string | null = null;
  let season = currentCfbdSeason();
  let fetchedAt = new Date().toISOString();
  let top25 = [] as ReturnType<typeof topN>;

  const [seasonResult, predictions] = await Promise.all([
    fetchSeasonData().then(
      (data) => ({ ok: true as const, data }),
      (err: unknown) => ({ ok: false as const, err }),
    ),
    loadPredictions(season),
  ]);
  if (seasonResult.ok) {
    season = seasonResult.data.season;
    fetchedAt = seasonResult.data.fetchedAt;
    top25 = topN(calculateMeritRankings(seasonResult.data), 25);
  } else {
    const err = seasonResult.err;
    error = err instanceof Error ? err.message : "Failed to load rankings.";
  }
  const champOdds = champOddsFor(predictions, top25[0]?.teamId);

  return (
    <div className="min-h-screen bg-background bg-glow bg-no-repeat font-sans text-foreground">
      <header className="mx-auto max-w-6xl px-5 pb-3 pt-6 sm:px-8 sm:pt-8">
        <div className="animate-rise flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary">
              {season} · Pure Merit · Sundays
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
              CFB Pure Merit <span className="text-gold-gradient">Rankings</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
              {formatUpdated(fetchedAt)}
            </span>
            <a
              href="#formula"
              className="group inline-flex items-center gap-1.5 border-b border-primary pb-0.5 text-xs font-semibold text-gold-bright transition-colors hover:text-foreground sm:text-sm"
            >
              Formula{" "}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        {error ? (
          <div
            className="rounded-lg border border-red-900/50 bg-red-950/40 px-5 py-6 text-sm text-red-100"
            role="alert"
          >
            <p className="font-semibold">Could not load rankings</p>
            <p className="mt-1 text-red-200/90">{error}</p>
          </div>
        ) : (
          <>
            <Podium teams={top25} champOdds={champOdds} />
            {predictions && <PredictionsPanel predictions={predictions} />}

            <section className="mt-16">
              <div className="mb-8">
                <div className="rule-gold mb-6 opacity-60" />
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
                  Full board
                </p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Top 25</h2>
                  <p className="text-sm text-muted-foreground">
                    Select or hover a team to see the breakdown.
                  </p>
                </div>
              </div>
              <RankingsTable teams={top25} />
            </section>
          </>
        )}

        <section id="formula" className="scroll-mt-10 pt-24">
          <div className="mb-8">
            <div className="rule-gold mb-6 opacity-60" />
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
              Methodology
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              How the formula works
            </h2>
          </div>
          <p className="max-w-3xl font-mono text-base text-muted-foreground sm:text-lg">
            <span className="text-gold-bright">Total</span> = Win Value + Loss Penalties +
            Road + Resume + Game Control
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {FORMULA_BLOCKS.map((block) => (
              <div key={block.n} className="bg-background p-7">
                <p className="font-mono text-xs text-primary">{block.n}</p>
                <h3 className="mt-2 text-xl font-bold">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="predictions-method" className="scroll-mt-10 pt-20">
          <div className="mb-8">
            <div className="rule-gold mb-6 opacity-60" />
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
              Predictions
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              How the predictions work
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              The rankings above are pure résumé. The predictions are a separate layer: they
              forecast what happens next, and they can only use information available
              before each game kicks off.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
            {PREDICTION_BLOCKS.map((block) => (
              <div key={block.n} className="bg-background p-7">
                <p className="font-mono text-xs text-primary">{block.n}</p>
                <h3 className="mt-2 text-xl font-bold">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10 text-center text-xs leading-relaxed text-muted-foreground">
        <p className="mx-auto max-w-2xl px-5">
          CFB Pure Merit Rankings is an unofficial fan analytics project. Not affiliated
          with, endorsed by, or sponsored by the College Football Playoff or the NCAA.
          Team logos are property of their respective schools. Data © CollegeFootballData
          contributors. Rankings and predictions refresh from live CFBD data every Sunday.
          Predictions are for entertainment, not betting advice.
        </p>
      </footer>
    </div>
  );
}
