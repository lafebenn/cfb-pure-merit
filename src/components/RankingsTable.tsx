"use client";

import { Fragment, useId, useState } from "react";
import TeamLogo from "@/components/TeamLogo";
import { MERIT_CONSTANTS, type TeamMeritResult } from "@/lib/meritFormula";

interface RankingsTableProps {
  teams: TeamMeritResult[];
}

function fmt(n: number, digits = 3): string {
  return n.toFixed(digits);
}

function recordDisplay(label: string): string {
  return label.replace(/-/g, "–");
}

function Breakdown({ team }: { team: TeamMeritResult }) {
  const lb = team.lossBreakdown;
  const C = MERIT_CONSTANTS;
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Wins & road
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex justify-between gap-4">
            <span>FBS wins</span>
            <span className="font-mono text-foreground">{team.fbsWins}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Win value Σ</span>
            <span className="font-mono text-foreground">{fmt(team.winValueSum)}</span>
          </li>
          {team.voidedFcsWins > 0 && (
            <li className="flex justify-between gap-4">
              <span>FCS scrubbed</span>
              <span className="font-mono">{team.voidedFcsWins}</span>
            </li>
          )}
          <li className="flex justify-between gap-4">
            <span>Road wins</span>
            <span className="font-mono text-foreground">
              {team.roadWins}{" "}
              <span className="text-muted-foreground">(+{fmt(team.roadPoints, 2)})</span>
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Wins vs &gt;.500</span>
            <span className="font-mono text-foreground">{team.qualityWins}</span>
          </li>
        </ul>
      </div>
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Loss penalties
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex justify-between gap-4">
            <span>Road vs &gt;.660</span>
            <span className="font-mono text-foreground">
              {lb.roadStrong}
              {lb.roadStrong > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({fmt(lb.roadStrong * C.LOSS_ROAD_STRONG, 2)})
                </span>
              )}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Standard ≥.500</span>
            <span className="font-mono text-foreground">
              {lb.standard}
              {lb.standard > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({fmt(lb.standard * C.LOSS_STANDARD, 2)})
                </span>
              )}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Weak home</span>
            <span className="font-mono text-foreground">
              {lb.weakHome}
              {lb.weakHome > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({fmt(lb.weakHome * C.LOSS_WEAK_HOME, 2)})
                </span>
              )}
            </span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Weak road</span>
            <span className="font-mono text-foreground">
              {lb.weakRoad}
              {lb.weakRoad > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({fmt(lb.weakRoad * C.LOSS_WEAK_ROAD, 2)})
                </span>
              )}
            </span>
          </li>
          <li className="flex justify-between gap-4 border-t border-border pt-1.5">
            <span>After compound ×{fmt(team.lossCompoundFactor, 2)}</span>
            <span className="font-mono text-foreground">{fmt(team.lossPenalty, 2)}</span>
          </li>
        </ul>
      </div>
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Resume & control
        </p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li className="flex justify-between gap-4">
            <span>OW%</span>
            <span className="font-mono text-foreground">{fmt(team.owPct)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span>OOW%</span>
            <span className="font-mono text-foreground">{fmt(team.oowPct)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Resume</span>
            <span className="font-mono text-foreground">{fmt(team.sosScore)}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span>Avg margin</span>
            <span className="font-mono text-foreground">
              {team.avgPointDiff.toFixed(1)}{" "}
              <span className="text-muted-foreground">→ {fmt(team.gameControl)}</span>
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
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[860px] border-collapse text-sm"
          aria-labelledby={labelId}
        >
          <caption id={labelId} className="sr-only">
            Advanced Pure Merit Top {teams.length} rankings
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted">
              {(
                [
                  ["Rank", "left"],
                  ["Team", "left"],
                  ["Record", "right"],
                  ["Merit", "right"],
                  ["Win Σ", "right"],
                  ["Road", "right"],
                  ["Resume", "right"],
                  ["Loss", "right"],
                  ["GC", "right"],
                ] as const
              ).map(([label, align]) => (
                <th
                  key={label}
                  className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-primary ${
                    align === "right" ? "text-right" : "text-left"
                  } ${label === "Team" ? "sticky left-0 z-10 bg-muted" : ""}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const open = activeId === team.teamId;
              return (
                <Fragment key={team.teamId}>
                  <tr
                    tabIndex={0}
                    className={`group cursor-pointer border-b border-border outline-none transition-colors hover:bg-accent/60 ${
                      open ? "bg-accent/60" : ""
                    }`}
                    onMouseEnter={() => setActiveId(team.teamId)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(team.teamId)}
                    onBlur={() => setActiveId(null)}
                  >
                    <td className="px-4 py-3 font-mono text-base font-semibold text-primary">
                      {team.rank}
                    </td>
                    <td
                      className={`sticky left-0 z-10 px-4 py-3 transition-colors ${
                        open ? "bg-accent" : "bg-background group-hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <TeamLogo team={team} size={28} />
                        <div>
                          <div className="font-semibold">{team.school}</div>
                          {team.conference && (
                            <div className="text-xs text-muted-foreground">
                              {team.conference}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {recordDisplay(team.recordLabel)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-base font-semibold text-gold-bright">
                      {fmt(team.meritScore)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmt(team.winValueSum)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      +{fmt(team.roadPoints, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(team.sosScore)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmt(team.lossPenalty, 2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      +{fmt(team.gameControl)}
                    </td>
                  </tr>
                  <tr
                    className="border-b border-border"
                    onMouseEnter={() => setActiveId(team.teamId)}
                    onMouseLeave={() => setActiveId(null)}
                  >
                    <td colSpan={9} className="p-0">
                      <div
                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="bg-card/80 px-4 py-5 sm:px-6">
                            <Breakdown team={team} />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
