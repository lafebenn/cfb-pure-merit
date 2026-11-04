# CFB Pure Merit Rankings

Lightweight Next.js app that computes a custom Top 25 college football ranking from an **Advanced Pure Merit Formula**, using live weekly data from the [CollegeFootballData](https://collegefootballdata.com/) (CFBD) API.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Server Components + `fetch` revalidation every 12 hours
- CFBD API (Bearer token, server-side only)

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

## Formula (v1)

`Total Score = Base Value + Difficulty Modifiers + Schedule Strength + Game Control`

1. **Base** — FBS wins only (FCS wins = 0). Tiered loss penalties by opponent win% and location (−0.5 / −1.0 / −2.0 / −3.0 FCS).
2. **Difficulty** — +0.5 per true road win; +1.0 per quality win (opp win% > .500).
3. **SOS** — `OW% + 0.5 × OOW%`.
4. **Game control** — average point differential / 100, capped at +0.17.

## Deploy (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lafebenn/cfb-pure-merit&env=CFBD_API_KEY&envDescription=Free%20API%20key%20from%20collegefootballdata.com/key&project-name=cfb-pure-merit)

1. Click **Deploy with Vercel** (or import `lafebenn/cfb-pure-merit` in the Vercel dashboard).
2. When prompted, paste your free `CFBD_API_KEY` from [collegefootballdata.com/key](https://collegefootballdata.com/key).
3. Deploy. Fetch responses revalidate about every 12 hours.

CLI (after `npx vercel login`):

```bash
npx vercel --prod
npx vercel env add CFBD_API_KEY
```

## Future: ML playoff projections

Out of scope for v1. Planned later:

- Predict weekly W/L and season outcomes
- Playoff qualification odds
- Counterfactuals: how odds shift given a win or loss in a given week

## Disclaimer

Unofficial fan rankings. Not affiliated with the College Football Playoff, NCAA, or CFBD beyond use of their public API.
