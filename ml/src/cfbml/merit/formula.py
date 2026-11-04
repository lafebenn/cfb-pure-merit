"""Python port of src/lib/meritFormula.ts (Pure Merit v2). Keep constants and logic in sync."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Mapping

MERIT_CONSTANTS = {
    "WIN_VALUE_BASE": 0.55,
    "WIN_VALUE_SLOPE": 0.9,
    "LOSS_ROAD_STRONG": -0.55,
    "LOSS_STANDARD": -0.75,
    "LOSS_WEAK_HOME": -1.1,
    "LOSS_WEAK_ROAD": -0.7,
    "LOSS_COMPOUND_K": 0.45,
    "ROAD_WIN": 0.35,
    "ROAD_POINTS_CAP": 1.0,
    "RESUME_SCALE": 3.2,
    "RESUME_OOW_WEIGHT": 1.0,
    "GC_CAP": 0.02,
}
C = MERIT_CONSTANTS


@dataclass(slots=True)
class MeritGame:
    home_id: int
    away_id: int
    home_points: float
    away_points: float
    neutral_site: bool
    week: int = 0
    start_date: str = ""


@dataclass(slots=True)
class MeritResult:
    team_id: int
    school: str
    merit_score: float
    wins: int
    losses: int
    ties: int
    win_value_sum: float
    road_wins: int
    road_points: float
    quality_wins: int
    sos_score: float
    ow_pct: float
    oow_pct: float
    game_control: float
    avg_point_diff: float
    loss_penalty: float
    loss_compound_factor: float
    rank: int = 0
    loss_breakdown: dict[str, int] = field(default_factory=dict)


def _win_pct(w: int, l: int, t: int) -> float:
    n = w + l + t
    return 0.0 if n <= 0 else (w + 0.5 * t) / n


def _loss_tier(opp_pct: float, road: bool) -> tuple[float, str]:
    if opp_pct > 0.66 and road:
        return C["LOSS_ROAD_STRONG"], "roadStrong"
    if opp_pct >= 0.5:
        return C["LOSS_STANDARD"], "standard"
    if road:
        return C["LOSS_WEAK_ROAD"], "weakRoad"
    return C["LOSS_WEAK_HOME"], "weakHome"


def merit_rankings(
    games: Iterable[MeritGame],
    fbs_ids: Iterable[int],
    schools: Mapping[int, str] | None = None,
) -> list[MeritResult]:
    """`games` must already be completed, regular-season, FBS-vs-FBS games."""
    fbs = set(fbs_ids)
    schools = schools or {}
    fbs_games = [g for g in games if g.home_id in fbs and g.away_id in fbs]

    wins = {i: 0 for i in fbs}
    losses = {i: 0 for i in fbs}
    ties = {i: 0 for i in fbs}
    opps: dict[int, list[int]] = {i: [] for i in fbs}
    team_games: dict[int, list[MeritGame]] = {i: [] for i in fbs}

    for g in fbs_games:
        opps[g.home_id].append(g.away_id)
        opps[g.away_id].append(g.home_id)
        team_games[g.home_id].append(g)
        team_games[g.away_id].append(g)
        if g.home_points > g.away_points:
            wins[g.home_id] += 1
            losses[g.away_id] += 1
        elif g.away_points > g.home_points:
            wins[g.away_id] += 1
            losses[g.home_id] += 1
        else:
            ties[g.home_id] += 1
            ties[g.away_id] += 1

    global_pct = {i: _win_pct(wins[i], losses[i], ties[i]) for i in fbs}

    results: list[MeritResult] = []
    for tid in fbs:
        breakdown = {"roadStrong": 0, "standard": 0, "weakHome": 0, "weakRoad": 0}
        fbs_wins = road_wins = quality_wins = 0
        win_value_sum = 0.0
        pf = pa = 0.0
        played = 0
        loss_base = 0.0
        loss_count = 0
        ow_sum = 0.0
        ow_n = 0
        oow_sum = 0.0
        oow_n = 0

        for g in sorted(team_games[tid], key=lambda x: (x.week, x.start_date)):
            is_home = g.home_id == tid
            tp = g.home_points if is_home else g.away_points
            op = g.away_points if is_home else g.home_points
            oid = g.away_id if is_home else g.home_id

            pf += tp
            pa += op
            played += 1
            won, lost = tp > op, tp < op
            road = (not is_home) and (not g.neutral_site)

            ow, ol, ot = wins[oid], losses[oid], ties[oid]
            if won:
                ol = max(0, ol - 1)
            elif lost:
                ow = max(0, ow - 1)
            else:
                ot = max(0, ot - 1)
            adj = _win_pct(ow, ol, ot)

            ow_sum += adj
            ow_n += 1

            opp_opps = [x for x in opps[oid] if x != tid]
            if opp_opps:
                oow_sum += sum(global_pct.get(x, 0.0) for x in opp_opps) / len(opp_opps)
                oow_n += 1

            if won:
                fbs_wins += 1
                win_value_sum += C["WIN_VALUE_BASE"] + C["WIN_VALUE_SLOPE"] * adj
                if road:
                    road_wins += 1
                if adj > 0.5:
                    quality_wins += 1
            elif lost:
                pts, bucket = _loss_tier(adj, road)
                loss_base += pts
                loss_count += 1
                breakdown[bucket] += 1

        compound = 1.0 if loss_count <= 1 else 1 + C["LOSS_COMPOUND_K"] * (loss_count - 1)
        loss_penalty = loss_base * compound
        road_points = min(road_wins * C["ROAD_WIN"], C["ROAD_POINTS_CAP"])
        ow_pct = ow_sum / ow_n if ow_n else 0.0
        oow_pct = oow_sum / oow_n if oow_n else 0.0
        sos = C["RESUME_SCALE"] * (ow_pct + C["RESUME_OOW_WEIGHT"] * oow_pct)
        apd = (pf - pa) / played if played else 0.0
        gc = min(max(apd, 0.0) / 100, C["GC_CAP"])

        results.append(MeritResult(
            team_id=tid,
            school=schools.get(tid, str(tid)),
            merit_score=win_value_sum + loss_penalty + road_points + sos + gc,
            wins=wins[tid],
            losses=losses[tid],
            ties=ties[tid],
            win_value_sum=win_value_sum,
            road_wins=road_wins,
            road_points=road_points,
            quality_wins=quality_wins,
            sos_score=sos,
            ow_pct=ow_pct,
            oow_pct=oow_pct,
            game_control=gc,
            avg_point_diff=apd,
            loss_penalty=loss_penalty,
            loss_compound_factor=compound,
            loss_breakdown=breakdown,
        ))

    results.sort(key=lambda r: (-r.merit_score, r.school))
    for i, r in enumerate(results):
        r.rank = i + 1
    return results


def games_from_frame(df) -> list[MeritGame]:
    """Completed regular-season rows from the processed games table."""
    sub = df[(df["completed"]) & (df["season_type"] == "regular")]
    sub = sub.dropna(subset=["home_points", "away_points"])
    return [
        MeritGame(
            int(r.home_id), int(r.away_id), float(r.home_points), float(r.away_points),
            bool(r.neutral_site), int(r.week), str(r.start_date),
        )
        for r in sub.itertuples(index=False)
    ]
