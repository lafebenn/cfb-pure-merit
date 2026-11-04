import RankingsTable from "@/components/RankingsTable";
import { fetchSeasonData } from "@/lib/cfbd";
import { calculateMeritRankings, topN } from "@/lib/meritFormula";

export const revalidate = 43200; // 12 hours

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
      <header className="border-b border-zinc-800 bg-black/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {season} Season · Top 25
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            CFB Pure Merit Rankings
          </h1>
          <p className="text-sm text-zinc-400">
            Last updated: {formatUpdated(fetchedAt)} ET
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">
            Rankings use an Advanced Pure Merit Formula: FBS wins, tiered loss
            penalties, road and quality-win bonuses, schedule strength (OW% +
            0.5×OOW%), and capped game control. Data via CollegeFootballData.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {error ? (
          <div
            className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-6 text-sm text-red-200"
            role="alert"
          >
            <p className="font-semibold text-red-100">Could not load rankings</p>
            <p className="mt-1 text-red-300/90">{error}</p>
          </div>
        ) : (
          <RankingsTable teams={top25} />
        )}
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        Unofficial fan rankings. Not affiliated with the College Football Playoff
        or NCAA.
      </footer>
    </div>
  );
}
