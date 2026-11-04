import Podium from "@/components/Podium";
import RankingsTable from "@/components/RankingsTable";
import { fetchSeasonData } from "@/lib/cfbd";
import { calculateMeritRankings, topN } from "@/lib/meritFormula";

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

export default async function Home() {
  let error: string | null = null;
  let season = new Date().getFullYear();
  let fetchedAt = new Date().toISOString();
  let top25 = [] as ReturnType<typeof topN>;

  try {
    const data = await fetchSeasonData();
    season = data.season;
    fetchedAt = data.fetchedAt;
    top25 = topN(calculateMeritRankings(data), 25);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load rankings.";
  }

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
            <Podium teams={top25} />

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
      </main>

      <footer className="border-t border-border py-10 text-center text-xs leading-relaxed text-muted-foreground">
        <p className="mx-auto max-w-2xl px-5">
          CFB Pure Merit Rankings is an unofficial fan analytics project. Not affiliated
          with, endorsed by, or sponsored by the College Football Playoff or the NCAA.
          Team logos are property of their respective schools. Data © CollegeFootballData
          contributors. Rankings refresh from live CFBD data every Sunday.
        </p>
      </footer>
    </div>
  );
}
