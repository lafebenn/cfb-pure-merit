"""Build public/data/predictions.json: upset alerts, title odds (two formats), dark horse."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from scipy.stats import norm

from cfbml.config import PREDICTIONS_PATH, REPORTS_DIR, current_season
from cfbml.ingest.backfill import load_table
from cfbml.merit import merit_rankings
from cfbml.sim.season import STAGES, SeasonContext, load_context, simulate

SCHEMA_VERSION = 1
UPSET_MIN_PROB = 0.35
DARK_HORSE_OUTSIDE_TOP = 8
DARK_HORSE_EXCLUDE_FAVORITES = 6
TITLE_LIST_SIZE = 12


def _team_card(row: pd.Series | dict, ranks: dict) -> dict:
    tid = int(row["team_id"])
    return {
        "teamId": tid,
        "school": row["school"],
        "conference": row.get("conference"),
        "logo": row.get("logo"),
        "color": row.get("color"),
        "meritRank": ranks["merit"].get(tid),
        "committeeRank": ranks["committee"].get(tid),
    }


def current_ranks(ctx: SeasonContext) -> dict[str, dict[int, int]]:
    merit = merit_rankings(ctx.completed, ctx.teams.team_id.tolist())
    rk = load_table("rankings")
    rk = rk[(rk.season == ctx.season) & (rk.poll == "Playoff Committee Rankings")
            & (rk.season_type == "regular")]
    committee = {}
    if len(rk):
        latest = rk[rk.week == rk.week.max()]
        committee = {int(t): int(r) for t, r in zip(latest.team_id, latest["rank"])}
    return {"merit": {r.team_id: r.rank for r in merit}, "committee": committee}


def upset_alerts(ctx: SeasonContext, ranks: dict, limit: int = 6) -> tuple[int | None, list]:
    rem = ctx.remaining
    if rem.empty:
        return None, []
    per_week = rem.groupby("week").size()
    week = int(per_week[per_week >= 10].index.min()) if (per_week >= 10).any() else int(rem.week.min())
    wk = rem[rem.week == week]
    teams = ctx.teams.set_index("team_id")
    alerts = []
    for g in wk.itertuples(index=False):
        p_home = float(g.p_home)
        has_line = not pd.isna(g.spread)
        market_home = float(norm.cdf(-g.spread / ctx.sigma)) if has_line else None
        # Favorite per the market when there is a line, else per the model.
        ref = market_home if market_home is not None else p_home
        fav, dog = (g.home_id, g.away_id) if ref >= 0.5 else (g.away_id, g.home_id)
        dog_p = 1 - p_home if fav == g.home_id else p_home
        mkt_dog = None if market_home is None else (
            1 - market_home if fav == g.home_id else market_home)
        fav_rank = min(r for r in (ranks["committee"].get(fav), ranks["merit"].get(fav), 99)
                       if r is not None)
        if dog_p < UPSET_MIN_PROB or fav_rank > 25:
            continue
        card = lambda t: _team_card({"team_id": t, **teams.loc[t].to_dict()}, ranks)  # noqa: E731
        alerts.append({
            "gameId": int(g.game_id),
            "week": int(g.week),
            "kickoff": str(g.start_date),
            "neutralSite": bool(g.neutral_site),
            "homeTeamId": int(g.home_id),
            "favorite": card(fav),
            "underdog": card(dog),
            "underdogWinProb": round(dog_p, 4),
            "marketUnderdogWinProb": None if mkt_dog is None else round(mkt_dog, 4),
            "spread": None if not has_line else float(g.spread),
            "model": g.model,
            "score": round(dog_p * (26 - fav_rank) / 25, 4),
        })
    alerts.sort(key=lambda a: a["score"], reverse=True)
    return week, alerts[:limit]


def title_odds(sim_teams: pd.DataFrame, ctx: SeasonContext, ranks: dict, fmt: str) -> list[dict]:
    meta = ctx.teams.set_index("team_id")
    df = sim_teams.sort_values([f"{fmt}_champion", f"{fmt}_playoff"], ascending=False)
    out = []
    for r in df.head(TITLE_LIST_SIZE).itertuples(index=False):
        row = r._asdict()
        card = _team_card({"team_id": row["team_id"], **meta.loc[row["team_id"]].to_dict()}, ranks)
        card.update({stage: round(float(row[f"{fmt}_{stage}"]), 4) for stage in STAGES})
        card["avgSeed"] = None if pd.isna(row[f"{fmt}_avg_seed"]) else round(
            float(row[f"{fmt}_avg_seed"]), 2)
        card["confChampion"] = round(float(row["conf_champ"]), 4)
        out.append(card)
    return out


def projected_field(sim_teams: pd.DataFrame, fmt: str) -> list[dict]:
    """12 most likely playoff teams, seeded 1-12 by their average seed when they get in."""
    df = sim_teams.sort_values(f"{fmt}_playoff", ascending=False).head(12)
    df = df.sort_values([f"{fmt}_avg_seed", f"{fmt}_playoff"], ascending=[True, False])
    return [{"seed": i, "teamId": int(r.team_id), "school": r.school,
             "avgSeed": round(float(getattr(r, f"{fmt}_avg_seed")), 2),
             "playoff": round(float(getattr(r, f"{fmt}_playoff")), 4)}
            for i, r in enumerate(df.itertuples(index=False), 1)]


def dark_horse(sim_teams: pd.DataFrame, ctx: SeasonContext, ranks: dict) -> dict | None:
    """Best title odds among teams that are neither top-8 now nor a top-6 title favorite."""
    df = sim_teams.copy()
    df["merit_rank_now"] = df.team_id.map(ranks["merit"])
    favorites = set(df.nlargest(DARK_HORSE_EXCLUDE_FAVORITES, "real_champion").team_id)
    pool = df[(df.merit_rank_now > DARK_HORSE_OUTSIDE_TOP) & ~df.team_id.isin(favorites)]
    pool = pool[pool.real_champion > 0]
    if pool.empty:
        return None
    best = pool.sort_values(["real_champion", "merit_champion"], ascending=False).iloc[0]
    meta = ctx.teams.set_index("team_id").loc[best.team_id].to_dict()
    card = _team_card({"team_id": best.team_id, **meta}, ranks)
    card.update({
        "titleOdds": round(float(best.real_champion), 4),
        "titleOddsMerit": round(float(best.merit_champion), 4),
        "playoffOdds": round(float(best.real_playoff), 4),
        "playoffOddsMerit": round(float(best.merit_playoff), 4),
    })
    # Model-vs-market edge in its next game, when a line exists.
    rem = ctx.remaining
    nxt = rem[(rem.home_id == best.team_id) | (rem.away_id == best.team_id)].sort_values("kickoff")
    if len(nxt):
        g = nxt.iloc[0]
        home = g.home_id == best.team_id
        p = float(g.p_home if home else 1 - g.p_home)
        mkt = None
        if not pd.isna(g.spread):
            mh = float(norm.cdf(-g.spread / ctx.sigma))
            mkt = mh if home else 1 - mh
        opp = int(g.away_id if home else g.home_id)
        card["nextGame"] = {
            "gameId": int(g.game_id), "week": int(g.week),
            "opponent": ctx.teams.set_index("team_id").school.get(opp),
            "home": bool(home and not g.neutral_site),
            "winProb": round(p, 4),
            "marketWinProb": None if mkt is None else round(mkt, 4),
            "edge": None if mkt is None else round(p - mkt, 4),
        }
    return card


def _model_summary() -> dict:
    out = {}
    for name in ("game_backtest", "committee_backtest"):
        path = REPORTS_DIR / f"{name}.json"
        if path.exists():
            data = json.loads(path.read_text())
            out[name] = {"pooled": {k: v for k, v in data["pooled"].items()
                                    if not isinstance(v, list)},
                         "shipGate": data.get("ship_gate")}
    return out


def build(season: int, n_sims: int, seed: int) -> dict:
    ctx = load_context(season)
    teams_all = load_table("teams")
    meta = teams_all[teams_all.season == season].set_index("team_id")[["logo", "color"]]
    ctx.teams = ctx.teams.drop(columns=[c for c in ("logo", "color") if c in ctx.teams]).merge(
        meta, left_on="team_id", right_index=True, how="left")
    ranks = current_ranks(ctx)
    week, alerts = upset_alerts(ctx, ranks)
    sim = simulate(ctx, n_sims=n_sims, seed=seed)
    st = sim["teams"]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "season": season,
        "nextWeek": week,
        "nSims": n_sims,
        "remainingGames": int(len(ctx.remaining)),
        "upsetAlerts": alerts,
        "titleOdds": {"real": title_odds(st, ctx, ranks, "real"),
                      "merit": title_odds(st, ctx, ranks, "merit")},
        "projectedField": {"real": projected_field(st, "real"),
                           "merit": projected_field(st, "merit")},
        "fieldOverlap": round(sim["field_overlap_mean"], 2),
        "darkHorse": dark_horse(st, ctx, ranks),
        "models": _model_summary(),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=current_season())
    ap.add_argument("--sims", type=int, default=10_000)
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()
    out = build(args.season, args.sims, args.seed)
    PREDICTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREDICTIONS_PATH.write_text(json.dumps(out, indent=1, default=_json_default))
    print(f"wrote {PREDICTIONS_PATH} ({out['nSims']} sims, {len(out['upsetAlerts'])} alerts)")


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    return str(o)


if __name__ == "__main__":
    main()
