# App Hub — Alec Mazo

Formal interactive dashboard for every application under [alecmazo](https://github.com/alecmazo).

**Live URL (after Pages is enabled once):** https://alecmazo.github.io/app-hub/

## Enable GitHub Pages (one-time)

This repo already has a `gh-pages` branch with the built site and an Actions workflow.

1. Open [Repo Settings → Pages](https://github.com/alecmazo/app-hub/settings/pages)
2. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `gh-pages` / `/ (root)`  
     *or* Source: **GitHub Actions** (uses `.github/workflows/deploy-pages.yml`)
3. Save. After a minute the hub is at **https://alecmazo.github.io/app-hub/**

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
| Hub UI itself | Push to `main` → rebuild SPA → update `gh-pages` (or Actions) |

Launching an app always hits its **deployed** URL (Pages / Vercel / portfolio), so you run the latest shipped build of that application.

## Apps currently wired

| App | Launch |
| --- | --- |
| **Turf Pad Builder** | https://alecmazo.github.io/turf-pad-builder/ |
| **DGA Capital Research** | https://portfolio.dgacapital.com |
| **DGA Capital Backend** | https://dga-backend.vercel.app |
| **Soccer Analyzer** | Local / private — open source on GitHub when available |

## Develop

```bash
npm install
npm run dev          # 0.0.0.0:8080
npm run build:spa    # static site → dist-spa/
npm run build        # production / Vercel SSR build
```

### Redeploy static Pages from a machine with git

```bash
npm run build:spa
# publish dist-spa/ contents to the gh-pages branch
```

## Catalog

Edit [`src/lib/catalog.ts`](src/lib/catalog.ts) to set titles, launch URLs, tags, and surfaces for known apps. Live GitHub fields overlay the catalog on each sync.

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · TanStack Start · GitHub REST API
