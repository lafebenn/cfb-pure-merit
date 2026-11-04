"""As-of-kickoff features. Every team feature for a game uses only games that started earlier."""

from __future__ import annotations

import numpy as np
import pandas as pd

from cfbml.config import CFP12_START, NIL_ERA_START, PROCESSED_DIR
from cfbml.ingest.backfill import load_table
from cfbml.merit import MeritGame, merit_rankings

# Early-season shrink toward last season's final numbers (pseudo-games of prior).
PRIOR_GAMES = 3.0
ROLL_STATS = ["off_ppa", "off_success", "off_explosiveness", "def_ppa", "def_success",
              "def_explosiveness", "off_ppd", "def_ppd", "margin"]
ADJ_PAIRS = [("off_ppa", "def_ppa"), ("off_success", "def_success"), ("off_ppd", "def_ppd")]

TEAM_FEATURES = [
    # on-field, current season
    "merit_score", "merit_rank", "merit_sos", "merit_losses", "games_played",
    "adj_off_ppa", "adj_def_ppa", "adj_off_success", "adj_def_success",
    "adj_off_ppd", "adj_def_ppd", "off_explosiveness", "def_explosiveness", "margin",
    # ratings
    "elo", "sp_prior",
    # coach
    "coach_seasons", "coach_win_pct", "coach_years_at_school", "coach_over_expected",
    "coach_top25_finishes", "coach_first_year",
    # experience
    "ret_ppa_pct", "ret_pass_ppa_pct", "ret_usage", "qb_returning", "upperclass_usage_share",
    "transfer_usage_in", "portal_net", "experience_missing",
    # context
    "rest_days",
]
MARKET_FEATURES = ["spread", "over_under"]
GAME_FEATURES = ["neutral_site", "conference_game", "postseason", "travel_km", "week",
                 "nil_era", "cfp12"]


def _team_ids(teams: pd.DataFrame) -> dict[tuple[int, str], int]:
    return {(int(s), n): int(i) for s, n, i in zip(teams.season, teams.school, teams.team_id)}


def fbs_games(games: pd.DataFrame, teams: pd.DataFrame) -> pd.DataFrame:
    fbs = set(zip(teams.season, teams.team_id))
    mask = [((s, h) in fbs) and ((s, a) in fbs)
            for s, h, a in zip(games.season, games.home_id, games.away_id)]
    out = games[mask].copy()
    out["kickoff"] = pd.to_datetime(out.start_date, utc=True)
    out["postseason"] = (out.season_type == "postseason").astype(int)
    return out.sort_values("kickoff").reset_index(drop=True)


def team_game_log(g: pd.DataFrame, adv: pd.DataFrame, ids: dict) -> pd.DataFrame:
    """Two rows per FBS game (one per team), with that team's box-score advanced stats."""
    rows = []
    for side, other in (("home", "away"), ("away", "home")):
        rows.append(pd.DataFrame({
            "game_id": g.game_id, "season": g.season, "kickoff": g.kickoff,
            "completed": g.completed,
            "team_id": g[f"{side}_id"], "opp_id": g[f"{other}_id"],
            "pf": g[f"{side}_points"], "pa": g[f"{other}_points"],
        }))
    log = pd.concat(rows, ignore_index=True)

    adv = adv.copy()
    adv["team_id"] = [ids.get((s, t)) for s, t in zip(adv.season, adv.team)]
    adv = adv.dropna(subset=["team_id"]).astype({"team_id": int})
    adv = adv.drop_duplicates(["game_id", "team_id"])
    log = log.merge(
        adv[["game_id", "team_id", "off_ppa", "off_success", "off_explosiveness", "off_drives",
             "def_ppa", "def_success", "def_explosiveness", "def_drives"]],
        on=["game_id", "team_id"], how="left",
    )
    log["off_ppd"] = log.pf / log.off_drives.where(log.off_drives > 0)
    log["def_ppd"] = log.pa / log.def_drives.where(log.def_drives > 0)
    log["margin"] = log.pf - log.pa
    return log.sort_values(["team_id", "kickoff"]).reset_index(drop=True)


def _expanding_prior_mean(log: pd.DataFrame, col: str) -> pd.Series:
    """Mean of `col` over the team's earlier completed games in the same season."""
    vals = log[col].where(log.completed)
    keys = [log.team_id, log.season]
    s = vals.fillna(0).groupby(keys).transform(lambda x: x.shift(1).fillna(0).cumsum())
    n = vals.notna().astype(float).groupby(keys).transform(lambda x: x.shift(1).fillna(0).cumsum())
    return s / n.where(n > 0), n


def rolling_team_stats(log: pd.DataFrame) -> pd.DataFrame:
    log = log.copy()
    finals = log[log.completed].groupby(["team_id", "season"])[ROLL_STATS].mean()
    # League baseline = last season's average, so nothing from later this season leaks in.
    league_same = log[log.completed].groupby("season")[ROLL_STATS].mean()
    league = league_same.shift(1).fillna(league_same)

    for col in ROLL_STATS:
        mean, n = _expanding_prior_mean(log, col)
        prior = finals[col].rename("p").reset_index()
        prior["season"] = prior.season + 1
        p = log[["team_id", "season"]].merge(prior, on=["team_id", "season"], how="left")["p"]
        lg = log.season.map(league[col])
        p = p.fillna(lg).to_numpy()
        n = n.fillna(0).to_numpy()
        m = mean.fillna(0).to_numpy()
        log[f"asof_{col}"] = (m * n + p * PRIOR_GAMES) / (n + PRIOR_GAMES)
    log["games_played"] = log.completed.astype(float).groupby([log.team_id, log.season]).transform(
        lambda x: x.shift(1).fillna(0).cumsum())

    # One-pass opponent adjustment: what you did relative to what that opponent usually allows.
    opp = log[["game_id", "team_id"] + [f"asof_{d}" for _, d in ADJ_PAIRS]
              + [f"asof_{o}" for o, _ in ADJ_PAIRS]].rename(columns={"team_id": "opp_id"})
    opp.columns = ["game_id", "opp_id"] + [f"opp_asof_{d}" for _, d in ADJ_PAIRS] + \
        [f"opp_asof_{o}" for o, _ in ADJ_PAIRS]
    log = log.merge(opp, on=["game_id", "opp_id"], how="left")
    for o, d in ADJ_PAIRS:
        lg_o = log.season.map(league[o])
        lg_d = log.season.map(league[d])
        log[f"g_adj_{o}"] = log[o] - (log[f"opp_asof_{d}"] - lg_d)
        log[f"g_adj_{d}"] = log[d] - (log[f"opp_asof_{o}"] - lg_o)
    log = log.sort_values(["team_id", "kickoff"]).reset_index(drop=True)
    for o, d in ADJ_PAIRS:
        for col in (o, d):
            mean, n = _expanding_prior_mean(log, f"g_adj_{col}")
            n = n.fillna(0).to_numpy()
            m = mean.fillna(0).to_numpy()
            p = log[f"asof_{col}"].to_numpy()
            log[f"adj_{col}"] = (m * n + p * PRIOR_GAMES) / (n + PRIOR_GAMES)

    keep = {"off_explosiveness": "off_explosiveness", "def_explosiveness": "def_explosiveness",
            "margin": "margin"}
    for src, dst in keep.items():
        log[dst + "_asof"] = log[f"asof_{src}"]
    out = log[["game_id", "team_id", "games_played"]
              + [f"adj_{c}" for pair in ADJ_PAIRS for c in pair]
              + [f"{c}_asof" for c in keep.values()]]
    return out.rename(columns={f"{c}_asof": c for c in keep.values()})


def merit_asof(g: pd.DataFrame, teams: pd.DataFrame) -> pd.DataFrame:
    """Merit table before each regular week; postseason uses the full regular season."""
    out = []
    for season, sg in g.groupby("season"):
        fbs_ids = teams.loc[teams.season == season, "team_id"].tolist()
        reg = sg[(sg.season_type == "regular") & sg.completed].dropna(
            subset=["home_points", "away_points"])
        weeks = sorted(sg.loc[sg.season_type == "regular", "week"].unique().tolist())
        keys = [(w, w) for w in weeks] + [(99, 99)]  # 99 = postseason
        for key, w in keys:
            sub = reg[reg.week < w]
            res = merit_rankings(
                [MeritGame(int(r.home_id), int(r.away_id), float(r.home_points),
                           float(r.away_points), bool(r.neutral_site), int(r.week),
                           str(r.start_date)) for r in sub.itertuples(index=False)],
                fbs_ids,
            )
            for r in res:
                out.append({"season": season, "merit_week": key, "team_id": r.team_id,
                            "merit_score": r.merit_score, "merit_rank": r.rank,
                            "merit_sos": r.sos_score, "merit_losses": r.losses,
                            "merit_wins": r.wins})
    return pd.DataFrame(out)


def coach_features(coaches: pd.DataFrame, records: pd.DataFrame) -> pd.DataFrame:
    """Per (season, team): the head coach's résumé from seasons strictly before this one."""
    c = coaches.merge(records[["season", "team_id", "expected_wins"]],
                      on=["season", "team_id"], how="left")
    c["over_exp"] = c.wins - c.expected_wins
    # Primary coach for a team-season = most games (or listed coach in a not-yet-played season).
    c = c.sort_values(["season", "team_id", "games"], ascending=[True, True, False])
    primary = c.drop_duplicates(["season", "team_id"])[["season", "team_id", "coach_id"]]

    rows = []
    hist = c.sort_values("season")
    by_coach = {k: v for k, v in hist.groupby("coach_id")}
    for r in primary.itertuples(index=False):
        h = by_coach[r.coach_id]
        past = h[h.season < r.season]
        g = past.games.sum()
        at_school = past[past.team_id == r.team_id].season.nunique()
        rows.append({
            "season": r.season, "team_id": r.team_id,
            "coach_seasons": past.season.nunique(),
            "coach_win_pct": past.wins.sum() / g if g else np.nan,
            "coach_years_at_school": at_school,
            "coach_over_expected": past.over_exp.mean() if past.over_exp.notna().any() else np.nan,
            "coach_top25_finishes": int(past.postseason_rank.notna().sum()),
            "coach_first_year": int(past.empty),
        })
    return pd.DataFrame(rows)


def experience_features(teams: pd.DataFrame) -> pd.DataFrame:
    ids = _team_ids(teams)
    ret = load_table("returning")
    usage = load_table("usage")
    roster = load_table("roster")
    portal = load_table("portal")

    ret["team_id"] = [ids.get((s, t)) for s, t in zip(ret.season, ret.team)]
    out = ret.dropna(subset=["team_id"]).astype({"team_id": int})[
        ["season", "team_id", "ret_ppa_pct", "ret_pass_ppa_pct", "ret_usage"]]

    roster = roster[roster.class_year.between(1, 6)]
    prev = usage.rename(columns={"team": "prev_team"}).assign(season=usage.season + 1)
    merged = roster.merge(prev[["season", "player_id", "prev_team", "usage", "usage_pass",
                                "position"]].rename(columns={"position": "prev_pos"}),
                          on=["season", "player_id"], how="inner")
    merged["team_id"] = [ids.get((s, t)) for s, t in zip(merged.season, merged.team)]
    merged = merged.dropna(subset=["team_id"]).astype({"team_id": int})
    merged["is_transfer"] = merged.prev_team != merged.team
    merged["upper"] = merged.class_year >= 3

    grp = merged.groupby(["season", "team_id"])
    exp = pd.DataFrame({
        "upperclass_usage_share": grp.apply(
            lambda x: (x.usage * x.upper).sum() / x.usage.sum() if x.usage.sum() > 0 else np.nan,
            include_groups=False),
        "transfer_usage_in": grp.apply(lambda x: x.usage[x.is_transfer].sum(),
                                       include_groups=False),
    }).reset_index()

    # Did last season's primary passer (same school) stay on the roster?
    qbs = usage[usage.position == "QB"].sort_values("usage_pass", ascending=False)
    top_qb = qbs.drop_duplicates(["season", "team"])[["season", "team", "player_id"]]
    top_qb = top_qb.assign(season=top_qb.season + 1)
    on_roster = set(zip(roster.season, roster.team, roster.player_id))
    top_qb["qb_returning"] = [int((s, t, p) in on_roster)
                              for s, t, p in zip(top_qb.season, top_qb.team, top_qb.player_id)]
    top_qb["team_id"] = [ids.get((s, t)) for s, t in zip(top_qb.season, top_qb.team)]
    top_qb = top_qb.dropna(subset=["team_id"]).astype({"team_id": int})

    p_in = portal.groupby(["season", "destination"]).size().rename("pin")
    p_out = portal.groupby(["season", "origin"]).size().rename("pout")
    pn = pd.concat([p_in.rename_axis(["season", "team"]), p_out.rename_axis(["season", "team"])],
                   axis=1).fillna(0).reset_index()
    pn["portal_net"] = pn.pin - pn.pout
    pn["team_id"] = [ids.get((s, t)) for s, t in zip(pn.season, pn.team)]
    pn = pn.dropna(subset=["team_id"]).astype({"team_id": int})

    base = teams[["season", "team_id"]].drop_duplicates()
    out = (base.merge(out, on=["season", "team_id"], how="left")
           .merge(exp, on=["season", "team_id"], how="left")
           .merge(top_qb[["season", "team_id", "qb_returning"]], on=["season", "team_id"],
                  how="left")
           .merge(pn[["season", "team_id", "portal_net"]], on=["season", "team_id"], how="left"))
    out["experience_missing"] = out[["ret_ppa_pct", "upperclass_usage_share"]].isna().any(
        axis=1).astype(int)
    out.loc[out.season < NIL_ERA_START, "portal_net"] = out.loc[
        out.season < NIL_ERA_START, "portal_net"].fillna(0)
    return out


def _haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(a))


def rest_days(games: pd.DataFrame) -> pd.DataFrame:
    """Days since each team's previous game of any division."""
    g = games.assign(kickoff=pd.to_datetime(games.start_date, utc=True))
    long = pd.concat([
        g[["game_id", "season", "kickoff", "home_id"]].rename(columns={"home_id": "team_id"}),
        g[["game_id", "season", "kickoff", "away_id"]].rename(columns={"away_id": "team_id"}),
    ]).sort_values(["team_id", "kickoff"])
    long["rest_days"] = long.groupby(["team_id", "season"]).kickoff.diff().dt.total_seconds() / 86400
    long["rest_days"] = long.rest_days.clip(upper=21).fillna(21)
    return long[["game_id", "team_id", "rest_days"]]


def build_team_frames() -> dict[str, pd.DataFrame]:
    games = load_table("games")
    teams = load_table("teams")
    ids = _team_ids(teams)
    g = fbs_games(games, teams)
    log = team_game_log(g, load_table("advanced"), ids)
    return {
        "games": g,
        "teams": teams,
        "rolling": rolling_team_stats(log),
        "merit": merit_asof(g, teams),
        "coach": coach_features(load_table("coaches"), load_table("records")),
        "experience": experience_features(teams),
        "rest": rest_days(games),
    }


def assemble(frames: dict[str, pd.DataFrame], g: pd.DataFrame | None = None) -> pd.DataFrame:
    """One row per game: home_*, away_* team features, diffs, market, and context."""
    g = (frames["games"] if g is None else g).copy()
    teams = frames["teams"]
    sp = load_table("sp")
    ids = _team_ids(teams)
    sp["team_id"] = [ids.get((s + 1, t)) for s, t in zip(sp.season, sp.team)]
    sp = sp.dropna(subset=["team_id"]).astype({"team_id": int}).assign(season=sp.season + 1)
    sp = sp[["season", "team_id", "sp_rating"]].rename(columns={"sp_rating": "sp_prior"})

    lines = load_table("lines").drop(columns=["season"]).drop_duplicates("game_id")
    g = g.merge(lines[["game_id", "spread", "over_under"]], on="game_id", how="left")
    g["merit_week"] = np.where(g.season_type == "postseason", 99, g.week)

    loc = teams[["season", "team_id", "lat", "lon"]]
    for side in ("home", "away"):
        tid = f"{side}_id"
        part = g[["game_id", "season", "merit_week", tid, f"{side}_elo"]].rename(
            columns={tid: "team_id", f"{side}_elo": "elo"})
        g = g.drop(columns=[f"{side}_elo"])
        n_before = len(part)
        part = (part
                .merge(frames["rolling"], on=["game_id", "team_id"], how="left")
                .merge(frames["merit"], on=["season", "merit_week", "team_id"], how="left")
                .merge(sp, on=["season", "team_id"], how="left")
                .merge(frames["coach"], on=["season", "team_id"], how="left")
                .merge(frames["experience"], on=["season", "team_id"], how="left")
                .merge(frames["rest"], on=["game_id", "team_id"], how="left")
                .merge(loc, on=["season", "team_id"], how="left"))
        assert len(part) == n_before, f"{side} feature join duplicated rows"
        cols = TEAM_FEATURES + ["lat", "lon"]
        part = part[["game_id"] + cols].rename(columns={c: f"{side}_{c}" for c in cols})
        g = g.merge(part, on="game_id", how="left")

    g = pd.concat(
        [g, pd.DataFrame({f"diff_{c}": g[f"home_{c}"] - g[f"away_{c}"] for c in TEAM_FEATURES})],
        axis=1,
    )
    travel = _haversine_km(g.home_lat, g.home_lon, g.away_lat, g.away_lon)
    g["travel_km"] = np.where(g.neutral_site, np.nan, travel)
    g["neutral_site"] = g.neutral_site.astype(int)
    g["conference_game"] = g.conference_game.astype(int)
    g["nil_era"] = (g.season >= NIL_ERA_START).astype(int)
    g["cfp12"] = (g.season >= CFP12_START).astype(int)
    g["home_margin"] = g.home_points - g.away_points
    g["home_win"] = (g.home_margin > 0).astype(float).where(g.completed)
    return g


def feature_columns(market: bool) -> list[str]:
    cols = [f"diff_{c}" for c in TEAM_FEATURES]
    cols += ["home_elo", "away_elo", "home_merit_score", "away_merit_score"]
    cols += GAME_FEATURES
    if market:
        cols += MARKET_FEATURES
    return cols


def main() -> None:
    frames = build_team_frames()
    df = assemble(frames)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_parquet(PROCESSED_DIR / "game_features.parquet", index=False)
    for name in ("merit", "coach", "experience"):
        frames[name].to_parquet(PROCESSED_DIR / f"team_{name}.parquet", index=False)
    done = df[df.completed]
    print(f"{len(df):,} FBS games ({len(done):,} completed) x {len(feature_columns(True))} features")
    print(done[feature_columns(True)].isna().mean().sort_values(ascending=False).head(10).round(3))


if __name__ == "__main__":
    main()
