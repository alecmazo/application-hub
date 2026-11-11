# MarinFC-reports

Static dashboard of Marin FC coaching reports. It is served with the app hub at `/MarinFC-reports/` (live: `https://alecmazo.github.io/application-hub/MarinFC-reports/`).

`index.html` reads `reports.json` and renders one card per report. Report pages are standalone: they do not link to this dashboard, the hub, or each other.

Files live in `public/MarinFC-reports/` so the GitHub Pages build copies them as-is. Do not add this path to the SPA deep-route copy in `vite.config.spa.ts` — that would replace the dashboard with the hub app.

## Add a report

1. Pick a folder name: a readable slug, a hyphen, then a random suffix of at least 8 characters.

   ```bash
   openssl rand -hex 6
   ```

   Example: `passing-and-control-91f2292b8b5f`.

2. Create `public/MarinFC-reports/<folder>/index.html`. Keep the page self-contained. It must include:

   ```html
   <meta name="robots" content="noindex,nofollow">
   ```

   Do not add a link, button, or script that goes to the dashboard, the hub, another report, or any parent path (`../`). In-page anchors (`#section`) are fine.

3. Append one object to the `reports` array in `reports.json`:

   ```json
   {
     "slug": "readable-name-0123456789ab",
     "title": "Report title",
     "date": "2026-11-10",
     "description": "One or two sentences shown on the card."
   }
   ```

   `slug` must match the folder name. `date` is `YYYY-MM-DD`. The dashboard lists newer dates first.

4. Do not add the report, or this section, to a sitemap.

Push to `main`. The Pages workflow publishes `public/` with the rest of the site.
