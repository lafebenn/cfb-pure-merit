"""Game win-probability model: LightGBM margin regression + isotonic calibration.

Two variants are trained:
  * full      — includes closing spread / total (used when a line exists)
  * nomarket  — no betting features (future weeks without lines, playoff sims)
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss

from cfbml.config import (
    ARTIFACTS_DIR, PROCESSED_DIR, REPORTS_DIR, TEST_SEASONS, TRAIN_SEASONS, VALID_SEASONS,
)
from cfbml.features.build import feature_columns

LGB_PARAMS = {
    "objective": "regression",
    "learning_rate": 0.03,
    "num_leaves": 15,
    "min_data_in_leaf": 40,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 1,
    "lambda_l2": 1.0,
    "verbose": -1,
    "seed": 7,
}
RECENCY_DECAY = 0.85
P_CLIP = (0.005, 0.995)


def load_games() -> pd.DataFrame:
    df = pd.read_parquet(PROCESSED_DIR / "game_features.parquet")
    return df[df.season >= TRAIN_SEASONS[0]].reset_index(drop=True)


def labeled(df: pd.DataFrame) -> pd.DataFrame:
    return df[df.completed & df.home_margin.notna() & (df.home_margin != 0)]


def recency_weights(seasons: pd.Series, decay: float | None) -> np.ndarray:
    if decay is None:
        return np.ones(len(seasons))
    return decay ** (seasons.max() - seasons).to_numpy(float)


@dataclass
class GameModel:
    booster: lgb.Booster
    calibrator: IsotonicRegression
    columns: list[str]
    sigma: float

    def margin(self, df: pd.DataFrame) -> np.ndarray:
        return self.booster.predict(df[self.columns].astype(float))

    def win_prob(self, df: pd.DataFrame) -> np.ndarray:
        return np.clip(self.calibrator.predict(self.margin(df)), *P_CLIP)

    def save(self, name: str) -> None:
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        self.booster.save_model(str(ARTIFACTS_DIR / f"{name}.lgb.txt"))
        (ARTIFACTS_DIR / f"{name}.meta.json").write_text(json.dumps({
            "columns": self.columns,
            "sigma": self.sigma,
            "iso_x": self.calibrator.X_thresholds_.tolist(),
            "iso_y": self.calibrator.y_thresholds_.tolist(),
        }))

    @classmethod
    def load(cls, name: str) -> "GameModel":
        meta = json.loads((ARTIFACTS_DIR / f"{name}.meta.json").read_text())
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1)
        iso.fit(meta["iso_x"], meta["iso_y"])
        return cls(lgb.Booster(model_file=str(ARTIFACTS_DIR / f"{name}.lgb.txt")), iso,
                   meta["columns"], meta["sigma"])


def _fit_booster(train: pd.DataFrame, cols: list[str], rounds: int,
                 decay: float | None) -> lgb.Booster:
    ds = lgb.Dataset(train[cols].astype(float), train.home_margin,
                     weight=recency_weights(train.season, decay))
    return lgb.train(LGB_PARAMS, ds, num_boost_round=rounds)


def best_rounds(train: pd.DataFrame, valid: pd.DataFrame, cols: list[str],
                decay: float | None) -> int:
    ds = lgb.Dataset(train[cols].astype(float), train.home_margin,
                     weight=recency_weights(train.season, decay))
    dv = lgb.Dataset(valid[cols].astype(float), valid.home_margin, reference=ds)
    b = lgb.train(LGB_PARAMS, ds, num_boost_round=3000, valid_sets=[dv],
                  callbacks=[lgb.early_stopping(100, verbose=False)])
    return max(50, b.best_iteration)


def fit_model(train: pd.DataFrame, cols: list[str], rounds: int,
              decay: float | None) -> GameModel:
    """Booster on all of `train`; calibrator on leave-one-season-out margins (no in-sample fit)."""
    oof = np.full(len(train), np.nan)
    seasons = sorted(train.season.unique())
    for s in seasons:
        m = (train.season == s).to_numpy()
        if m.all():
            continue
        b = _fit_booster(train[~m], cols, rounds, decay)
        oof[m] = b.predict(train.loc[m, cols].astype(float))
    ok = ~np.isnan(oof)
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1)
    iso.fit(oof[ok], (train.home_margin.to_numpy()[ok] > 0).astype(float),
            sample_weight=recency_weights(train.season[ok], decay))
    sigma = float(np.std(train.home_margin.to_numpy()[ok] - oof[ok]))
    return GameModel(_fit_booster(train, cols, rounds, decay), iso, cols, sigma)


def _baseline(train: pd.DataFrame, cols: list[str]) -> LogisticRegression:
    t = train.dropna(subset=cols)
    return LogisticRegression(C=1.0).fit(t[cols], (t.home_margin > 0).astype(int))


def metrics(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    p = np.clip(p, *P_CLIP)
    return {
        "n": int(len(y)),
        "brier": float(brier_score_loss(y, p)),
        "log_loss": float(log_loss(y, p, labels=[0, 1])),
        "accuracy": float(((p > 0.5) == (y > 0.5)).mean()),
    }


def ats_accuracy(df: pd.DataFrame, pred_margin: np.ndarray) -> float | None:
    """How often the model's side vs the closing spread covers (pushes dropped)."""
    has = df.spread.notna().to_numpy()
    if not has.any():
        return None
    line = -df.spread.to_numpy()[has]
    actual = df.home_margin.to_numpy()[has] - line
    pick = pred_margin[has] - line
    keep = (actual != 0) & (pick != 0)
    return float((np.sign(actual[keep]) == np.sign(pick[keep])).mean())


def walk_forward(df: pd.DataFrame, decay: float | None = RECENCY_DECAY,
                 test_seasons: list[int] = TEST_SEASONS) -> dict:
    """Each test season is predicted by models trained only on earlier seasons.

    Features are already as-of kickoff, so week N only ever sees information from before week N.
    """
    lab = labeled(df)
    elo_cols = ["home_elo", "away_elo", "neutral_site"]
    mkt_cols = ["spread"]
    out: dict = {"by_season": {}, "pooled": {}}
    pooled: dict[str, list] = {k: [] for k in ("y", "elo", "market", "full", "nomarket")}
    pooled_ats: list[float] = []

    for season in test_seasons:
        train = lab[lab.season < season - 2]
        valid = lab[lab.season.isin([season - 2, season - 1])]
        test = lab[lab.season == season]
        fitted = {}
        for name, market in (("full", True), ("nomarket", False)):
            cols = feature_columns(market)
            rounds = best_rounds(train, valid, cols, decay)
            fitted[name] = fit_model(pd.concat([train, valid]), cols, rounds, decay)

        hist = pd.concat([train, valid])
        elo = _baseline(hist, elo_cols)
        mkt = _baseline(hist, mkt_cols)
        y = (test.home_margin > 0).astype(float).to_numpy()
        preds = {
            "elo": elo.predict_proba(test[elo_cols])[:, 1],
            "market": np.where(
                test.spread.notna(),
                mkt.predict_proba(test[mkt_cols].fillna(0))[:, 1],
                elo.predict_proba(test[elo_cols])[:, 1],
            ),
            "full": fitted["full"].win_prob(test),
            "nomarket": fitted["nomarket"].win_prob(test),
        }
        out["by_season"][season] = {k: metrics(y, v) for k, v in preds.items()}
        ats = ats_accuracy(test, fitted["nomarket"].margin(test))
        out["by_season"][season]["nomarket_ats"] = ats
        pooled["y"].append(y)
        for k, v in preds.items():
            pooled[k].append(v)
        if ats is not None:
            pooled_ats.append(ats)

    y = np.concatenate(pooled["y"])
    out["pooled"] = {k: metrics(y, np.concatenate(pooled[k]))
                     for k in ("elo", "market", "full", "nomarket")}
    out["pooled"]["nomarket_ats"] = float(np.mean(pooled_ats)) if pooled_ats else None
    return out


def ship_gate(bt: dict) -> dict[str, bool]:
    p = bt["pooled"]
    return {
        "full_beats_elo_brier": p["full"]["brier"] < p["elo"]["brier"],
        "full_within_1pct_market_logloss": p["full"]["log_loss"] <= p["market"]["log_loss"] * 1.01,
        "nomarket_beats_elo_brier": p["nomarket"]["brier"] < p["elo"]["brier"],
    }


def train_production(df: pd.DataFrame, decay: float | None = RECENCY_DECAY) -> dict[str, GameModel]:
    """Final models on every completed season; rounds tuned on the last two seasons."""
    lab = labeled(df)
    last = int(lab.season.max())
    models = {}
    for name, market in (("full", True), ("nomarket", False)):
        cols = feature_columns(market)
        tr, va = lab[lab.season < last - 1], lab[lab.season >= last - 1]
        rounds = best_rounds(tr, va, cols, decay)
        models[name] = fit_model(lab, cols, rounds, decay)
        models[name].save(f"game_{name}")
    return models


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backtest", action="store_true")
    ap.add_argument("--train", action="store_true")
    args = ap.parse_args()
    df = load_games()

    if args.backtest:
        bt = walk_forward(df)
        bt["ship_gate"] = ship_gate(bt)
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        (REPORTS_DIR / "game_backtest.json").write_text(json.dumps(bt, indent=2))
        print(json.dumps(bt["pooled"], indent=2))
        print("ship gate:", bt["ship_gate"])
    if args.train:
        # Production trains through the last *finished* season plus completed current games.
        models = train_production(df)
        for name, m in models.items():
            print(f"saved game_{name}: {len(m.columns)} features, sigma={m.sigma:.2f}")


if __name__ == "__main__":
    main()
