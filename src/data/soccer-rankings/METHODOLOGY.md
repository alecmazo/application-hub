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

## Pathway tiers (visible on list + detail)

Alec’s MLS NEXT rule (do not collapse these into one anonymous “MLS NEXT” bucket):

- **Allstate Homegrown Division = Tier 1** (premier)
- **Academy Division = Tier 2** (second tier)

ECNL is a separate pathway. Do not mix those tiers with MLS NEXT.

| Pathway | Tier 1 (premier) | Tier 2 |
| --- | --- | --- |
| MLS NEXT | Homegrown / Allstate Homegrown Division | Academy Division |
| ECNL | ECNL | ECNL Regional League (ECNL-RL) |

UI: list rows (including dense / split / mobile) show `Homegrown · T1`, `Academy · T2`, `ECNL · T1`, or `ECNL-RL · T2`. Team detail uses the long labels (`MLS NEXT Homegrown · Tier 1`, `ECNL · Tier 1`, …). Platform filter keeps those four as separate options. Ranking / SOS still treats Homegrown and Academy as MLS NEXT pathway clubs (priors 72 / 70) and ECNL / ECNL-RL as their own pathway (68 / 55).

Default **layout** is **Matchday Cards** (view B). Split Command stays on the Layout control as an alternate — it is not the default.

### California-only league tables (CA Tables)

The composite ranking list is **not** a conference table. Official standings live in `mls-next-public.json` and `ecnl-public.json`, then a live **Refresh** overlays those files in memory. The app **must** read those files (and the overlay) for CA Tables (and to hydrate GF–GA / conference W–D–L onto matching ranked sides). Leaving them unused is how a live SPA can look like it “ignored” the PR #8 ingest.

In-browser **Refresh** (CA Tables and Matchday Cards) re-fetches:

- MLS NEXT League Viewer standings + schedule JSON (Homegrown + Academy). W–D–L / GF–GA stay **completed schedule games only**.
- ECNL AthleteOne `get-conference-standings` for California conferences, with Referer/Origin `https://theecnl.com` via the Vite `/athleteone-api` proxy (bare curl is 403). HTML is W–L–D; the app stores W–D–L.

Live rows replace matching shipped rows. If a feed is blocked, the shipped cache stays. Nothing is invented.

**CA Tables** view (age tabs + pathway + conference):

| Pathway | Tier 1 | Tier 2 | CA-relevant conferences |
| --- | --- | --- | --- |
| MLS NEXT | Homegrown | Academy | Homegrown: Northwest, Southwest, West (Pro Player Pathway). Academy: Northern California Coast, Northern California Redwood, Southern California. Pacific Northwest (WA/OR) is **not** a CA table. |
| ECNL | ECNL | ECNL-RL | ECNL: **Northern Cal** (priority), Far West, Southwest. ECNL-RL: NorCal, Golden State, Southern Cal, Far West, Southwest. |

Columns: **Pos, Team, GP, W, D, L, GF, GA, GD, Pts** (+ PPG).

- **Pos** (display) is **recomputed**: **Pts descending, then GD descending**, then GF descending, then name. Pts = 3×W + D. GD = GF − GA. Source conference place is stored as `sourcePos` but is **not** used for order if it disagrees with Pts→GD.
- Clicking a CA table side expands that row (and the Cards right panel) into **that conference’s games only** — opponents and W/D/L, scores only when AthleteOne box score or MLS NEXT League Viewer published both. ECNL uses `get-club-schedules-by-eventID-and-clubID` (get-team-schedule is 401). Nothing invented.
- **Pts** = **3×W + D** (standard). AthleteOne also publishes PPG = Pts/GP; the snapshot Marin U13 line is 4 pts / 3 GP = 1.33 PPG.
- **W–D–L** is the app order. AthleteOne HTML is **W–L–D**; ingest converts (Marin BU14 2-1-0 → 2-0-1).
- MLS NEXT W–D–L / GF–GA are **completed League Viewer schedule games only**. Unplayed sides stay 0 GP — not invented.
- Marin FC (not Blue 2014/15) is highlighted. Home listing remains Marin FC 2013/14 ECNL (`gs-56506`).
- Age U12 has no Homegrown / ECNL CA table in this app (tabs still exist for GotSport rankings).

AthleteOne rows that do not match a GotSport listing stay **off the composite ranking** (no ghost stubs) but **do appear** on the official CA table. Example: San Francisco Elite Academy ECNL B2013/14 is Northern Cal #2 on the ECNL table even when GotSport has no matching ECNL U13 listing.

Taught ECNL viewer (school-year, not MLS NEXT): [theecnl.com](https://theecnl.com) → LEAGUES → Boys → ECNL Standings → conference (e.g. Northern Cal). Ingest uses the AthleteOne standings API behind that page. ECNL U13 ≈ 2013/14 school year; it is **not** Homegrown 2014 BY.

## Coverage (not a census)

Alec’s vintage figure: California alone has **≈1,100+** boys teams around this age. The seed pulls the public GotSport ranking directory (CAS/CAN first, then other associations) for boys **U12–U16**, plus the public MLS NEXT League 26/27 overlay. Official CA conference tables are a separate view sourced from those overlay JSON files, not from GotSport points.

**US rank** and **state rank** are among seeded teams on that age tab only.

Refresh path (California first, boys only):

- Rankings: `python3 scripts/ingest-soccer-rankings.py` → `teams.json`. Cache: `/tmp/gotsport-rankings-cache`. `--from-cache` rebuilds without the network. `--reoverlay` reapplies MLS NEXT / ECNL / TDS overlays on the current seed. `--ca-refresh` refetches Cal South + Cal North live and keeps other states.
- MLS NEXT: `python3 scripts/ingest-mls-next.py` → `mls-next-public.json` (Homegrown **and** Academy) from the League Viewer JSON. `--from-snapshot` seeds CA-filtered rows from `uploads/ca-boys-api-snapshot` if live fails or a CA club is missing.
- ECNL: `python3 scripts/ingest-ecnl-athleteone.py` → `ecnl-public.json` (ECNL Tier 1 + ECNL-RL Tier 2 conference tables). `--from-snapshot` seeds CA ECNL rows from the same dump; live AthleteOne still runs and wins on overlap.
- Matches: `python3 scripts/ingest-gotsport-matches.py` → `matches.json` (all CA ECNL / RL / MLS NEXT sides + every Marin FC boys listing).
- Verify: `python3 scripts/verify-ca-boys-snapshot.py` checks Marin + Northern Cal + U13 NW Homegrown against `fixtures/ca-boys-snapshot-expected.json` (and the extracted dump when present).
- If a reported result is still missing after public endpoints, `matches-meta.json` `notOnPublicFeed` is `not_yet_on_gotsport_public_feed` and the score is **not invented**.

The 2026-09-17 CA boys API snapshot (`ca-boys-api-snapshot-lean.tgz`, extract under `uploads/`) is a seed/verify dump only. Its GotSport `team_ranking_data` response was **20 mixed-gender rows / 0 CA boys** — ranked CA teams stay on the live GotSport ingest. Do not invent scores from that file.

### CA three-source refresh

| Source | What it updates | CA scope |
| --- | --- | --- |
| GotSport rankings + `/teams/{id}/matches` | Name, points, all-competition W–D–L, recent results | CAS + CAN boys U12–U16; Marin FC every boys side |
| MLS NEXT League Viewer JSON | Homegrown (Tier 1) + Academy (Tier 2) conference rank, completed league W–D–L / GF–GA, scored matches | All CA Homegrown / Academy clubs on those tables |
| ECNL AthleteOne `get-conference-standings/{eventId}/{orgId}/{seasonId}/{divisionId}/{standingId}` | ECNL (org 12, season 81, Tier 1) + ECNL-RL (season 83, Tier 2) conference POS / GP / W / L / D / GF / GA | Root `0/12/81/0/0` lists every boys conference (Northern Cal eventId=4283, Far West=4273 … Texas=4288). `standingId=0`. National division IDs BU13=22184 … BU18/19=22189. On a conference event those national IDs still serve the BU13 table — ingest uses that event’s `#division-select` (NorCal 22383–22388) and rejects a mismatched `<h3>`. App tabs merge U13–U16 only. |

Taught UI: [theecnl.com ECNL Boys standings](https://theecnl.com/sports/2023/8/8/ECNLB_0808235537.aspx) (LEAGUES → Boys → ECNL Standings → Select Conference). That Sidearm page sets `data-org-id="12"` and `data-org-season-id="81"` and loads `https://public.totalglobalsports.com/standings.min.js`, which calls AthleteOne. ECNL-RL uses season **83**. Referer+Origin `https://theecnl.com` (bare curl is 403). If AthleteOne fails, ingest re-reads those `data-org-*` attributes from the taught page and retries the API — it does **not** invent a table from the empty Sidearm shell. Northern Cal is ingested first; every other boys conference still follows. Conference events use their own `#division-select` IDs (Northern Cal BU13=22383 … BU18/19=22388). National IDs 22184–22189 on a conference event still serve the BU13 table and are rejected when the `<h3>` age does not match.

AthleteOne HTML columns are **GP, WINS, LOSSES, DRAWS** (W–L–D). The app stores **W–D–L**. Marin FC ECNL Northern Cal (live `…/4283/12/81/{div}/0`, heading age-checked):

| Age | AthleteOne W–L–D | App W–D–L | GP | GF–GA |
| --- | --- | --- | --- | --- |
| BU13 B2013/14 | 1-1-1 | 1-1-1 | 3 | 5–5 |
| BU14 B2012/13 | 2-1-0 | 2-0-1 | 3 | 7–4 |
| BU15 B2011/12 | 2-1-0 | 2-0-1 | 3 | 4–2 |
| BU16 B2010/11 | 0-2-1 | 0-1-2 | 3 | 6–11 |
| BU17 B2009/10 | 0-1-2 | 0-2-1 | 3 | 4–7 |
| BU18/19 B2008/09 | 1-2-0 | 1-0-2 | 3 | 3–4 |

AthleteOne **schedule / results** Script routes (`get-team-schedule`, `loadIndividualTeamPage`) return **401**. `get-individual-team-info` is public but the embedded RESULTS table is empty. ECNL game-by-game history therefore stays on GotSport when that API has it. Published ECNL / RL conference W–D–L is preferred over GotSport all-competition records on official ECNL sides. AthleteOne rows that do not match a GotSport / overlay listing at that age and tier stay off the table — no ghost stubs. No scores invented.

Marin FC home listing remains `gs-56506` (2013/14 ECNL). Blue / Red / Steel **2014/15** stay in the seed with their own records and are never home continuity.

## MLS NEXT records + SOS

Public **League Viewer JSON** (same files the official standings viewer loads). Prefer these APIs over HTML scrape. Ingest: `python3 scripts/ingest-mls-next.py`. Team **Refresh** hits the schedule JSON via `/mls-next-api` (dev/preview) or the host / CORS proxies (GitHub Pages).

| Division | Standings | Schedule | Official UI (fallback discovery only) |
| --- | --- | --- | --- |
| Homegrown | [mls-next-league-26-27.json](https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-league-26-27.json) | [schedule/mls-next-league-26-27.json](https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-league-26-27.json) | [mlssoccer.com/mlsnext/standings/homegrown_division/](https://www.mlssoccer.com/mlsnext/standings/homegrown_division/) |
| Academy | [mls-next-2-academy-division-26-27.json](https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-2-academy-division-26-27.json) | [schedule/mls-next-2-academy-division-26-27.json](https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-2-academy-division-26-27.json) | [mlssoccer.com/mlsnext/standings/academy_division/](https://www.mlssoccer.com/mlsnext/standings/academy_division/) |

Viewer: [mls-assist.theintelligenceplatform.com/#/standings/mls-next-league-26-27](https://mls-assist.theintelligenceplatform.com/#/standings/mls-next-league-26-27).

Host: `mls-assist.theintelligenceplatform.com`. Only **completed** games with both scores are kept. No invented W–D–L. Homegrown U13 maps to the app **U13** tab with **2014 birth-year** labeling.

If those JSON endpoints fail, ingest may open the official UI page only to rediscover the same JSON URLs. It does **not** scrape or invent table scores from HTML.

SOS for overlay MLS NEXT sides uses opponent **conference rank** from that public table (same spirit as GotSport opponent US/state ranks). GotSport match SOS still applies to GotSport-listed clubs.

## Sources

| Signal | Use |
| --- | --- |
| GotSport public rankings API, boys U12–U16, USA | Name, club, association→state, points, W–D–L when published |
| ECNL AthleteOne conference standings (theecnl.com) | ECNL / ECNL-RL conference rank, GP, W–L–D, GF–GA |
| MLS NEXT League 26/27 public standings + schedule | Conference rank, completed W–D–L, scored matches |
| MLS NEXT Cup 2026 U13 recaps | Overlay on 2014-BY / U13 MLS NEXT sides (Atlanta champion; LA Galaxy finalist; Inter Miami semifinalist) |
| TopDrawerSoccer TeamRank boys U13 (TDS labeled **2013** BY) | Overlay on matching clubs only — no ghost stubs |
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
2. MLS NEXT Cup / UpNext / conference rank after games are played (0.28). Unplayed conference #1 is **not** a national 100.
3. GotSport points (0.20) scaled to the max in that age tab
4. League-tier prior (0.10): Homegrown (T1) 72, Academy (T2) 70, ECNL (T1) 68, ECNL-RL (T2) 55, other 42

`usRank` = sort descending within the age-tab **seed**.  
`stateRank` = same sort within `state` + age tab **seed**.

## Home team + SOS

Highlighted side (badge only, not a locked landing): **Marin FC 2013/14 ECNL** (GotSport `56506`). Pin any team; unpin clears home. Persisted as `soccer-rankings-home-team-id`. Continuity (Blue 2014 only) only while Marin 2013/14 ECNL is pinned.

**Not Home / not continuity:** Marin FC Blue 2014/15 (`252973`), Red (`260095`), Steel (`367188`). Tokens **2015**, **B2015**, **B15**, **/15**, **2014/15** stay off the continuity path.

Sep 13 Marin 1–0 El Camino Salinas remains `not_yet_on_gotsport_public_feed` — not invented.
