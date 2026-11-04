"use client";

import { useId, useState } from "react";
import type { TeamMeritResult } from "@/lib/meritFormula";

interface RankingsTableProps {
  teams: TeamMeritResult[];
}

function fmt(n: number, digits = 3): string {
  return n.toFixed(digits);
}

function TeamMark({ team, size = 36 }: { team: TeamMeritResult; size?: number }) {
  if (team.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logo}
        alt=""
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-xs font-bold text-black"
      style={{
        width: size,
        height: size,
        background: team.color || "#c9a227",
      }}
    >
      {team.school.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Breakdown({ team }: { team: TeamMeritResult }) {
  const lb = team.lossBreakdown;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
          Base & difficulty
        </p>
        <ul className="space-y-1 text-sm text-zinc-300">
          <li>
            FBS wins <span className="float-right font-mono text-white">{team.fbsWins}</span>
          </li>
          {team.voidedFcsWins > 0 && (
            <li>
              FCS wins voided{" "}
              <span className="float-right font-mono text-zinc-500">{team.voidedFcsWins}</span>
            </li>
          )}
          <li>
            Road wins{" "}
            <span className="float-right font-mono text-white">
              {team.roadWins}{" "}
              <span className="text-zinc-500">(+{fmt(team.roadPoints, 1)})</span>
            </span>
          </li>
          <li>
            Quality wins{" "}
            <span className="float-right font-mono text-white">
              {team.qualityWins}{" "}
              <span className="text-zinc-500">(+{fmt(team.qualityWins, 1)})</span>
            </span>
          </li>
        </ul>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
          Loss penalties
        </p>
        <ul className="space-y-1 text-sm text-zinc-300">
          <li>
            Road vs &gt;.660{" "}
            <span className="float-right font-mono text-white">
              {lb.roadStrong}
              {lb.roadStrong > 0 && (
                <span className="text-zinc-500"> (−{fmt(lb.roadStrong * 0.5, 1)})</span>
              )}
            </span>
          </li>
          <li>
            Standard ≥.500{" "}
            <span className="float-right font-mono text-white">
              {lb.standard}
              {lb.standard > 0 && (
                <span className="text-zinc-500"> (−{fmt(lb.standard, 1)})</span>
              )}
            </span>
          </li>
          <li>
            Weak &lt;.500{" "}
            <span className="float-right font-mono text-white">
              {lb.weak}
              {lb.weak > 0 && <span className="text-zinc-500"> (−{fmt(lb.weak * 2, 1)})</span>}
            </span>
          </li>
          <li>
            FCS losses{" "}
            <span className="float-right font-mono text-white">
              {lb.fcs}
              {lb.fcs > 0 && <span className="text-zinc-500"> (−{fmt(lb.fcs * 3, 1)})</span>}
            </span>
          </li>
        </ul>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
          Schedule & control
        </p>
        <ul className="space-y-1 text-sm text-zinc-300">
          <li>
            OW% <span className="float-right font-mono text-white">{fmt(team.owPct)}</span>
          </li>
          <li>
            OOW% <span className="float-right font-mono text-white">{fmt(team.oowPct)}</span>
          </li>
          <li>
            SOS <span className="float-right font-mono text-white">{fmt(team.sosScore)}</span>
          </li>
          <li>
            Avg margin{" "}
            <span className="float-right font-mono text-white">
              {team.avgPointDiff.toFixed(1)}{" "}
              <span className="text-zinc-500">→ {fmt(team.gameControl)}</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function RankingsTable({ teams }: RankingsTableProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const labelId = useId();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left" aria-labelledby={labelId}>
          <caption id={labelId} className="sr-only">
            Advanced Pure Merit Top {teams.length} rankings
          </caption>
          <thead>
            <tr className="border-b border-border bg-black/50 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
              <th className="px-4 py-3.5 sm:px-5">Rank</th>
              <th className="px-4 py-3.5 sm:px-5">Team</th>
              <th className="px-4 py-3.5 sm:px-5">Record</th>
              <th className="px-4 py-3.5 text-right sm:px-5">Merit</th>
              <th className="hidden px-4 py-3.5 text-right sm:table-cell sm:px-5">Base</th>
              <th className="hidden px-4 py-3.5 text-right md:table-cell md:px-5">Road</th>
              <th className="hidden px-4 py-3.5 text-right md:table-cell md:px-5">&gt;.500</th>
              <th className="hidden px-4 py-3.5 text-right lg:table-cell lg:px-5">SOS</th>
              <th className="hidden px-4 py-3.5 text-right lg:table-cell lg:px-5">PD Cap</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const open = activeId === team.teamId;
              return (
                <tr
                  key={team.teamId}
                  className={`group border-b border-white/[0.04] transition-colors ${
                    open ? "bg-gold/5" : "hover:bg-white/[0.03]"
                  }`}
                  onMouseEnter={() => setActiveId(team.teamId)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(team.teamId)}
                  onBlur={() => setActiveId(null)}
                  tabIndex={0}
                >
                  <td colSpan={9} className="p-0">
                    <div className="grid grid-cols-[3rem_minmax(0,1.4fr)_4.5rem_5rem] items-center gap-0 sm:grid-cols-[3.5rem_minmax(0,1.6fr)_4.5rem_5.5rem_4.5rem] md:grid-cols-[3.5rem_minmax(0,1.5fr)_4.5rem_5.5rem_4.5rem_4rem_4rem] lg:grid-cols-[3.5rem_minmax(0,1.4fr)_4.5rem_5.5rem_4.5rem_4rem_4rem_4.5rem_4.5rem]">
                      <div
                        className={`px-4 py-3.5 font-mono text-sm font-semibold sm:px-5 ${
                          team.rank <= 4 ? "text-gold-bright" : "text-gold"
                        }`}
                      >
                        {team.rank}
                      </div>
                      <div className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
                        <TeamMark team={team} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold tracking-tight text-white">
                            {team.school}
                          </p>
                          {team.conference && (
                            <p className="truncate text-xs text-muted">{team.conference}</p>
                          )}
                        </div>
                      </div>
                      <div className="px-4 py-3.5 font-mono text-sm text-zinc-200 sm:px-5">
                        {team.recordLabel}
                      </div>
                      <div className="px-4 py-3.5 text-right font-mono text-sm font-bold text-white sm:px-5">
                        {fmt(team.meritScore)}
                      </div>
                      <div className="hidden px-4 py-3.5 text-right font-mono text-sm text-zinc-300 sm:block sm:px-5">
                        {fmt(team.basePoints, 1)}
                      </div>
                      <div className="hidden px-4 py-3.5 text-right font-mono text-sm text-zinc-300 md:block md:px-5">
                        +{fmt(team.roadPoints, 1)}
                      </div>
                      <div className="hidden px-4 py-3.5 text-right font-mono text-sm text-zinc-300 md:block md:px-5">
                        {team.qualityWins}
                      </div>
                      <div className="hidden px-4 py-3.5 text-right font-mono text-sm text-zinc-300 lg:block lg:px-5">
                        {fmt(team.sosScore)}
                      </div>
                      <div className="hidden px-4 py-3.5 text-right font-mono text-sm text-zinc-300 lg:block lg:px-5">
                        +{fmt(team.gameControl)}
                      </div>
                    </div>
                    <div
                      className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-border/60 bg-black/40 px-4 py-4 sm:px-5">
                          <Breakdown team={team} />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
