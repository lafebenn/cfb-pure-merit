"use client";

import { useState } from "react";
import TeamLogo from "@/components/TeamLogo";
import type { BracketFormat, Predictions } from "@/lib/predictions";
import { pct } from "./format";

const FORMATS: { id: BracketFormat; label: string; blurb: string }[] = [
  {
    id: "real",
    label: "Real CFP",
    blurb:
      "5 highest-ranked conference champs + 7 at-large, ranked by our committee emulator (it learns the committee's habits, bias included).",
  },
  {
    id: "merit",
    label: "Pure Merit",
    blurb: "Top 12 of this board after the simulated season, seeded straight. No committee.",
  },
];

export default function TitleOdds({ predictions }: { predictions: Predictions }) {
  const [format, setFormat] = useState<BracketFormat>("real");
  const rows = predictions.titleOdds[format].slice(0, 8);
  const max = Math.max(...rows.map((r) => r.champion), 0.01);
  const active = FORMATS.find((f) => f.id === format)!;

  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
          Title odds
        </p>
        <div
          role="tablist"
          aria-label="Playoff format"
          className="inline-flex rounded-full border border-border p-0.5 text-xs"
        >
          {FORMATS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={format === f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                format === f.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">{active.blurb}</p>

      <ol className="mt-4 space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.teamId} className="flex items-center gap-3">
            <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
            <TeamLogo team={r} size={20} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">{r.school}</span>
                <span className="font-mono text-sm font-semibold text-gold-bright">
                  {pct(r.champion, 1)}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(r.champion / max) * 100}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                Playoff {pct(r.playoff)} · Semis {pct(r.semifinal)}
                {r.avgSeed ? ` · Avg seed ${r.avgSeed.toFixed(1)}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-auto pt-4 font-mono text-[10px] text-muted-foreground">
        The two formats agree on {predictions.fieldOverlap.toFixed(1)} of 12 playoff teams ·{" "}
        {predictions.nSims.toLocaleString()} simulations
      </p>
    </article>
  );
}
