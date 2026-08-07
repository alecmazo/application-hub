# Application Hub — Alec Mazo

Formal interactive dashboard for every application under [alecmazo](https://github.com/alecmazo).

**Live:** https://alecmazo.github.io/application-hub/

## What it does

- Lists all of your apps in one place (curated catalog + any new public repos discovered from GitHub)
- **Launch** opens the live deploy (Turf Pad Builder on Pages, DGA portfolio, etc.)
- **Details** panel shows language, last push, visibility, tags, and **recent commits** from the GitHub API
- **Sync GitHub** + automatic refresh every 5 minutes so metadata tracks the latest code activity without redeploying the hub
- New public repositories appear automatically on the next sync

## Live updates explained

| What changes | How the hub stays current |
| --- | --- |
| Repo description, last push, language | Live GitHub REST API on every load / sync |
| Recent commits | Fetched when you select an app |
| New public repo under `alecmazo` | Appears on next sync (no hub code change) |
| Launch URL of an app you ship | Curated in `src/lib/catalog.ts` (or inferred from GitHub Pages / homepage) |
| Hub UI itself | Push to `main` → rebuild SPA → update `gh-pages` |

Launching an app always hits its **deployed** URL (Pages / Vercel / portfolio), so you run the latest shipped build of that application.

## Apps currently wired

| App | Launch |
| --- | --- |
| **Stem Spark** | https://alecmazo.github.io/stem-spark/ |
| **Turf Pad Builder** | https://alecmazo.github.io/turf-pad-builder/ |
| **Soccer Capture** | https://alecmazo.github.io/soccer-capture/ |
| **DGA Capital Research** | https://portfolio.dgacapital.com |
| **DGA Capital Backend** | https://dga-backend.vercel.app |
| **Soccer Analyzer** | Local / private — ingest `raw/` L/R from Soccer Capture |

## Develop

```bash
npm install
npm run dev          # 0.0.0.0:8080
npm run build:spa    # static site → dist-spa/  (base: /application-hub/)
npm run build        # production / Vercel SSR build
```

### Redeploy static Pages

```bash
npm run build:spa
# publish dist-spa/ contents to the gh-pages branch
```

## Catalog

Edit [`src/lib/catalog.ts`](src/lib/catalog.ts) to set titles, launch URLs, tags, and surfaces for known apps. Live GitHub fields overlay the catalog on each sync.

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · TanStack Start · GitHub REST API
