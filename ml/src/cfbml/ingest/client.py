from __future__ import annotations

import gzip
import json
import time
from pathlib import Path
from typing import Any

import requests

from cfbml.config import RAW_DIR, cfbd_api_key

BASE_URL = "https://api.collegefootballdata.com"


class CfbdClient:
    """Thin CFBD client with a permanent on-disk cache keyed by endpoint + season."""

    def __init__(self, raw_dir: Path = RAW_DIR, pause_s: float = 0.25):
        self.raw_dir = raw_dir
        self.pause_s = pause_s
        self.session = requests.Session()
        self.session.headers.update(
            {"Authorization": f"Bearer {cfbd_api_key()}", "Accept": "application/json"}
        )
        self.calls = 0
        self.remaining: int | None = None

    def cache_path(self, name: str, season: int | str) -> Path:
        return self.raw_dir / name / f"{season}.json.gz"

    def get(
        self,
        name: str,
        season: int | str,
        path: str,
        params: dict[str, Any],
        refresh: bool = False,
    ) -> Any:
        cache = self.cache_path(name, season)
        if cache.exists() and not refresh:
            with gzip.open(cache, "rt") as f:
                return json.load(f)

        for attempt in range(4):
            res = self.session.get(f"{BASE_URL}{path}", params=params, timeout=120)
            if res.status_code == 429 or res.status_code >= 500:
                time.sleep(2 ** attempt * 2)
                continue
            res.raise_for_status()
            break
        else:
            res.raise_for_status()

        self.calls += 1
        remaining = res.headers.get("X-CallLimit-Remaining")
        if remaining is not None:
            self.remaining = int(remaining)
        data = res.json()
        cache.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(cache, "wt") as f:
            json.dump(data, f)
        time.sleep(self.pause_s)
        return data
