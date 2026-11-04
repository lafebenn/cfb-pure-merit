import Podium from "@/components/Podium";
import RankingsTable from "@/components/RankingsTable";
import { fetchSeasonData } from "@/lib/cfbd";
import { calculateMeritRankings, topN } from "@/lib/meritFormula";

export const dynamic = "force-dynamic";

function formatUpdated(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/New_York",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

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
    <div className="flex flex-1 flex-col">
      <header className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
            {season} Season · Advanced Pure Merit
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            CFB Pure Merit Rankings
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            A transparent Top 25 built from FBS wins, tiered losses, road and quality
            bonuses, schedule strength, and capped game control — refreshed from live
            CollegeFootballData.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <p className="text-zinc-300">
              <span className="text-muted">Last updated</span>{" "}
              <span className="font-medium text-white">{formatUpdated(fetchedAt)} ET</span>
            </p>
            <a
              href="#formula"
              className="text-gold transition-colors hover:text-gold-bright"
            >
              How the formula works →
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {error ? (
          <div
            className="rounded-2xl border border-red-900/50 bg-red-950/40 px-5 py-6 text-sm text-red-100"
            role="alert"
          >
            <p className="font-semibold">Could not load rankings</p>
            <p className="mt-1 text-red-200/90">{error}</p>
          </div>
        ) : (
          <>
            <Podium teams={top25} />
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  Full board
                </p>
                <h2 className="text-xl font-semibold text-white sm:text-2xl">Top 25</h2>
              </div>
              <p className="hidden text-xs text-muted sm:block">
                Hover a row for the full breakdown
              </p>
            </div>
            <RankingsTable teams={top25} />
          </>
        )}

        <section
          id="formula"
          className="mt-14 scroll-mt-8 rounded-2xl border border-border bg-surface/60 p-6 sm:p-8"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
            Methodology
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Advanced Pure Merit Formula</h2>
          <p className="mt-2 font-mono text-sm text-gold-bright">
            Total = Base + Difficulty + Schedule Strength + Game Control
          </p>
          <div className="mt-6 grid gap-6 text-sm leading-relaxed text-zinc-300 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-white">1. Base value</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>+1.0 per FBS win (FCS wins = 0)</li>
                <li>Road loss vs &gt;.660: −0.5</li>
                <li>Standard loss vs ≥.500: −1.0</li>
                <li>Loss vs &lt;.500: −2.0</li>
                <li>Loss to FCS: −3.0</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-white">2. Difficulty modifiers</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>+0.5 per true road win (no neutral sites)</li>
                <li>+1.0 per win vs opponent currently above .500</li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-white">3. Schedule strength</h3>
              <p>OW% + 0.5 × OOW% using current opponent win percentages.</p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-white">4. Game control</h3>
              <p>Average point differential ÷ 100, capped at +0.17.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/80 py-8 text-center text-xs text-zinc-600">
        Unofficial fan rankings. Not affiliated with the College Football Playoff or NCAA.
        Data © CollegeFootballData contributors.
      </footer>
    </div>
  );
}
