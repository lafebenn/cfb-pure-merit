import numpy as np
import pandas as pd
import pytest

from cfbml.config import PROCESSED_DIR
from cfbml.features.build import _team_ids, fbs_games, rolling_team_stats, team_game_log
from cfbml.ingest.backfill import load_table


@pytest.fixture(scope="module")
def log():
    if not (PROCESSED_DIR / "games.parquet").exists():
        pytest.skip("run the backfill first")
    teams = load_table("teams")
    g = fbs_games(load_table("games"), teams)
    g = g[g.season.isin([2024, 2025])]
    return team_game_log(g, load_table("advanced"), _team_ids(teams))


def test_rolling_features_ignore_future_games(log):
    cutoff = pd.Timestamp("2025-10-15", tz="UTC")
    full = rolling_team_stats(log)
    # Erase everything that happened on/after the cutoff (scores and stats unknown yet).
    truncated = log.copy()
    future = truncated.kickoff >= cutoff
    stat_cols = [c for c in truncated.columns if c.startswith(("off_", "def_"))] + ["pf", "pa", "margin"]
    truncated.loc[future, stat_cols] = np.nan
    truncated.loc[future, "completed"] = False
    partial = rolling_team_stats(truncated)

    # The first game per team on/after the cutoff must see identical features either way.
    nxt = log[future].sort_values("kickoff").drop_duplicates("team_id")[["game_id", "team_id"]]
    a = nxt.merge(full, on=["game_id", "team_id"]).sort_values(["game_id", "team_id"])
    b = nxt.merge(partial, on=["game_id", "team_id"]).sort_values(["game_id", "team_id"])
    cols = [c for c in full.columns if c not in ("game_id", "team_id")]
    assert len(a) > 50
    np.testing.assert_allclose(a[cols].to_numpy(float), b[cols].to_numpy(float), rtol=0, atol=1e-9)
