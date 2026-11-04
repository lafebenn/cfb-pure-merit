"""Backfill CFBD history into raw JSON cache, then normalize into parquet tables."""

from __future__ import annotations

import argparse
import statistics
from typing import Any, Callable

import pandas as pd

from cfbml.config import FIRST_INGEST_SEASON, NIL_ERA_START, PROCESSED_DIR, current_season
from cfbml.ingest.client import CfbdClient

COACH_HISTORY_START = 1990

# name -> (path, params builder, first season available)
SEASON_ENDPOINTS: dict[str, tuple[str, Callable[[int], dict[str, Any]], int]] = {
    "teams_fbs": ("/teams/fbs", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "games": ("/games", lambda y: {"year": y, "seasonType": "both"}, FIRST_INGEST_SEASON),
    "records": ("/records", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "advanced": ("/stats/game/advanced", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "sp": ("/ratings/sp", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "lines": ("/lines", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "returning": ("/player/returning", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "usage": ("/player/usage", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "roster": ("/roster", lambda y: {"year": y}, FIRST_INGEST_SEASON),
    "portal": ("/player/portal", lambda y: {"year": y}, NIL_ERA_START),
    "rankings": ("/rankings", lambda y: {"year": y}, FIRST_INGEST_SEASON),
}

# Fields that only change during the season; everything else for the current season
# (rosters, returning production, prior-season usage) is stable once fall camp starts.
IN_SEASON_ENDPOINTS = {"games", "records", "advanced", "lines", "rankings", "sp"}


def fetch_all(
    first: int, last: int, refresh_current: bool, client: CfbdClient | None = None
) -> CfbdClient:
    client = client or CfbdClient()
    cur = current_season()
    for season in range(first, last + 1):
        for name, (path, params, start) in SEASON_ENDPOINTS.items():
            if season < start:
                continue
            refresh = refresh_current and season == cur and name in IN_SEASON_ENDPOINTS
            client.get(name, season, path, params(season), refresh=refresh)
    # Coaches go back further so 2014 coaches have real career résumés.
    client.get(
        "coaches",
        "all",
        "/coaches",
        {"minYear": COACH_HISTORY_START, "maxYear": last},
        refresh=refresh_current,
    )
    return client


def _load(client: CfbdClient, name: str, season: int | str) -> Any:
    path = client.cache_path(name, season)
    if not path.exists():
        return []
    return client.get(name, season, "", {})


def _consensus(values: list[float | None]) -> float | None:
    clean = [v for v in values if v is not None]
    return statistics.median(clean) if clean else None


def normalize(first: int, last: int, client: CfbdClient) -> dict[str, pd.DataFrame]:
    rows: dict[str, list[dict[str, Any]]] = {k: [] for k in [
        "teams", "games", "advanced", "lines", "sp", "returning",
        "usage", "roster", "portal", "rankings", "records",
    ]}

    for season in range(first, last + 1):
        for t in _load(client, "teams_fbs", season):
            logos = t.get("logos") or []
            loc = t.get("location") or {}
            rows["teams"].append({
                "season": season,
                "team_id": t["id"],
                "school": t["school"],
                "conference": t.get("conference"),
                "color": t.get("color"),
                "logo": next((l for l in logos if "/logos/500/" in l), logos[0] if logos else None),
                "logo_dark": next((l for l in logos if "/logos-dark/500/" in l), None),
                "lat": loc.get("latitude"),
                "lon": loc.get("longitude"),
            })

        for g in _load(client, "games", season):
            rows["games"].append({
                "game_id": g["id"],
                "season": season,
                "week": g["week"],
                "season_type": g["seasonType"],
                "start_date": g["startDate"],
                "completed": bool(g["completed"]),
                "neutral_site": bool(g["neutralSite"]),
                "conference_game": bool(g.get("conferenceGame")),
                "home_id": g["homeId"],
                "home_team": g["homeTeam"],
                "home_class": g.get("homeClassification"),
                "home_conference": g.get("homeConference"),
                "home_points": g.get("homePoints"),
                "home_elo": g.get("homePregameElo"),
                "away_id": g["awayId"],
                "away_team": g["awayTeam"],
                "away_class": g.get("awayClassification"),
                "away_conference": g.get("awayConference"),
                "away_points": g.get("awayPoints"),
                "away_elo": g.get("awayPregameElo"),
                "notes": g.get("notes"),
            })

        for a in _load(client, "advanced", season):
            o, d = a.get("offense") or {}, a.get("defense") or {}
            rows["advanced"].append({
                "game_id": a["gameId"],
                "season": season,
                "week": a["week"],
                "team": a["team"],
                "opponent": a["opponent"],
                "off_plays": o.get("plays"),
                "off_drives": o.get("drives"),
                "off_ppa": o.get("ppa"),
                "off_success": o.get("successRate"),
                "off_explosiveness": o.get("explosiveness"),
                "def_plays": d.get("plays"),
                "def_drives": d.get("drives"),
                "def_ppa": d.get("ppa"),
                "def_success": d.get("successRate"),
                "def_explosiveness": d.get("explosiveness"),
            })

        for ln in _load(client, "lines", season):
            lines = ln.get("lines") or []
            rows["lines"].append({
                "game_id": ln["id"],
                "season": season,
                "spread": _consensus([x.get("spread") for x in lines]),
                "spread_open": _consensus([x.get("spreadOpen") for x in lines]),
                "over_under": _consensus([x.get("overUnder") for x in lines]),
            })

        for s in _load(client, "sp", season):
            if s.get("team") in (None, "nationalAverages"):
                continue
            rows["sp"].append({
                "season": season,
                "team": s["team"],
                "sp_rating": s.get("rating"),
                "sp_offense": (s.get("offense") or {}).get("rating"),
                "sp_defense": (s.get("defense") or {}).get("rating"),
            })

        for r in _load(client, "returning", season):
            rows["returning"].append({
                "season": season,
                "team": r["team"],
                "ret_ppa_pct": r.get("percentPPA"),
                "ret_pass_ppa_pct": r.get("percentPassingPPA"),
                "ret_rush_ppa_pct": r.get("percentRushingPPA"),
                "ret_rec_ppa_pct": r.get("percentReceivingPPA"),
                "ret_usage": r.get("usage"),
            })

        for u in _load(client, "usage", season):
            usage = u.get("usage") or {}
            rows["usage"].append({
                "season": season,
                "player_id": str(u["id"]),
                "team": u["team"],
                "position": u.get("position"),
                "usage": usage.get("overall"),
                "usage_pass": usage.get("pass"),
            })

        for p in _load(client, "roster", season):
            rows["roster"].append({
                "season": season,
                "player_id": str(p["id"]),
                "team": p["team"],
                "position": p.get("position"),
                "class_year": p.get("year"),
            })

        for p in _load(client, "portal", season):
            rows["portal"].append({
                "season": season,
                "origin": p.get("origin"),
                "destination": p.get("destination"),
                "position": p.get("position"),
                "stars": p.get("stars"),
            })

        for wk in _load(client, "rankings", season):
            for poll in wk.get("polls") or []:
                if poll["poll"] not in ("Playoff Committee Rankings", "AP Top 25"):
                    continue
                for rk in poll.get("ranks") or []:
                    rows["rankings"].append({
                        "season": season,
                        "season_type": wk["seasonType"],
                        "week": wk["week"],
                        "poll": poll["poll"],
                        "rank": rk["rank"],
                        "team_id": rk.get("teamId"),
                        "school": rk["school"],
                        "conference": rk.get("conference"),
                    })

        for r in _load(client, "records", season):
            if r.get("classification") != "fbs":
                continue
            rows["records"].append({
                "season": season,
                "team_id": r["teamId"],
                "team": r["team"],
                "conference": r.get("conference"),
                "division": r.get("division") or None,
                "expected_wins": r.get("expectedWins"),
            })

    coaches = []
    for c in _load(client, "coaches", "all"):
        for s in c.get("seasons") or []:
            coaches.append({
                "coach_id": c["id"],
                "coach": f"{c['firstName']} {c['lastName']}",
                "season": s["year"],
                "team_id": s.get("teamId"),
                "school": s["school"],
                "games": s.get("games") or 0,
                "wins": s.get("wins") or 0,
                "losses": s.get("losses") or 0,
                "srs": s.get("srs"),
                "sp_overall": s.get("spOverall"),
                "postseason_rank": s.get("postseasonRank"),
            })

    frames = {k: pd.DataFrame(v) for k, v in rows.items()}
    frames["coaches"] = pd.DataFrame(coaches)
    return frames


def write_processed(frames: dict[str, pd.DataFrame]) -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    for name, df in frames.items():
        df.to_parquet(PROCESSED_DIR / f"{name}.parquet", index=False)


def load_table(name: str) -> pd.DataFrame:
    return pd.read_parquet(PROCESSED_DIR / f"{name}.parquet")


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill CFBD history to ml/data.")
    ap.add_argument("--first", type=int, default=FIRST_INGEST_SEASON)
    ap.add_argument("--last", type=int, default=current_season())
    ap.add_argument("--refresh-current", action="store_true")
    args = ap.parse_args()

    client = fetch_all(args.first, args.last, args.refresh_current)
    frames = normalize(args.first, args.last, client)
    write_processed(frames)
    print(f"CFBD calls this run: {client.calls}; remaining quota: {client.remaining}")
    for name, df in frames.items():
        print(f"  {name:10s} {len(df):>8,d} rows")


if __name__ == "__main__":
    main()
