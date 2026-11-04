"""`uv run cfbml <command>` — one entry point for the weekly job and local work."""

from __future__ import annotations

import argparse
import json
import sys

from cfbml.config import FIRST_INGEST_SEASON, PREDICTIONS_PATH, REPORTS_DIR, current_season


def cmd_ingest(args) -> None:
    from cfbml.ingest.backfill import fetch_all, normalize, write_processed

    client = fetch_all(args.first, args.last, refresh_current=args.refresh_current)
    write_processed(normalize(args.first, args.last, client))
    print(f"CFBD calls: {client.calls}; remaining quota: {client.remaining}")


def cmd_features(_args) -> None:
    from cfbml.features.build import main

    main()


def cmd_backtest(_args) -> None:
    from cfbml.models import game

    df = game.load_games()
    bt = game.walk_forward(df)
    bt["ship_gate"] = game.ship_gate(bt)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    (REPORTS_DIR / "game_backtest.json").write_text(json.dumps(bt, indent=2))
    print(json.dumps(bt["pooled"], indent=2), "\nship gate:", bt["ship_gate"])
    if not all(bt["ship_gate"].values()):
        sys.exit("game model failed its ship gate; keeping the previous artifacts")


def cmd_train(args) -> None:
    from cfbml.models import committee, game

    if not args.skip_backtest:
        cmd_backtest(args)
    for name, m in game.train_production(game.load_games()).items():
        print(f"saved game_{name}: sigma={m.sigma:.2f}")
    sys.argv = ["committee"]
    committee.main()


def cmd_predict(args) -> None:
    from cfbml.publish import build, _json_default

    out = build(args.season, args.sims, args.seed)
    PREDICTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREDICTIONS_PATH.write_text(json.dumps(out, indent=1, default=_json_default))
    print(f"wrote {PREDICTIONS_PATH}: {out['nSims']} sims, week {out['nextWeek']}, "
          f"{len(out['upsetAlerts'])} upset alerts")


def main() -> None:
    ap = argparse.ArgumentParser(prog="cfbml")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("ingest", help="Fetch CFBD data (cached) and write parquet tables")
    p.add_argument("--first", type=int, default=FIRST_INGEST_SEASON)
    p.add_argument("--last", type=int, default=current_season())
    p.add_argument("--refresh-current", action="store_true")
    p.set_defaults(fn=cmd_ingest)

    sub.add_parser("features", help="Build as-of-kickoff game features").set_defaults(
        fn=cmd_features)
    sub.add_parser("backtest", help="Walk-forward backtest + ship gate").set_defaults(
        fn=cmd_backtest)

    p = sub.add_parser("train", help="Retrain game models and the committee emulator")
    p.add_argument("--skip-backtest", action="store_true")
    p.set_defaults(fn=cmd_train)

    p = sub.add_parser("predict", help="Simulate the season and write predictions.json")
    p.add_argument("--season", type=int, default=current_season())
    p.add_argument("--sims", type=int, default=10_000)
    p.add_argument("--seed", type=int, default=2026)
    p.set_defaults(fn=cmd_predict)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
