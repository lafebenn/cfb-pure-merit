"""Monte Carlo: rest of the regular season -> conference title games -> two CFP formats.

Formats
  real   12 teams: 5 highest-ranked conference champions + 7 at-large, seeded straight by the
         committee emulator (2025+ rules; top 4 get byes, 5-8 host first round).
  merit  12 teams: top 12 of the Pure Merit formula, seeded straight.
"""

from __future__ import annotations

from dataclasses import dataclass

import lightgbm as lgb
import numpy as np
import pandas as pd

from cfbml.config import ARTIFACTS_DIR, CFP12_START, NIL_ERA_START, PROCESSED_DIR
from cfbml.features.build import TEAM_FEATURES, _haversine_km
from cfbml.ingest.backfill import load_table
from cfbml.merit import MeritGame, merit_rankings
from cfbml.models.committee import FEATURES as COMMITTEE_FEATURES
from cfbml.models.committee import add_derived, brand_table
from cfbml.models.game import GameModel
from cfbml.sim.conferences import championship_games

# First round: (higher seed, lower seed); quarterfinal byes face these winners in order.
FIRST_ROUND = [(5, 12), (6, 11), (7, 10), (8, 9)]
QF_BYE_VS = {1: (8, 9), 2: (7, 10), 3: (6, 11), 4: (5, 12)}
STAGES = ["playoff", "bye", "quarterfinal", "semifinal", "final", "champion"]


@dataclass
class SeasonContext:
    season: int
    teams: pd.DataFrame            # index 0..n-1, team_id, school, conference, division, ...
    idx: dict[int, int]
    completed: list[MeritGame]
    remaining: pd.DataFrame        # FBS regular games not yet played, with p_home / mu
    conf_done: pd.DataFrame        # completed conference games
    champ_week: int
    snapshot: pd.DataFrame         # per team as-of features (for hypothetical matchups)
    p_neutral_post: np.ndarray
    p_home_post: np.ndarray
    p_conf_champ: np.ndarray
    sigma: float
    committee_static: pd.DataFrame


def _team_snapshot(gf: pd.DataFrame) -> pd.DataFrame:
    """Each team's features as of now: its next unplayed game, else its most recent game."""
    parts = []
    for side in ("home", "away"):
        cols = [f"{side}_{c}" for c in TEAM_FEATURES + ["lat", "lon"]]
        p = gf[["kickoff", "completed", f"{side}_id"] + cols].copy()
        p.columns = ["kickoff", "completed", "team_id"] + TEAM_FEATURES + ["lat", "lon"]
        parts.append(p)
    s = pd.concat(parts)
    upcoming = s[~s.completed].sort_values("kickoff").drop_duplicates("team_id")
    past = s[s.completed].sort_values("kickoff").drop_duplicates("team_id", keep="last")
    past = past[~past.team_id.isin(upcoming.team_id)]
    return pd.concat([upcoming, past]).set_index("team_id")[TEAM_FEATURES + ["lat", "lon"]]


def _pair_matrix(model: GameModel, snap: pd.DataFrame, order: list[int], season: int, *,
                 neutral: bool, postseason: bool, conference_game: bool, week: int) -> np.ndarray:
    """P(row team beats column team) with the row team as nominal home side."""
    s = snap.reindex(order)
    n = len(order)
    hi, ai = np.repeat(np.arange(n), n), np.tile(np.arange(n), n)
    vals = s[TEAM_FEATURES].to_numpy(float)
    vals[:, TEAM_FEATURES.index("rest_days")] = 7.0
    df = pd.DataFrame(vals[hi] - vals[ai], columns=[f"diff_{c}" for c in TEAM_FEATURES])
    df["home_elo"] = s.elo.to_numpy()[hi]
    df["away_elo"] = s.elo.to_numpy()[ai]
    df["home_merit_score"] = s.merit_score.to_numpy()[hi]
    df["away_merit_score"] = s.merit_score.to_numpy()[ai]
    df["neutral_site"] = int(neutral)
    df["conference_game"] = int(conference_game)
    df["postseason"] = int(postseason)
    df["travel_km"] = np.nan if neutral else _haversine_km(
        s.lat.to_numpy()[hi], s.lon.to_numpy()[hi], s.lat.to_numpy()[ai], s.lon.to_numpy()[ai])
    df["week"] = week
    df["nil_era"] = int(season >= NIL_ERA_START)
    df["cfp12"] = int(season >= CFP12_START)
    p = model.win_prob(df).reshape(n, n)
    if neutral:
        p = 0.5 * (p + (1 - p.T))
    np.fill_diagonal(p, 0.5)
    return p


def load_context(season: int) -> SeasonContext:
    full, nomkt = GameModel.load("game_full"), GameModel.load("game_nomarket")
    teams_all = load_table("teams")
    teams = teams_all[teams_all.season == season].reset_index(drop=True)
    records = load_table("records")
    div = records[records.season == season].set_index("team_id").division
    teams["division"] = teams.team_id.map(div)
    order = teams.team_id.tolist()
    idx = {t: i for i, t in enumerate(order)}

    gf = pd.read_parquet(PROCESSED_DIR / "game_features.parquet")
    gf = gf[gf.season == season].copy()
    gf["kickoff"] = pd.to_datetime(gf.start_date, utc=True)
    reg = gf[gf.season_type == "regular"]

    # Title games aren't scheduled until matchups are set; drop any placeholder rows.
    cg_ids = set(championship_games(load_table("games")).query("season == @season").game_id)
    done = reg[reg.completed & ~reg.game_id.isin(cg_ids)].dropna(subset=["home_points"])
    completed = [MeritGame(int(r.home_id), int(r.away_id), float(r.home_points),
                           float(r.away_points), bool(r.neutral_site), int(r.week),
                           str(r.start_date)) for r in done.itertuples(index=False)]
    rem = reg[~reg.completed & ~reg.game_id.isin(cg_ids)].copy()
    if len(rem):
        has_line = rem.spread.notna().to_numpy()
        p = nomkt.win_prob(rem)
        mu = nomkt.margin(rem)
        if has_line.any():
            p[has_line] = full.win_prob(rem[has_line])
            mu[has_line] = full.margin(rem[has_line])
        rem["p_home"], rem["mu"], rem["model"] = p, mu, np.where(has_line, "full", "nomarket")

    big_weeks = reg.groupby("week").size()
    champ_week = int(big_weeks[big_weeks >= 10].index.max()) + 1

    snap = _team_snapshot(gf).reindex(order)
    snap["merit_score"] = snap.merit_score.fillna(0)
    kw = dict(season=season)
    ctx_mats = dict(
        p_neutral_post=_pair_matrix(nomkt, snap, order, neutral=True, postseason=True,
                                    conference_game=False, week=1, **kw),
        p_home_post=_pair_matrix(nomkt, snap, order, neutral=False, postseason=True,
                                 conference_game=False, week=1, **kw),
        p_conf_champ=_pair_matrix(nomkt, snap, order, neutral=True, postseason=False,
                                  conference_game=True, week=champ_week, **kw),
    )

    brand = brand_table()
    static = teams[["team_id", "school", "conference"]].merge(
        brand[brand.season == season].drop(columns="season"), on="team_id", how="left")
    for c in ("adj_off_ppa", "adj_def_ppa", "margin", "elo", "sp_prior"):
        static[c] = snap[c].to_numpy()

    conf_done = done[done.conference_game.astype(bool)
                     & (done.home_id.map(teams.set_index("team_id").conference)
                        == done.away_id.map(teams.set_index("team_id").conference))]
    return SeasonContext(season, teams, idx, completed, rem, conf_done, champ_week, snap,
                         sigma=nomkt.sigma, committee_static=static, **ctx_mats)


def _conference_layout(ctx: SeasonContext) -> list[tuple[str, list[list[int]]]]:
    """[(conference, [division members...])]; a single pool when there are no divisions."""
    out = []
    for conf, members in ctx.teams.groupby("conference"):
        if conf == "FBS Independents" or len(members) < 4:
            continue
        if members.division.notna().any():
            pools = [g.team_id.tolist() for _, g in members.groupby("division")]
        else:
            pools = [members.team_id.tolist()]
        out.append((conf, pools))
    return out


def _title_matchups(layout, conf_wl: np.ndarray, all_wl: np.ndarray, elo: np.ndarray,
                    idx: dict[int, int], h2h: set[tuple[int, int]]) -> list[tuple[int, int]]:
    """Top two by conference win% -> overall win% -> Elo (H2H breaks exact #2/#3 ties)."""
    def key(t: int):
        i = idx[t]
        cw, cl = conf_wl[i]
        ow, ol = all_wl[i]
        return (cw / max(cw + cl, 1), ow / max(ow + ol, 1), elo[i])

    games = []
    for _conf, pools in layout:
        if len(pools) >= 2:
            heads = [max(p, key=key) for p in pools[:2]]
        else:
            ranked = sorted(pools[0], key=key, reverse=True)
            a, b = ranked[0], ranked[1]
            if len(ranked) > 2:
                c = ranked[2]
                if key(b)[0] == key(c)[0] and (c, b) in h2h:
                    b = c
            heads = [a, b]
        games.append((heads[0], heads[1]))
    return games


def simulate(ctx: SeasonContext, n_sims: int = 10_000, seed: int = 2026,
             chunk: int = 500) -> dict:
    rng = np.random.default_rng(seed)
    t = ctx.teams
    n = len(t)
    order = t.team_id.tolist()
    idx = ctx.idx
    layout = _conference_layout(ctx)
    elo = ctx.snapshot.elo.fillna(1500).to_numpy(float)

    rem = ctx.remaining
    G = len(rem)
    rem_h = rem.home_id.to_numpy(int) if G else np.array([], int)
    rem_a = rem.away_id.to_numpy(int) if G else np.array([], int)
    rem_p = rem.p_home.to_numpy(float) if G else np.array([])
    rem_mu = rem.mu.to_numpy(float) if G else np.array([])
    rem_neu = rem.neutral_site.astype(bool).to_numpy() if G else np.array([], bool)
    rem_wk = rem.week.to_numpy(int) if G else np.array([], int)
    conf_of = t.set_index("team_id").conference.to_dict()
    rem_conf = np.array([bool(cg) and conf_of.get(h) == conf_of.get(a)
                         for cg, h, a in zip(rem.conference_game, rem_h, rem_a)], bool) \
        if G else np.array([], bool)
    rem_hi = np.array([idx[x] for x in rem_h], int)
    rem_ai = np.array([idx[x] for x in rem_a], int)

    base_conf_wl = np.zeros((n, 2))
    h2h_base: set[tuple[int, int]] = set()
    for r in ctx.conf_done.itertuples(index=False):
        if r.home_points == r.away_points:
            continue
        w, l = (r.home_id, r.away_id) if r.home_points > r.away_points else (r.away_id, r.home_id)
        base_conf_wl[idx[w], 0] += 1
        base_conf_wl[idx[l], 1] += 1
        h2h_base.add((int(w), int(l)))
    base_all_wl = np.zeros((n, 2))
    for g in ctx.completed:
        if g.home_points == g.away_points:
            continue
        w, l = (g.home_id, g.away_id) if g.home_points > g.away_points else (g.away_id, g.home_id)
        base_all_wl[idx[w], 0] += 1
        base_all_wl[idx[l], 1] += 1

    # Static committee inputs in team order; merit / champion columns get filled per sim.
    static = ctx.committee_static.set_index("team_id").reindex(order).reset_index()
    static = static.assign(merit_score=0.0, merit_rank=0, merit_wins=0, merit_losses=0,
                           merit_sos=0.0)
    static = add_derived(static, ctx.season, ctx.champ_week + 1, set(),
                         ctx.champ_week + 1)
    booster = lgb.Booster(model_file=str(ARTIFACTS_DIR / "committee.lgb.txt"))
    static_x = static[COMMITTEE_FEATURES].to_numpy(float)
    fcol = {c: i for i, c in enumerate(COMMITTEE_FEATURES)}

    counts = {fmt: np.zeros((n, len(STAGES))) for fmt in ("real", "merit")}
    seed_ct = {fmt: np.zeros((n, 13)) for fmt in ("real", "merit")}
    seed_sum = {fmt: np.zeros(n) for fmt in ("real", "merit")}
    conf_champ_ct = np.zeros(n)
    committee_rank_sum = np.zeros(n)
    merit_rank_sum = np.zeros(n)
    field_overlap = []

    for start in range(0, n_sims, chunk):
        k = min(chunk, n_sims - start)
        hw = rng.random((k, G)) < rem_p
        mag = np.maximum(1.0, np.abs(rng.normal(rem_mu, ctx.sigma, (k, G))))
        margin = np.where(hw, mag, -mag)
        hp = 24.0 + np.maximum(margin, 0)
        ap = 24.0 + np.maximum(-margin, 0)

        X = np.tile(static_x, (k, 1))
        sim_merit: list[list[int]] = []
        sim_champs: list[set[int]] = []
        for s in range(k):
            win_i = np.where(hw[s], rem_hi, rem_ai)
            loss_i = np.where(hw[s], rem_ai, rem_hi)
            all_wl = base_all_wl.copy()
            np.add.at(all_wl[:, 0], win_i, 1)
            np.add.at(all_wl[:, 1], loss_i, 1)
            conf_wl = base_conf_wl.copy()
            np.add.at(conf_wl[:, 0], win_i[rem_conf], 1)
            np.add.at(conf_wl[:, 1], loss_i[rem_conf], 1)
            h2h = h2h_base | {(order[w], order[l])
                              for w, l in zip(win_i[rem_conf], loss_i[rem_conf])}

            games = list(ctx.completed)
            games.extend(MeritGame(int(rem_h[j]), int(rem_a[j]), float(hp[s, j]),
                                   float(ap[s, j]), bool(rem_neu[j]), int(rem_wk[j]))
                         for j in range(G))
            champs: set[int] = set()
            for a, b in _title_matchups(layout, conf_wl, all_wl, elo, idx, h2h):
                a_wins = rng.random() < ctx.p_conf_champ[idx[a], idx[b]]
                m = max(1.0, abs(rng.normal(0.0, ctx.sigma)))
                games.append(MeritGame(a, b, 24.0 + (m if a_wins else 0),
                                       24.0 + (0 if a_wins else m), True, ctx.champ_week))
                champs.add(a if a_wins else b)

            merit = merit_rankings(games, order)
            row = slice(s * n, (s + 1) * n)
            mi = np.array([idx[r.team_id] for r in merit])
            for col, vals in (("merit_score", [r.merit_score for r in merit]),
                              ("merit_rank", [r.rank for r in merit]),
                              ("merit_wins", [r.wins for r in merit]),
                              ("merit_losses", [r.losses for r in merit]),
                              ("merit_sos", [r.sos_score for r in merit])):
                arr = np.empty(n)
                arr[mi] = vals
                X[row, fcol[col]] = arr
            losses = X[row, fcol["merit_losses"]]
            X[row, fcol["unbeaten"]] = losses == 0
            X[row, fcol["one_loss"]] = losses == 1
            X[row, fcol["conf_champ"]] = np.isin(order, list(champs))
            sim_merit.append([r.team_id for r in merit])
            sim_champs.append(champs)

        scores = booster.predict(X).reshape(k, n)
        for s in range(k):
            committee_order = [order[i] for i in np.argsort(-scores[s], kind="stable")]
            merit_order = sim_merit[s]
            committee_rank_sum[[idx[x] for x in committee_order]] += np.arange(1, n + 1)
            merit_rank_sum[[idx[x] for x in merit_order]] += np.arange(1, n + 1)
            for c in sim_champs[s]:
                conf_champ_ct[idx[c]] += 1

            real_field = _real_field(committee_order, sim_champs[s])
            merit_field = merit_order[:12]
            field_overlap.append(len(set(real_field) & set(merit_field)))
            for fmt, field in (("real", real_field), ("merit", merit_field)):
                reached = _play_bracket(ctx, field, rng)
                for seed_no, tid in enumerate(field, 1):
                    i = idx[tid]
                    seed_ct[fmt][i, seed_no] += 1
                    seed_sum[fmt][i] += seed_no
                    counts[fmt][i, 0] += 1
                    if seed_no <= 4:
                        counts[fmt][i, 1] += 1
                    r = reached[tid]
                    if r >= 2:
                        counts[fmt][i, 2:r + 1] += 1

    out = t[["team_id", "school", "conference"]].copy()
    for fmt in counts:
        probs = counts[fmt] / n_sims
        for si, stage in enumerate(STAGES):
            out[f"{fmt}_{stage}"] = probs[:, si]
        has = seed_ct[fmt][:, 1:].sum(1) > 0
        out[f"{fmt}_modal_seed"] = np.where(has, seed_ct[fmt][:, 1:].argmax(1) + 1, 0)
        out[f"{fmt}_avg_seed"] = np.where(has, seed_sum[fmt] / np.maximum(counts[fmt][:, 0], 1),
                                          np.nan)
    out["conf_champ"] = conf_champ_ct / n_sims
    out["avg_committee_rank"] = committee_rank_sum / n_sims
    out["avg_merit_rank"] = merit_rank_sum / n_sims
    return {"teams": out, "n_sims": n_sims, "field_overlap_mean": float(np.mean(field_overlap))}


def _real_field(committee_order: list[int], champs: set[int]) -> list[int]:
    auto = [t for t in committee_order if t in champs][:5]
    field = set(auto)
    for t in committee_order:
        if len(field) >= 12:
            break
        field.add(t)
    return [t for t in committee_order if t in field]


def _play_bracket(ctx: SeasonContext, field: list[int], rng) -> dict[int, int]:
    """Returns furthest stage index reached per team (index into STAGES)."""
    seed = {i + 1: t for i, t in enumerate(field)}
    reached = {t: 0 for t in field}
    for s in (1, 2, 3, 4):
        reached[seed[s]] = 2  # bye counts as reaching the quarterfinal

    def play(a: int, b: int, home: bool) -> int:
        ia, ib = ctx.idx[a], ctx.idx[b]
        p = ctx.p_home_post[ia, ib] if home else ctx.p_neutral_post[ia, ib]
        return a if rng.random() < p else b

    r1 = {}
    for hi, lo in FIRST_ROUND:
        w = play(seed[hi], seed[lo], home=True)
        reached[w] = max(reached[w], 2)
        r1[(hi, lo)] = w
    qf_winners = []
    for top in (1, 2, 3, 4):
        w = play(seed[top], r1[QF_BYE_VS[top]], home=False)
        reached[w] = max(reached[w], 3)
        qf_winners.append(w)
    # Bracket halves: (1 v 4-side) and (2 v 3-side)
    sf1 = play(qf_winners[0], qf_winners[3], home=False)
    sf2 = play(qf_winners[1], qf_winners[2], home=False)
    reached[sf1] = max(reached[sf1], 4)
    reached[sf2] = max(reached[sf2], 4)
    champ = play(sf1, sf2, home=False)
    reached[champ] = 5
    return reached
