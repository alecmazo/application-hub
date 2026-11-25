# MarinFC-reports

Static reports for Marin FC B2013-14 Blue, served at `/MarinFC-reports/` (live: `https://alecmazo.github.io/application-hub/MarinFC-reports/`).

`index.html` is the hub: three columns on a wide screen — Game Reports, Trends, and Player Cards — and three tabs on a narrow screen. Game reports are listed newest first with opponent, date, and score. The Player Cards column uses game-menu tiles (club crest, a fan of top cards, and a PLAY button), in this order: Latest game, Last 5 games, Full season. Do not add a link to this section from the public application-hub home page.

Each report page is standalone HTML. It links back only to this hub (`../`) and has a Print / Save PDF button that calls `window.print()`. Game reports and earlier analysis pages have a low-emphasis Delete button on the hub card and on the report bar (year-to-date pages — Season Trend, all three Player Cards pages, and Pro-Style Analytics — do not). Delete asks for confirmation (“Delete this report permanently?”) and a passcode, then removes that report page and its hub entry. It does not open GitHub. The passcode is remembered in the browser after the first success, and the hub hides the card immediately; the live site updates in about two minutes. The written page is removed; season stats used for trends and cards are left unchanged unless Alec asks to drop the game from the season file. The hub also has a prominent New game report from Veo button (above the three columns, hidden in print). It prompts for an optional opponent, date, or Veo match link, asks for confirmation, then opens a prefilled issue with label `generate-report` and assignee `alecmazo`. That request means: pull the Veo match report, build the game report, update Season Trend, latest-game Player Cards, last-5 Player Cards, full-season Player Cards and Pro-Style Analytics, and open a PR. Nothing is published until the PR is approved. Print CSS hides that chrome and the in-page contents nav, keeps chart and row breaks from splitting awkwardly, uses Letter paper, and sets `print-color-adjust: exact`. Every report and the hub include:

```html
<meta name="robots" content="noindex,nofollow">
```

Do not add this path to a sitemap.

Files live in `public/MarinFC-reports/` so the GitHub Pages build copies them as-is. Do not add this path to the SPA deep-route copy in `vite.config.spa.ts` — that would replace the hub with the app.

## Add a report

1. Pick a folder name: a readable slug, a hyphen, then a random suffix of at least 8 characters.

   ```bash
   openssl rand -hex 6
   ```

   Example: `passing-and-control-91f2292b8b5f`.

2. Create `public/MarinFC-reports/<folder>/index.html`. Keep the page self-contained. It must include the robots meta, a Print / Save PDF button, and a relative "All reports" link to this hub (`../`). In-page anchors (`#section`) are fine. Do not link to the public application-hub home page.

3. Append one object to the `reports` array in `reports.json`:

   ```json
   {
     "slug": "readable-name-0123456789ab",
     "title": "Report title",
     "date": "2026-11-10",
     "description": "One or two sentences shown on the card."
   }
   ```

   `slug` must match the folder name. `date` is `YYYY-MM-DD`.

4. If it is a per-game report, also add the game id and live slug to `GAME_SLUGS` in the local generator (`/workspace/veo/share/season_reports.py`) so the hub lists opponent, date, and score. If it is a trend/analysis page, add it to `TREND_REPORTS`. If it is a Player Cards page, add it to `CARD_REPORTS`. Then regenerate the hub.

5. Do not add the report, or this section, to a sitemap.

Push to `main`. The Pages workflow publishes `public/` with the rest of the site.

## Season trend report (stable slug)

`season-trend-ab0e5977a9e9` is the year-to-date season trend report. Keep that folder name. After every future game, overwrite `public/MarinFC-reports/season-trend-ab0e5977a9e9/index.html` in place (keep the Print / Save PDF chrome) and update that entry's `date` in `reports.json` (and the description if the summary changes). The live URL stays `https://alecmazo.github.io/application-hub/MarinFC-reports/season-trend-ab0e5977a9e9/`. Per-game reports still get a new folder each time.

## Player cards and pro-style analytics (stable slugs)

- `player-cards-latest-d2130e467695`: Player Cards (Latest Game). The same game-style squad screen, computed from only the most recent game (currently Davis, Nov 15). The HUD shows the opponent, date and score. PAC uses that game's top speed, not a season-best. A card with an overall requires at least 20 approximate Veo minutes in that game; players under that threshold are listed under Limited minutes, without an overall. When a new game is added, this page moves to that game. The slug stays the same.
- `player-cards-4333cd65c796`: Player Cards (Last 5 Games). A game-style squad screen (dark arena, HUD with the club crest, sort/filter chips). Every rostered player with Veo data in the most recent 5 games gets an FC-style metallic shield card with an overall and six face stats (PAC, SHO, PAS, DRI, DEF, PHY). Print / Save PDF uses a light background. Each stat is `40 + 50 × squad percentile` of per-70 Veo inputs, and the pool is outfield players with at least 60 capped minutes in that window. The overall is a role-weighted average of the face stats. Each card has a priority note naming the Veo input that would raise overall the most if it reached the squad top quartile. The full formula is printed on the page. Goalkeepers have no overall when Veo has no save data in the window.
- `player-cards-season-cc2378ad382d`: Player Cards (Full Season). The same game-style squad screen, card design, formulas and priority notes, computed over every season game that has a Veo player table. Rates use only the minutes from games that recorded each column (Eastside has no passing, dribbles, interceptions, duels, loose-ball recoveries or saves). PAC's average-speed input is minutes-weighted across every game that recorded Average speed. The three card pages cross-link with Latest game / Last 5 games / Full season toggles.
- `pro-analytics-6feface8946d`: Pro-Style Analytics (YTD). Team metrics, opponent profiles, rule-based shape options, a per-70 player table with weighted turnovers v1 and v2, role fit, and a Methodology section. The Methodology section lists which pro metrics (xT, PPDA, field tilt, progressive passes, line breaks and so on) are implemented, approximated or out of reach with Veo data, and it carries the passing weights and their sources.

These pages are generated by `/workspace/veo/share/pro_metrics.py`. `season_reports.py` always calls `build_ytd_pages()`, so adding a new game and running the generator rebuilds Season Trend, latest-game Player Cards, last-5 Player Cards, full-season Player Cards and Pro-Style Analytics together. Season Trend and Pro-Style Analytics use every game that has each field. Latest-game Player Cards use only the most recent game; last-5 Player Cards use a rolling window of the most recent 5 games; full-season Player Cards use every season game that has player stats. Overwrite the live folders in place and keep the slugs.

## Club crest

`assets/marinfc-logo.png` is the official Marin FC crest, copied from the club website (marinfc.org, file Marin-FC-Crest-18.png) and stored locally. Report pages reference it with a relative path and do not hotlink the club site. See `assets/SOURCE.txt`.

