# Soccer Rankings methodology

Unofficial composite for personal scouting. **Not affiliated with MLS, MLS NEXT, ECNL, GotSport, or TopDrawerSoccer.**

## Season and ages

- Season window: **2025–26** US boys club year
- **2013-born** → U13
- **2014-born** → U12 / U13 (many 2014 sides play up or appear on U13 GotSport tables)

Compiled as-of: **2026-09-15**

## Sources (public pages only)

| Signal | What we stored | Typical URL |
| --- | --- | --- |
| TopDrawerSoccer TeamRank boys U13 | Latest published national table (June 2026 update) plus in-season appearances | https://www.topdrawersoccer.com/club-soccer/club-soccer-team-rankings/men/u13/1/1832 |
| MLS NEXT Cup / academy notes | 2026 U13 champion Atlanta United; finalist LA Galaxy; semifinalist Inter Miami; other Championship-bracket sides named in club recaps | https://www.mlssoccer.com/mlsnext/ |
| UpNext (secondary) | February 2026 U13 power-rank positions and the few published W–D–L snapshots | https://upnextanalytics.app/around-the-league/mls-next-february-2026-power-rankings-deep-dive |
| GotSport national tables | Rank, points, and W–D–L **only when shown** on public ranking pages | https://rankings.gotsport.com/ |
| ECNL public notes | U13 national final (XF Academy / Crossfire over SDSC Surf, July 2026) and club listings | https://theecnl.com/ |

TDS does **not** publish a U12 / 2014 TeamRank for 2025–26. 2014 ranks lean on GotSport points plus league-tier priors and public MLS NEXT / ECNL club listings. League-only rows have **no invented records**.

## Composite score

Missing signals are dropped and the remaining weights are renormalized.

1. **TDS TeamRank** (weight 0.42 when present) — rank 1 = 100, fading by 2 points per place
2. **MLS NEXT Cup / UpNext** (0.28) — champion 100, finalist 93, semifinal 86, quarterfinal 80, Championship bracket 74; blended with UpNext list position when both exist
3. **GotSport points** (0.20) — scaled to the max points in that birth-year seed
4. **League tier** (0.10) — MLS NEXT Homegrown 92, MLS NEXT 90, ECNL 88, ECNL-RL 72, other 58

`usRank` = sort composite descending within the birth year.  
`stateRank` = same sort within `state` + birth year.

Tie-break: GotSport points, then TDS rank, then name.

## How to refresh the JSON

1. Edit `src/data/soccer-rankings/boys-2013.json` and `boys-2014.json`.
2. Keep real club names, two-letter `state`, and `sources[]`. Omit `record` / `gotsport.points` / `tdsRank` when the public page does not show them.
3. Bump `asOf` (ISO date) on the file and on any changed raw fields.
4. Update `COMPILED_AS_OF` in `src/lib/soccer-rankings/compute.ts` if the compile date changes.
5. Run `npm run typecheck` and `npm run build:spa`.
6. Merge to `main` — GitHub Actions publishes Pages. Deep route: `/soccer-rankings`.
