import type { TeamMeritResult } from "@/lib/meritFormula";

/**
 * Schools whose marks are mostly black / navy / charcoal and vanish on our dark UI.
 * Prefer a white (or school light) plate + soft outline so black ink reads.
 */
const DARK_LOGO_SCHOOLS = new Set([
  "Wake Forest",
  "Ohio State",
  "Colorado",
  "Iowa",
  "Purdue",
  "Vanderbilt",
  "Missouri",
  "Cincinnati",
  "UCF",
  "Army",
  "Navy",
  "Georgia Southern",
  "App State",
  "Appalachian State",
  "Michigan State",
  "Oregon State",
  "Colorado State",
  "South Florida",
  "Temple",
  "East Carolina",
  "Charlotte",
  "Kennesaw State",
  "Georgia",
  "Texas Tech",
]);

/** Team-specific light plates — white by default; school light when it helps brand. */
const LIGHT_PLATES: Record<string, string> = {
  "Wake Forest": "#F7F0DC", // old-gold wash so black WF pops
  "Ohio State": "#F2F2F2", // light gray so the black banner across the O reads
  Colorado: "#CFB87C",
  Iowa: "#FFCD00",
  Purdue: "#CFB991",
  Vanderbilt: "#CFAE70",
  Missouri: "#F1B82D",
  Cincinnati: "#FFFFFF",
  UCF: "#FFC904",
  Army: "#D4AF37",
  Navy: "#C5B783",
  "Georgia Southern": "#F0E6D2",
  "App State": "#FFC72C",
  "Appalachian State": "#FFC72C",
  "Michigan State": "#FFFFFF",
  "Oregon State": "#FFFFFF",
  "Colorado State": "#FFFFFF",
  Georgia: "#FFFFFF",
  "Texas Tech": "#FFFFFF",
};

function needsHalo(school: string, color: string | null): boolean {
  if (DARK_LOGO_SCHOOLS.has(school)) return true;
  if (!color) return false;
  const hex = color.replace("#", "");
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.22;
}

function plateColor(
  school: string,
  teamColor: string | null,
  forceLight: boolean
): string {
  if (forceLight) {
    return LIGHT_PLATES[school] ?? "#FFFFFF";
  }
  if (!teamColor) return "rgba(255, 255, 255, 0.92)";
  return `color-mix(in srgb, ${teamColor} 14%, #FFFFFF)`;
}

interface TeamLogoProps {
  team: Pick<TeamMeritResult, "school" | "logo" | "color">;
  size?: number;
  className?: string;
  /** Larger plate padding for hero / champion */
  prominent?: boolean;
}

export default function TeamLogo({
  team,
  size = 40,
  className = "",
  prominent = false,
}: TeamLogoProps) {
  const dark = needsHalo(team.school, team.color);
  const pad = prominent ? 0.28 : dark ? 0.22 : 0.16;
  const box = Math.round(size * (1 + pad * 2));
  const img = Math.round(size * (dark || prominent ? 0.72 : 0.86));

  if (!team.logo) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-black ${className}`}
        style={{
          width: box,
          height: box,
          background: team.color || "var(--primary)",
        }}
        aria-hidden
      >
        {team.school.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className={`team-logo-plate inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: box,
        height: box,
        background: plateColor(team.school, team.color, dark),
        boxShadow: dark
          ? "0 0 0 2px rgba(255,255,255,0.75), 0 0 16px rgba(255,255,255,0.18)"
          : "0 0 0 1px rgba(255,255,255,0.14)",
      }}
      title={team.school}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={team.logo}
        alt=""
        width={img}
        height={img}
        className="object-contain"
        style={{
          width: img,
          height: img,
          // Extra white edge so black ink / banners don't dissolve into dark UI
          filter: dark
            ? "drop-shadow(0 0 0.8px #fff) drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 0 3px rgba(255,255,255,0.45))"
            : undefined,
        }}
      />
    </span>
  );
}
