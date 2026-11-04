"""How did the NIL / transfer-portal era (2021+) change predictability? Writes reports/nil_era.md."""

from __future__ import annotations

import json

import lightgbm as lgb
import numpy as np
import pandas as pd
from scipy.stats import norm

from cfbml.config import NIL_ERA_START, REPORTS_DIR, TEST_SEASONS
from cfbml.features.build import feature_columns
from cfbml.ingest.backfill import load_table
from cfbml.models.game import LGB_PARAMS, labeled, load_games, metrics, walk_forward

PRE = list(range(2014, NIL_ERA_START))
POST = list(range(NIL_ERA_START, max(TEST_SEASONS) + 1))
EXPERIENCE = ["diff_ret_ppa_pct", "diff_ret_pass_ppa_pct", "diff_ret_usage", "diff_qb_returning",
              "diff_upperclass_usage_share", "diff_transfer_usage_in", "diff_portal_net",
              "diff_experience_missing"]
COACH = ["diff_coach_seasons", "diff_coach_win_pct", "diff_coach_years_at_school",
         "diff_coach_over_expected", "diff_coach_top25_finishes", "diff_coach_first_year"]


def era_of(s: pd.Series) -> pd.Series:
    return np.where(s >= NIL_ERA_START, "2021-25 (NIL)", "2014-20 (pre-NIL)")


def market_predictability(lab: pd.DataFrame) -> pd.DataFrame:
    """Closing-line accuracy and upset rates by era (no model involved)."""
    d = lab.dropna(subset=["spread"]).copy()
    d["era"] = era_of(d.season)
    d["fav_home"] = d.spread < 0
    d["fav_won"] = np.where(d.fav_home, d.home_margin > 0, d.home_margin < 0)
    d["abs_spread"] = d.spread.abs()
    d["cover_err"] = (d.home_margin + d.spread).abs()
    p = norm.cdf(-d.spread / 15.6)
    d["p"] = p
    rows = []
    for era, g in d.groupby("era"):
        y = (g.home_margin > 0).astype(float)
        m = metrics(y.to_numpy(), g.p.to_numpy())
        hfa = g[g.neutral_site == 0].home_margin.mean() - (-g[g.neutral_site == 0].spread).mean()
        rows.append({
            "era": era, "games": len(g),
            "favorite_win_rate": g.fav_won.mean(),
            "upset_rate_fav_7plus": 1 - g[g.abs_spread >= 7].fav_won.mean(),
            "mean_abs_error_vs_spread": g.cover_err.mean(),
            "market_brier": m["brier"],
            "home_margin_minus_line": hfa,
        })
    return pd.DataFrame(rows)


def year_to_year_persistence() -> pd.DataFrame:
    """Correlation of SP+ between consecutive seasons — does roster churn erase last year?"""
    sp = load_table("sp")
    prev = sp.assign(season=sp.season + 1)[["season", "team", "sp_rating"]]
    j = sp.merge(prev, on=["season", "team"], suffixes=("", "_prev")).dropna()
    out = j.groupby("season").apply(lambda g: g.sp_rating.corr(g.sp_rating_prev),
                                    include_groups=False).rename("sp_corr_with_last_year")
    return out.reset_index()


def calibration_by_era(lab: pd.DataFrame, decay: float | None) -> tuple[pd.DataFrame, dict]:
    """Leave-one-season-out no-market predictions, then calibration + metrics per era."""
    cols = feature_columns(False)
    rows = []
    for s in sorted(lab.season.unique()):
        tr, te = lab[lab.season != s], lab[lab.season == s]
        w = decay ** (abs(tr.season - s)).to_numpy(float) if decay else None
        b = lgb.train(LGB_PARAMS, lgb.Dataset(tr[cols].astype(float), tr.home_margin, weight=w),
                      num_boost_round=600)
        rows.append(pd.DataFrame({"season": s, "pred": b.predict(te[cols].astype(float)),
                                  "margin": te.home_margin.to_numpy()}))
    oof = pd.concat(rows)
    sigma = float((oof.margin - oof.pred).std())
    oof["p"] = norm.cdf(oof.pred / sigma)
    oof["y"] = (oof.margin > 0).astype(float)
    oof["era"] = era_of(oof.season)
    oof["bin"] = pd.cut(oof.p, np.linspace(0, 1, 11), include_lowest=True)
    calib = (oof.groupby(["era", "bin"], observed=True)
             .agg(n=("y", "size"), predicted=("p", "mean"), actual=("y", "mean")).reset_index())
    by_era = {era: {**metrics(g.y.to_numpy(), g.p.to_numpy()),
                    "margin_rmse": float(np.sqrt(((g.margin - g.pred) ** 2).mean()))}
              for era, g in oof.groupby("era")}
    return calib, by_era


def importance_by_era(lab: pd.DataFrame) -> pd.DataFrame:
    cols = feature_columns(False)
    out = {}
    for name, seasons in (("pre", PRE), ("post", POST)):
        d = lab[lab.season.isin(seasons)]
        b = lgb.train(LGB_PARAMS, lgb.Dataset(d[cols].astype(float), d.home_margin),
                      num_boost_round=600)
        gain = pd.Series(b.feature_importance("gain"), index=cols)
        out[name] = gain / gain.sum()
    imp = pd.DataFrame(out)
    imp["change"] = imp.post - imp.pre
    return imp.sort_values("post", ascending=False)


def recency_comparison(df: pd.DataFrame) -> dict:
    res = {}
    for label, decay in (("unweighted", None), ("decay_0.85", 0.85), ("decay_0.70", 0.70)):
        bt = walk_forward(df, decay=decay)
        res[label] = {k: bt["pooled"][k] for k in ("full", "nomarket")}
    return res


def _fmt_pct(x: float) -> str:
    return f"{100 * x:.1f}%"


def main() -> None:
    df = load_games()
    lab = labeled(df)

    mkt = market_predictability(lab)
    persist = year_to_year_persistence()
    calib, by_era = calibration_by_era(lab, decay=None)
    imp = importance_by_era(lab)
    rec = recency_comparison(df)
    best = min(rec, key=lambda k: rec[k]["full"]["log_loss"] + rec[k]["nomarket"]["log_loss"])

    exp_pre = imp.loc[imp.index.isin(EXPERIENCE), "pre"].sum()
    exp_post = imp.loc[imp.index.isin(EXPERIENCE), "post"].sum()
    coach_pre = imp.loc[imp.index.isin(COACH), "pre"].sum()
    coach_post = imp.loc[imp.index.isin(COACH), "post"].sum()
    p_pre = persist[persist.season < NIL_ERA_START].sp_corr_with_last_year.mean()
    p_post = persist[persist.season >= NIL_ERA_START].sp_corr_with_last_year.mean()

    lines = [
        "# NIL / transfer-portal era: what changed?",
        "",
        "Generated by `uv run python -m cfbml.reports.nil`. Pre = 2014-2020, NIL = 2021-2025 "
        "(FBS vs FBS games only).",
        "",
        "## 1. Are games harder to predict?",
        "",
        "| Era | Games | Favorite wins | Upsets when fav by 7+ | Mean miss vs spread (pts) | Market Brier |",
        "|---|---|---|---|---|---|",
    ]
    for r in mkt.itertuples(index=False):
        lines.append(f"| {r.era} | {r.games:,} | {_fmt_pct(r.favorite_win_rate)} | "
                     f"{_fmt_pct(r.upset_rate_fav_7plus)} | {r.mean_abs_error_vs_spread:.2f} | "
                     f"{r.market_brier:.4f} |")
    lines += ["", "Our no-market model (leave-one-season-out):", "",
              "| Era | Brier | Log loss | Accuracy | Margin RMSE |", "|---|---|---|---|---|"]
    for era, m in sorted(by_era.items()):
        lines.append(f"| {era} | {m['brier']:.4f} | {m['log_loss']:.4f} | "
                     f"{_fmt_pct(m['accuracy'])} | {m['margin_rmse']:.2f} |")

    lines += ["", "## 2. Does last year still predict this year?", "",
              f"Average correlation of a team's SP+ with its prior-season SP+: "
              f"**{p_pre:.3f} pre-NIL vs {p_post:.3f} in the NIL era**.", "",
              "| Season | SP+ corr with last year |", "|---|---|"]
    for r in persist.itertuples(index=False):
        lines.append(f"| {r.season} | {r.sp_corr_with_last_year:.3f} |")

    lines += ["", "## 3. Which signals matter more now?", "",
              f"Share of model gain from **experience features** (returning production, QB "
              f"returning, upperclass usage, transfer usage, portal net): "
              f"{_fmt_pct(exp_pre)} pre vs {_fmt_pct(exp_post)} NIL.",
              f"Share from **coach résumé** features: {_fmt_pct(coach_pre)} pre vs "
              f"{_fmt_pct(coach_post)} NIL.", "",
              "| Feature | Pre gain share | NIL gain share | Change |", "|---|---|---|---|"]
    for name, r in imp.head(15).iterrows():
        lines.append(f"| `{name}` | {_fmt_pct(r.pre)} | {_fmt_pct(r.post)} | "
                     f"{100 * r.change:+.1f} pts |")

    lines += ["", "## 4. Calibration by era (no-market model)", "",
              "| Era | Predicted bin | Games | Predicted | Actual |", "|---|---|---|---|---|"]
    for r in calib.itertuples(index=False):
        lines.append(f"| {r.era} | {r.bin} | {r.n} | {_fmt_pct(r.predicted)} | "
                     f"{_fmt_pct(r.actual)} |")

    lines += ["", "## 5. Recency weighting (walk-forward on 2024-2025)", "",
              "| Weighting | Full Brier | Full log loss | No-market Brier | No-market log loss |",
              "|---|---|---|---|---|"]
    for k, v in rec.items():
        lines.append(f"| {k} | {v['full']['brier']:.4f} | {v['full']['log_loss']:.4f} | "
                     f"{v['nomarket']['brier']:.4f} | {v['nomarket']['log_loss']:.4f} |")
    lines += ["", f"**Decision:** `{best}` has the best combined (full + no-market) log loss on "
              "the NIL-era test seasons, so production uses it (see `RECENCY_DECAY` in "
              "`models/game.py`).", ""]

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "nil_era.md").write_text("\n".join(lines))
    (REPORTS_DIR / "nil_era.json").write_text(json.dumps({
        "market": mkt.to_dict("records"), "model_by_era": by_era,
        "persistence": persist.to_dict("records"), "recency": rec, "best_recency": best,
        "experience_gain_share": {"pre": exp_pre, "post": exp_post},
        "coach_gain_share": {"pre": coach_pre, "post": coach_post},
    }, indent=2, default=float))
    print("\n".join(lines[:40]))
    print("...\nrecency:", json.dumps({k: v["nomarket"]["log_loss"] for k, v in rec.items()}),
          "best:", best)


if __name__ == "__main__":
    main()
