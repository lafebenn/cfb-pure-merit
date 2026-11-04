"use client";

import { Fragment, useState } from "react";
import type { TeamMeritResult } from "@/lib/meritFormula";

interface RankingsTableProps {
  teams: TeamMeritResult[];
}

function formatScore(n: number, digits = 3): string {
  return n.toFixed(digits);
}

function BreakdownPanel({ team }: { team: TeamMeritResult }) {
  const { lossBreakdown: lb } = team;
  return (
    <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold">
          Difficulty bonuses
        </p>
        <ul className="space-y-0.5">
          <li>
            Road wins: <span className="text-white">{team.roadWins}</span>{" "}
            <span className="text-zinc-500">(+{(team.roadWins * 0.5).toFixed(1)})</span>
          </li>
          <li>
            Quality wins (&gt;.500):{" "}
            <span className="text-white">{team.qualityWins}</span>{" "}
            <span className="text-zinc-500">(+{team.qualityWins.toFixed(1)})</span>
          </li>
          <li>
            FBS wins (base): <span className="text-white">{team.fbsWins}</span>
          </li>
        </ul>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold">
          Loss penalties
        </p>
        <ul className="space-y-0.5">
          <li>
            Road vs &gt;.660: <span className="text-white">{lb.roadStrong}</span>{" "}
            <span className="text-zinc-500">
              ({lb.roadStrong ? `−${(lb.roadStrong * 0.5).toFixed(1)}` : "0"})
            </span>
          </li>
          <li>
            Standard (≥.500): <span className="text-white">{lb.standard}</span>{" "}
            <span className="text-zinc-500">
              ({lb.standard ? `−${lb.standard.toFixed(1)}` : "0"})
            </span>
          </li>
          <li>
            Weak (&lt;.500): <span className="text-white">{lb.weak}</span>{" "}
            <span className="text-zinc-500">
              ({lb.weak ? `−${(lb.weak * 2).toFixed(1)}` : "0"})
            </span>
          </li>
          <li>
            FCS losses: <span className="text-white">{lb.fcs}</span>{" "}
            <span className="text-zinc-500">
              ({lb.fcs ? `−${(lb.fcs * 3).toFixed(1)}` : "0"})
            </span>
          </li>
        </ul>
      </div>
      <div className="sm:col-span-2 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
        SOS {formatScore(team.sosScore)} (OW% {formatScore(team.owPct)} + 0.5×OOW%{" "}
        {formatScore(team.oowPct)}) · Game control {formatScore(team.gameControl)}{" "}
        (avg margin {team.avgPointDiff.toFixed(1)})
      </div>
    </div>
  );
}

export default function RankingsTable({ teams }: RankingsTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-black text-xs uppercase tracking-wider text-gold">
            <th className="px-3 py-3 font-semibold sm:px-4">Rank</th>
            <th className="px-3 py-3 font-semibold sm:px-4">Team</th>
            <th className="px-3 py-3 font-semibold sm:px-4">Record</th>
            <th className="px-3 py-3 font-semibold sm:px-4">Merit</th>
            <th className="hidden px-3 py-3 font-semibold sm:table-cell sm:px-4">Base</th>
            <th className="hidden px-3 py-3 font-semibold md:table-cell md:px-4">
              Qual. Wins
            </th>
            <th className="hidden px-3 py-3 font-semibold lg:table-cell lg:px-4">SOS</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const open = expandedId === team.teamId;
            return (
              <Fragment key={team.teamId}>
                <tr
                  className="border-b border-zinc-900 transition-colors hover:bg-zinc-900/80 focus-within:bg-zinc-900/80"
                  onMouseEnter={() => setExpandedId(team.teamId)}
                  onMouseLeave={() => setExpandedId(null)}
                  onFocus={() => setExpandedId(team.teamId)}
                  tabIndex={0}
                >
                  <td className="px-3 py-3 font-mono text-gold sm:px-4">{team.rank}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logo}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 object-contain"
                        />
                      ) : (
                        <div className="h-7 w-7 shrink-0 rounded-full bg-zinc-800" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{team.school}</p>
                        {team.conference && (
                          <p className="truncate text-xs text-zinc-500">{team.conference}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-zinc-200 sm:px-4">
                    {team.recordLabel}
                  </td>
                  <td className="px-3 py-3 font-mono font-semibold text-white sm:px-4">
                    {formatScore(team.meritScore)}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-zinc-300 sm:table-cell sm:px-4">
                    {formatScore(team.basePoints)}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-zinc-300 md:table-cell md:px-4">
                    {team.qualityWins}
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-zinc-300 lg:table-cell lg:px-4">
                    {formatScore(team.sosScore)}
                  </td>
                </tr>
                <tr
                  className={`border-b border-zinc-900 bg-black/60 transition-opacity ${
                    open ? "opacity-100" : "pointer-events-none hidden opacity-0"
                  }`}
                  onMouseEnter={() => setExpandedId(team.teamId)}
                  onMouseLeave={() => setExpandedId(null)}
                >
                  <td colSpan={7} className="px-4 py-3">
                    <BreakdownPanel team={team} />
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
