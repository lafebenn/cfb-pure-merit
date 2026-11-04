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
2. Set `CFBD_API_KEY`. Optionally set `CRON_SECRET` to protect `/api/refresh`.
3. Deploy. `vercel.json` registers a Sunday cron that calls `/api/refresh` to bust the CFBD cache.

CLI:

```bash
npx vercel --prod
```

Manual refresh: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/refresh`

## Future: ML playoff projections

Out of scope for v1. Planned later:

- Predict weekly W/L and season outcomes
- Playoff qualification odds
- Counterfactuals: how odds shift given a win or loss in a given week

## Disclaimer

Unofficial fan rankings. Not affiliated with the College Football Playoff, NCAA, or CFBD beyond use of their public API.
