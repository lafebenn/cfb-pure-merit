import gzip
import json
import shutil
import subprocess
from pathlib import Path

import pandas as pd
import pytest

from cfbml.config import ML_ROOT, PROCESSED_DIR, RAW_DIR
from cfbml.merit import games_from_frame, merit_rankings

TS_SCRIPT = ML_ROOT / "tests" / "merit_ts_dump.ts"


def _raw(name: str, season: int):
    path = RAW_DIR / name / f"{season}.json.gz"
    if not path.exists():
        pytest.skip(f"missing raw cache {path}; run the backfill first")
    with gzip.open(path, "rt") as f:
        return json.load(f)


@pytest.mark.parametrize("season", [2024, 2025, 2026])
def test_python_port_matches_typescript(season: int, tmp_path: Path):
    if shutil.which("node") is None:
        pytest.skip("node not installed")

    teams = _raw("teams_fbs", season)
    payload = {
        "season": season,
        "fetchedAt": "",
        "teams": teams,
        "fbsTeamIds": [t["id"] for t in teams],
        "games": _raw("games", season),
        "records": _raw("records", season),
    }
    data_file = tmp_path / "season.json"
    data_file.write_text(json.dumps(payload))
    out = subprocess.run(
        ["node", "--no-warnings", str(TS_SCRIPT), str(data_file)],
        capture_output=True, text=True, check=True,
    )
    ts = {r["teamId"]: r for r in json.loads(out.stdout)}

    games = pd.read_parquet(PROCESSED_DIR / "games.parquet")
    games = games[games.season == season]
    py = merit_rankings(
        games_from_frame(games),
        [t["id"] for t in teams],
        {t["id"]: t["school"] for t in teams},
    )

    assert len(py) == len(ts)
    for r in py:
        assert r.merit_score == pytest.approx(ts[r.team_id]["meritScore"], abs=1e-6)
    py_top25 = [r.team_id for r in py[:25]]
    ts_top25 = [t["teamId"] for t in sorted(ts.values(), key=lambda x: x["rank"])[:25]]
    assert py_top25 == ts_top25
