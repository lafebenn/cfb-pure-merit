from __future__ import annotations

import os
from datetime import date
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ML_ROOT.parent
DATA_DIR = ML_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
ARTIFACTS_DIR = ML_ROOT / "artifacts"
REPORTS_DIR = ML_ROOT / "reports"
PREDICTIONS_PATH = REPO_ROOT / "public" / "data" / "predictions.json"

FIRST_MODEL_SEASON = 2014
# Prior-season features for 2014 need 2013.
FIRST_INGEST_SEASON = 2013
NIL_ERA_START = 2021
CFP12_START = 2024

TRAIN_SEASONS = list(range(2014, 2022))
VALID_SEASONS = [2022, 2023]
TEST_SEASONS = [2024, 2025]


def current_season(today: date | None = None) -> int:
    today = today or date.today()
    return today.year if today.month >= 7 else today.year - 1


def cfbd_api_key() -> str:
    key = os.environ.get("CFBD_API_KEY")
    if key:
        return key
    env_file = REPO_ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("CFBD_API_KEY="):
                return line.split("=", 1)[1].strip().strip("\"'")
    raise RuntimeError("Missing CFBD_API_KEY (env var or ../.env.local).")
