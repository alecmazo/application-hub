# Soccer Rankings methodology

Unofficial composite for personal scouting. **Not affiliated with MLS, MLS NEXT, ECNL, GotSport, or TopDrawerSoccer.**

## Age tabs (U12–U16)

Primary control is **U12, U13, U14, U15, U16** (boys). Default **U13**.

Two parallel systems this season. Legend in the UI:

> MLS NEXT = birth year · ECNL / US Club-style = school year where applicable.

| Tab | MLS NEXT (birth year) | ECNL / US Club / many GotSport (school year) |
| --- | --- | --- |
| **U12** | 2015 BY (no official Homegrown U12 — tab is GotSport / school-year) | ≈ 2014/15 |
| **U13** | **2014 BY** (e.g. SF Glens MLS NEXT 2014) | ≈ **2013/14** (e.g. Marin FC ECNL B2013/14) |
| **U14** | 2013 BY | ≈ 2012/13 |
| **U15** | 2012 BY | ≈ 2011/12 |
| **U16** | 2011 BY | ≈ 2010/11 |

MLS NEXT sides are **never** forced onto school-year labels. A 2014 MLS NEXT listing is U13 even if GotSport parked it on a U12 table.

### Official MLS NEXT Homegrown PDFs (verified)

| Document | U13 cutoff | U14 | U15 | U16 |
| --- | --- | --- | --- | --- |
| [2025–26 Homegrown Rules](https://images.mlssoccer.com/image/upload/v1754861547/assets/mls-next-resources/MLS_NEXT_HD_Rules_and_Regulations_2025-26_final_v2_-1_tjwk8c.pdf) | Born on/after **1 Jan 2013** | 2012 | 2011 | 2010 |
| [2026–27 Homegrown Rules](https://images.mlssoccer.com/image/upload/v1783990779/assets/MLS_NEXT_HD_Rules_and_Regulations_2026-27_Final_Web_Version_hwmkha.pdf) | Born on/after **1 Jan 2014** | 2013 | 2012 | 2011 |

The app uses the **2026–27 / Alec** map (U13 = 2014 BY) so current Homegrown U13 and SF Glens 2014 sit on the U13 tab. Homegrown has **no U12**.

GotSport published ranking date: **see `teams.json` `asOf`**. Seed compiled (America/Los_Angeles): **see `compiledAt`**.

## Coverage (not a census)

Alec’s vintage figure: California alone has **≈1,100+** boys teams around this age. The seed pulls the public GotSport ranking directory (CAS/CAN first, then other associations) for boys **U12–U16**, plus the public MLS NEXT League 26/27 overlay.

**US rank** and **state rank** are among seeded teams on that age tab only.

Refresh path:

- Rankings: `python3 scripts/ingest-soccer-rankings.py` → `teams.json`. Cache: `/tmp/gotsport-rankings-cache`. `--from-cache` rebuilds without the network.
- MLS NEXT: `python3 scripts/ingest-mls-next.py` → `mls-next-public.json`.
- Matches: `python3 scripts/ingest-gotsport-matches.py` → `matches.json`.
- If a reported result is still missing after public endpoints, `matches-meta.json` `notOnPublicFeed` is `not_yet_on_gotsport_public_feed` and the score is **not invented**.

## MLS NEXT records + SOS

Public endpoints used (same JSON as the official standings viewer linked from [mlssoccer.com/mlsnext/standings](https://www.mlssoccer.com/mlsnext/standings/homegrown_division/)):

| File | URL |
| --- | --- |
| Standings | `https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-league-26-27.json` |
| Schedule / scores | `https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-league-26-27.json` |

Only **completed** games with both scores are kept. As of this refresh, SF Glens U13 is **0–1–0** (3–3 at Woodside, 2026-09-12) and Northwest conference **#10 / 13**. No invented W–D–L.

SOS for overlay MLS NEXT sides uses opponent **conference rank** from that public table (same spirit as GotSport opponent US/state ranks). GotSport match SOS still applies to GotSport-listed clubs.

## Sources

| Signal | Use |
| --- | --- |
| GotSport public rankings API, boys U12–U16, USA | Name, club, association→state, points, W–D–L when published |
| MLS NEXT League 26/27 public standings + schedule | Conference rank, completed W–D–L, scored matches |
| MLS NEXT Cup 2026 U13 recaps | Overlay on 2014-BY / U13 MLS NEXT sides (Atlanta champion; LA Galaxy finalist; Inter Miami semifinalist) |
| TopDrawerSoccer TeamRank boys U13 (TDS labeled **2013** BY) | Overlay on matching clubs; stub if missing |
| UpNext February 2026 | Secondary U13 power-rank overlay |

Records are never invented. Unknown W–D–L stays N/A.

## Age assignment (ingest)

**MLS NEXT / Homegrown**

1. Birth year in the name → that BY’s tab (2014 → U13, 2013 → U14, …)
2. Else GotSport listing age → Homegrown BY for that Un (U13 listing → 2014 BY)
3. Alignment chip is always `MLS NEXT Un = YYYY BY`, never school-year

**ECNL / US Club / other GotSport**

1. School-year mix in the name (2013/14, 2014/15, …) → that mix’s tab + school-year chip
2. Else GotSport age 12–16 → that Un tab
3. ECNL U13 2013/14 → **U13** with `ECNL U13 = 2013/14 school year`

## Composite score

Missing signals are dropped; remaining weights renormalize.

1. TDS TeamRank (0.42) when present
2. MLS NEXT Cup / UpNext / conference rank (0.28)
3. GotSport points (0.20) scaled to the max in that age tab
4. League-tier prior (0.10): Homegrown 72, MLS NEXT 70, ECNL 68, ECNL-RL 55, other 42

`usRank` = sort descending within the age-tab **seed**.  
`stateRank` = same sort within `state` + age tab **seed**.

## Home team + SOS

Highlighted side (badge only, not a locked landing): **Marin FC 2013/14 ECNL** (GotSport `56506`). Pin any team; unpin clears home. Persisted as `soccer-rankings-home-team-id`. Continuity (Blue 2014 only) only while Marin 2013/14 ECNL is pinned.

**Not Home / not continuity:** Marin FC Blue 2014/15 (`252973`), Red (`260095`), Steel (`367188`). Tokens **2015**, **B2015**, **B15**, **/15**, **2014/15** stay off the continuity path.

Sep 13 Marin 1–0 El Camino Salinas remains `not_yet_on_gotsport_public_feed` — not invented.
