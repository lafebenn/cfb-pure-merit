"""Conference championship detection + conference metadata."""

from __future__ import annotations

import pandas as pd

POWER_CONFERENCES = {"SEC", "Big Ten", "Big 12", "ACC", "Pac-12"}
CONF_ONEHOT = ["SEC", "Big Ten", "Big 12", "ACC", "Pac-12", "FBS Independents"]


def is_power(conference: str | None, season: int, school: str | None = None) -> bool:
    if school == "Notre Dame":
        return True
    if conference == "Pac-12":
        return season < 2024
    return conference in POWER_CONFERENCES


def championship_games(games: pd.DataFrame) -> pd.DataFrame:
    """Regular-season conference title games, one row per (season, conference).

    CFBD only labels them in `notes` from 2022; earlier seasons use the lone December
    conference game in that conference's final conference week.
    """
    g = games[(games.season_type == "regular") & (games.home_class == "fbs")
              & (games.away_class == "fbs")].copy()
    g["kickoff"] = pd.to_datetime(g.start_date, utc=True)
    notes = g.notes.fillna("")
    noted = g[notes.str.contains("Championship", case=False)
              & ~notes.str.contains("FCS|Division", case=False)
              & (g.home_conference == g.away_conference)]

    army_navy = g.home_team.isin(["Army", "Navy"]) & g.away_team.isin(["Army", "Navy"])
    same = g[(g.home_conference == g.away_conference) & g.home_conference.notna()
             & (g.home_conference != "FBS Independents") & ~army_navy]
    last_week = same.groupby(["season", "home_conference"]).week.transform("max")
    final = same[same.week == last_week]
    counts = final.groupby(["season", "home_conference"]).game_id.transform("size")
    heuristic = final[(counts == 1) & (final.kickoff.dt.month == 12)]

    # Prefer the labeled game; fall back to the heuristic per conference-season.
    out = pd.concat([noted, heuristic]).drop_duplicates(["season", "home_conference"])
    out = out.rename(columns={"home_conference": "conference"})
    return out[["season", "week", "game_id", "conference", "home_id", "away_id",
                "home_points", "away_points", "completed"]]


def champions(champ_games: pd.DataFrame) -> pd.DataFrame:
    done = champ_games[champ_games.completed].dropna(subset=["home_points", "away_points"])
    winner = done.home_id.where(done.home_points > done.away_points, done.away_id)
    return pd.DataFrame({"season": done.season, "conference": done.conference,
                         "team_id": winner.astype(int), "week": done.week})
