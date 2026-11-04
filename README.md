# CFB Pure Merit Rankings

Lightweight Next.js app that computes a custom Top 25 college football ranking from an **Advanced Pure Merit Formula**, using live weekly data from the [CollegeFootballData](https://collegefootballdata.com/) (CFBD) API.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- CFBD API (Bearer token, server-side only)
- Vercel Cron — refreshes rankings every **Sunday 18:00 UTC** (~11am MT)

## Setup

1. Clone the repo and install:

```bash
npm install
```

2. Copy env and add your free CFBD key from [collegefootballdata.com/key](https://collegefootballdata.com/key):

```bash
cp .env.example .env.local
```

3. Run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Formula (v2)

`Total = Win Value + Loss Penalties + Road + Resume + Game Control`

**Scrub first:** only games with both `homeFbs` and `awayFbs` true. FCS games discarded. Opponent strength uses H2H-adjusted records (remove the game vs the team being ranked). No conference or historic brand inputs.

1. **Win value** — each FBS win: `0.55 + 0.90 × oppAdjustedWin%`
2. **Losses (tiered, then compounded)** — road vs adj >.660: −0.55; standard ≥.500: −0.75; weak home: −1.10; weak road: −0.70. If 2+ losses: total × `(1 + 0.45 × (losses − 1))`
3. **Road** — +0.35 per true road win, capped at +1.00
4. **Resume** — `3.2 × (OW% + OOW%)`
5. **Game control** — avg FBS margin / 100, capped at +0.02

## Deploy (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lafebenn/cfb-pure-merit&env=CFBD_API_KEY&envDescription=Free%20API%20key%20from%20collegefootballdata.com/key&project-name=cfb-pure-merit)

1. Import `lafebenn/cfb-pure-merit` (or click Deploy).
2. Set `CFBD_API_KEY` and `CRON_SECRET`. Vercel Cron sends `CRON_SECRET` as a Bearer token, and `/api/refresh` rejects everything else in production.
3. Deploy. `vercel.json` registers a Sunday cron that calls `/api/refresh` to bust the CFBD cache.

CLI:

```bash
npx vercel --prod
```

Manual refresh: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/refresh`

## ML predictions (`ml/`)

A Python layer that publishes `public/data/predictions.json` every Sunday. The site reads it from GitHub and hides the panels if it is missing or more than 10 days old.

- **Game model:** LightGBM margin regression plus isotonic win %. Inputs are as of kickoff: opponent-adjusted EPA and success rate, Elo, prior SP+, closing line, coach résumé, and roster experience/portal. No conference or brand.
- **Committee emulator:** LambdaRank on every CFP committee ranking since 2014. It does see conference and brand, on purpose.
- **Simulator:** 10k runs of the remaining schedule, then conference title games, then two brackets. *Real CFP* uses 5 auto-bid champions and is seeded by the emulator. *Pure Merit* is the top 12 of this board.
- **Splits:** train 2014–21, validate 2022–23, test 2024–25 (walk-forward). Results are in `ml/reports/` (`game_backtest.json`, `committee_backtest.json`, `nil_era.md`).

```bash
cd ml
uv run cfbml ingest --refresh-current   # cached CFBD backfill 2013→now (~150 calls cold, ~10 weekly)
uv run cfbml features                   # as-of-kickoff feature table
uv run cfbml train                      # backtest ship gate, then retrain game + committee models
uv run cfbml predict                    # simulate + write public/data/predictions.json
uv run pytest -q                        # TS parity, no-leakage, bracket invariants
```

Automation: `.github/workflows/predict.yml` (Sundays 16:00 UTC, Aug–Jan) and `retrain.yml` (1st of the month). Both need repo secrets `CFBD_API_KEY` and `CRON_SECRET`. The same `CRON_SECRET` must be set on Vercel.

## Disclaimer

Unofficial fan rankings. Not affiliated with the College Football Playoff, NCAA, or CFBD beyond use of their public API.
