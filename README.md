# App Hub — Alec Mazo

Formal interactive dashboard for every application under [alecmazo](https://github.com/alecmazo).

**Live (after GitHub Pages is enabled):** https://alecmazo.github.io/app-hub/

## What it does

- Lists all of your apps in one place (curated catalog + any new public repos discovered from GitHub)
- **Launch** opens the live deploy (e.g. Turf Pad Builder on GitHub Pages, DGA portfolio)
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
| Hub UI itself | Push to `main` → GitHub Actions → Pages |

Launching an app always hits its **deployed** URL (Pages / Vercel / portfolio), so you run the latest shipped build of that application.

## Develop

```bash
npm install
npm run dev          # 0.0.0.0:8080
npm run build:spa    # static site → dist-spa/  (GitHub Pages)
npm run build        # production / Vercel SSR build
```

## Publish to GitHub Pages

1. Create a public repo named `app-hub` under `alecmazo` (or push this project there).
2. Settings → Pages → Source: **GitHub Actions**.
3. Push `main`. The workflow `.github/workflows/deploy-pages.yml` builds the SPA and deploys.
4. Open https://alecmazo.github.io/app-hub/

SPA `base` is `/app-hub/` in `vite.config.spa.ts` — change it if the repo name differs.

## Catalog

Edit [`src/lib/catalog.ts`](src/lib/catalog.ts) to set titles, launch URLs, tags, and surfaces for known apps. Live GitHub fields overlay the catalog on each sync.

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · TanStack Start · GitHub REST API
