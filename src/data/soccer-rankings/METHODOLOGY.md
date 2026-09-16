# Soccer Rankings methodology

Unofficial composite for personal scouting. **Not affiliated with MLS, MLS NEXT, ECNL, GotSport, or TopDrawerSoccer.**

## Age-band truth (2025–26) — lock this

| Platform | What “U13” means this season |
| --- | --- |
| **MLS NEXT U13 boys** | **2014 birth-year** category |
| **ECNL U13** | **2013/14 school-year** alignment (not a pure single birth-year slice) |
| **GotSport U13 / U12 tables** | Mixed vintages. Names may say 2013, 2014, 2013/14, 2014/15, or omit a year |

The app’s primary tabs are still **2013-born** and **2014-born**. A row can appear on both tabs when the public listing is a 2013/14 school-year or ECNL U13 side. Each row chips the alignment so “U13” is not treated as one national definition.

Compiled as-of: **2026-09-15**

## Coverage (not a census)

Alec’s vintage figure: California alone has **≈1,100+** boys teams of this age. The seed pulls the **full public GotSport ranking directory** for Cal South (`CAS`) and Cal North (`CAN`) U12 + U13 boys, then other state associations, plus a few published national overlays (TDS 2013 / MLS NEXT Cup 2014). That directory is larger than 1,100 because clubs list multiple sides and U12 2014/15 rows sit next to U13.

**US rank** and **state rank** are among seeded teams only — “CA #N among ranked/seeded CA teams,” not among every club that exists. Clubs that never appear on GotSport rankings are still missing.

Refresh path:

- Rankings: `python3 scripts/ingest-soccer-rankings.py` (public JSON the [GotSport rankings](https://rankings.gotsport.com/) UI calls: `https://system.gotsport.com/api/v1/team_ranking_data`). Cache: `/tmp/gotsport-rankings-cache`. `--from-cache` rebuilds without the network.
- **Match histories:** `python3 scripts/ingest-gotsport-matches.py` → `src/data/soccer-rankings/matches.json`. Endpoint: `GET https://system.gotsport.com/api/v1/teams/{team_id}/matches`. Cache: `/tmp/gotsport-matches-cache`. Prefer games on/after 2024-07-01. Then `npm run typecheck` and `npm run build:spa`.

The rankings table W–D–L is an **aggregate** from `team_ranking_data`. Full game lists (league + tournaments) come from the per-team matches API. GitHub Pages cannot call GotSport from the browser (no CORS); the shipped `matches.json` is the cache. Local `vite` / `preview:spa` proxy `/gotsport-api` → `system.gotsport.com` for live lists. Scores are never invented.

## Sources

| Signal | Use |
| --- | --- |
| GotSport public rankings API, boys U12 + U13, USA, by state association | Team name, club, association→state, national points, W–D–L when `total_matches` &gt; 0 |
| MLS NEXT Cup 2026 U13 recaps | Applied to the **2014** view (Atlanta United champion; LA Galaxy finalist; Inter Miami semifinalist). If GotSport has no matching U13 row, a stub is added with N/A record — not an invented W–D–L |
| TopDrawerSoccer TeamRank boys U13 (TDS labeled this the **2013** birth year) | Overlay on matching 2013-view clubs; stub if the club is missing from the ingest |
| UpNext February 2026 | Secondary U13 power-rank overlay on 2014 MLS NEXT sides |

Records are never invented. Unknown W–D–L stays N/A.

## Birth-year assignment (ingest)

1. Explicit 2013 / B13 / 2013/14 in the public name → 2013 (and 2014 if mixed 2013/14)
2. Explicit 2014 / B14 / 2014/15 → 2014
3. MLS NEXT (or Homegrown) + GotSport age 13 → **2014 BY**
4. ECNL + GotSport age 13 → **both 2013 and 2014** (school-year)
5. Unspecified U13 → both years, labeled “birth year not published”
6. Unspecified U12 (not 2015-only) → 2014
7. Clear 2015-only or 2012-only names are dropped

## Composite score

Missing signals are dropped; remaining weights renormalize.

1. TDS TeamRank (0.42) when present — 2013 view
2. MLS NEXT Cup / UpNext (0.28) — 2014 view for U13
3. GotSport points (0.20) scaled to the max in that birth-year view
4. League-tier prior (0.10): Homegrown 72, MLS NEXT 70, ECNL 68, ECNL-RL 55, other 42

`usRank` = sort descending within the birth-year **seed**.  
`stateRank` = same sort within `state` + birth year **seed**.
