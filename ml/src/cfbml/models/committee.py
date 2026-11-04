"""Committee emulator: LambdaRank trained on weekly CFP committee rankings (2014+).

Unlike the game model, this one *does* see conference and program brand — its job is to
reproduce what the real committee does, bias included.
"""

from __future__ import annotations

import argparse
import json

import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from cfbml.config import ARTIFACTS_DIR, PROCESSED_DIR, REPORTS_DIR, TEST_SEASONS
from cfbml.ingest.backfill import load_table
from cfbml.sim.conferences import CONF_ONEHOT, championship_games, champions, is_power

SNAPSHOT_COLS = ["adj_off_ppa", "adj_def_ppa", "margin", "elo", "sp_prior"]
FEATURES = [
    "merit_score", "merit_rank", "merit_wins", "merit_losses", "merit_sos",
    "unbeaten", "one_loss", *SNAPSHOT_COLS,
    "conf_champ", "power_conf", *[f"conf_{c}" for c in CONF_ONEHOT],
    "brand_top25_10y", "prev_final_rank", "weeks_to_final",
]
PARAMS = {
    "objective": "lambdarank",
    "metric": "ndcg",
    "ndcg_eval_at": [4, 12, 25],
    "learning_rate": 0.05,
    "num_leaves": 15,
    "min_data_in_leaf": 20,
    "feature_fraction": 0.85,
    "lambdarank_truncation_level": 30,
    "verbose": -1,
    "seed": 11,
}
# Relevance for rank r (1..25) = 26 - r; unranked = 0. Gains grow super-linearly so the top matters most.
LABEL_GAIN = [float(i) ** 1.6 for i in range(26)]


def brand_table() -> pd.DataFrame:
    """Top-25 finishes in the previous 10 seasons + last season's final rank, per team-season."""
    c = load_table("coaches").dropna(subset=["team_id"])
    fin = (c.sort_values("games", ascending=False)
           .drop_duplicates(["season", "team_id"])[["season", "team_id", "postseason_rank"]])
    rows = []
    teams = load_table("teams")[["season", "team_id"]].drop_duplicates()
    by_team = {k: v.set_index("season").postseason_rank for k, v in fin.groupby("team_id")}
    for s, t in zip(teams.season, teams.team_id):
        hist = by_team.get(t)
        if hist is None:
            rows.append((s, t, 0, np.nan))
            continue
        window = hist[(hist.index >= s - 10) & (hist.index < s)]
        rows.append((s, t, int(window.notna().sum()), hist.get(s - 1, np.nan)))
    return pd.DataFrame(rows, columns=["season", "team_id", "brand_top25_10y", "prev_final_rank"])


def team_snapshots(gf: pd.DataFrame) -> pd.DataFrame:
    """Each team's as-of efficiency snapshot at each of its games (home or away side)."""
    parts = []
    for side in ("home", "away"):
        p = gf[["season", "week", "season_type", "kickoff", f"{side}_id"]
               + [f"{side}_{c}" for c in SNAPSHOT_COLS]].copy()
        p.columns = ["season", "week", "season_type", "kickoff", "team_id"] + SNAPSHOT_COLS
        parts.append(p)
    snap = pd.concat(parts).sort_values("kickoff")
    snap["order_week"] = np.where(snap.season_type == "postseason", 99, snap.week)
    return snap


def snapshot_at(snap: pd.DataFrame, season: int, week: int) -> pd.DataFrame:
    """Snapshot from each team's first game at/after `week` (its features only see earlier games).

    Teams with no later game fall back to their final game of the season.
    """
    s = snap[snap.season == season]
    nxt = s[s.order_week >= week].drop_duplicates("team_id", keep="first")
    last = s.drop_duplicates("team_id", keep="last")
    last = last[~last.team_id.isin(nxt.team_id)]
    return pd.concat([nxt, last])[["team_id"] + SNAPSHOT_COLS]


def build_rows(season: int, week: int, merit_week: int, merit: pd.DataFrame,
               snap: pd.DataFrame, teams: pd.DataFrame, brand: pd.DataFrame,
               champs: set[int], final_week: int) -> pd.DataFrame:
    t = teams[teams.season == season][["team_id", "school", "conference"]]
    m = merit[(merit.season == season) & (merit.merit_week == merit_week)].drop(
        columns=["season", "merit_week"])
    df = (t.merge(m, on="team_id", how="left")
          .merge(snapshot_at(snap, season, week), on="team_id", how="left")
          .merge(brand[brand.season == season].drop(columns="season"), on="team_id", how="left"))
    return add_derived(df, season, week, champs, final_week)


def add_derived(df: pd.DataFrame, season: int, week: int, champs: set[int],
                final_week: int) -> pd.DataFrame:
    df = df.copy()
    df["season"], df["week"] = season, week
    df["unbeaten"] = (df.merit_losses == 0).astype(int)
    df["one_loss"] = (df.merit_losses == 1).astype(int)
    df["conf_champ"] = df.team_id.isin(champs).astype(int)
    df["power_conf"] = [int(is_power(c, season, s)) for c, s in zip(df.conference, df.school)]
    for c in CONF_ONEHOT:
        df[f"conf_{c}"] = (df.conference == c).astype(int)
    df["weeks_to_final"] = final_week - week
    return df


def build_dataset() -> pd.DataFrame:
    teams = load_table("teams")
    games = load_table("games")
    merit = pd.read_parquet(PROCESSED_DIR / "team_merit.parquet")
    gf = pd.read_parquet(PROCESSED_DIR / "game_features.parquet")
    gf["kickoff"] = pd.to_datetime(gf.start_date, utc=True)
    snap = team_snapshots(gf)
    brand = brand_table()
    cg = championship_games(games)
    champ_tbl = champions(cg)

    rk = load_table("rankings")
    rk = rk[(rk.poll == "Playoff Committee Rankings") & (rk.season_type == "regular")]
    max_reg = games[games.season_type == "regular"].groupby("season").week.max()

    rows = []
    for (season, week), ranks in rk.groupby(["season", "week"]):
        final_week = int(rk[rk.season == season].week.max())
        merit_weeks = merit[merit.season == season].merit_week.unique()
        merit_week = week if (week in merit_weeks and week <= max_reg[season]) else 99
        champs = set(champ_tbl[(champ_tbl.season == season) & (champ_tbl.week < week)].team_id)
        df = build_rows(season, week, merit_week, merit, snap, teams, brand, champs, final_week)
        df = df.merge(ranks[["team_id", "rank"]], on="team_id", how="left")
        rows.append(df)
    out = pd.concat(rows, ignore_index=True)
    out["relevance"] = (26 - out["rank"]).fillna(0).clip(lower=0).astype(int)
    return out


def train(df: pd.DataFrame, rounds: int, decay: float = 0.9) -> lgb.Booster:
    """Recent committees weigh more (membership and philosophy drift year to year)."""
    df = df.sort_values(["season", "week"], kind="stable")
    sizes = df.groupby(["season", "week"], sort=False).size()
    weight = decay ** (df.season.max() - df.season).to_numpy(float)
    ds = lgb.Dataset(df[FEATURES].astype(float), df.relevance, group=sizes.to_numpy(),
                     weight=weight)
    return lgb.train(dict(PARAMS, label_gain=LABEL_GAIN), ds, num_boost_round=rounds)


def evaluate(booster: lgb.Booster, df: pd.DataFrame) -> dict:
    per_week = []
    for (season, week), g in df.groupby(["season", "week"]):
        g = g.assign(score=booster.predict(g[FEATURES].astype(float)))
        g = g.sort_values("score", ascending=False).reset_index(drop=True)
        g["pred_rank"] = np.arange(1, len(g) + 1)
        actual = g.dropna(subset=["rank"])
        top12_actual = set(actual[actual["rank"] <= 12].team_id)
        top12_pred = set(g.head(12).team_id)
        top4_actual = set(actual[actual["rank"] <= 4].team_id)
        per_week.append({
            "season": int(season), "week": int(week),
            "spearman_top25": float(spearmanr(actual["rank"], actual.pred_rank).statistic),
            "top12_overlap": len(top12_actual & top12_pred),
            "top4_overlap": len(top4_actual & set(g.head(4).team_id)),
        })
    pw = pd.DataFrame(per_week)
    final = pw.sort_values("week").groupby("season").tail(1)
    return {
        "weeks": int(len(pw)),
        "spearman_top25": float(pw.spearman_top25.mean()),
        "top12_overlap": float(pw.top12_overlap.mean()),
        "top4_overlap": float(pw.top4_overlap.mean()),
        "final_week_top12_overlap": float(final.top12_overlap.mean()),
        "per_week": per_week,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rounds", type=int, default=400)
    args = ap.parse_args()
    df = build_dataset()
    df.to_parquet(PROCESSED_DIR / "committee_dataset.parquet", index=False)

    report = {}
    for season in TEST_SEASONS:
        booster = train(df[df.season < season], args.rounds)
        report[season] = evaluate(booster, df[df.season == season])
    pooled = {k: float(np.mean([report[s][k] for s in TEST_SEASONS]))
              for k in ("spearman_top25", "top12_overlap", "top4_overlap",
                        "final_week_top12_overlap")}
    gate = {"top12_overlap_ge_10": pooled["top12_overlap"] >= 10}
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "committee_backtest.json").write_text(
        json.dumps({"by_season": report, "pooled": pooled, "ship_gate": gate}, indent=2))
    print(json.dumps(pooled, indent=2), "\nship gate:", gate)

    final = train(df[df.season <= max(TEST_SEASONS)], args.rounds)
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    final.save_model(str(ARTIFACTS_DIR / "committee.lgb.txt"))
    (ARTIFACTS_DIR / "committee.meta.json").write_text(json.dumps({"features": FEATURES}))
    imp = pd.Series(final.feature_importance("gain"), index=FEATURES).sort_values(ascending=False)
    print("top features:", imp.head(8).round(0).to_dict())


if __name__ == "__main__":
    main()
