# Midterms 2026 dashboard — how to update

Live: https://alecmazo.github.io/application-hub/midterms-2026/
Data file (repo path): `public/midterms-2026/data.json` (branch `main`)
Raw: https://raw.githubusercontent.com/alecmazo/application-hub/main/public/midterms-2026/data.json
Edit on web: https://github.com/alecmazo/application-hub/edit/main/public/midterms-2026/data.json

The page fetches `data.json?t=<timestamp>` (no cache) and re-polls every 5 minutes. Pushing to `main`
triggers the "Deploy App Hub to GitHub Pages" Action; the change is live ~1–3 min later.
Never invent numbers: use `null` for anything unknown — it renders as **pending**.

## Schema
```
lastUpdated        ISO time, e.g. "2026-11-03T14:00:00-08:00"
lastUpdatedLabel   human label shown on page, e.g. "Tue Nov 3, 2026, 2:00 PM PT"
notes[]            strings
states[]:
  code, name
  early_in_person        number | null
  early_in_person_note   string | null (shown when value is null, or as a caveat)
  mail_returned, total_cast   numbers
  early_data_as_of       e.g. "11/3"
  registered, registered_note
  election_day_turnout   number | null
  polls_close_pt         string
  y2022: { early_in_person|null, mail_returned, early_total, total_turnout, vep, vep_turnout_pct, headline_results }
  feeds[]: { label, url, type: "statewide"|"county"|"precinct" }      (official result feed links)
  county_baselines_2022[]: rows like { fips, county, gop_2022, dem_2022, total_2022 } (n/a if absent)
  county_baselines_2024[]: 2024 rows, shown ONLY on the '2024 reference' tab (legacy key `county_baselines` is read there too)
  party_turnout_2022: { dem, rep, other }   2022 pre-Election Day ballots by party (n/a if absent)
  party_registration_2022: { dem, rep, other }
  races[]: { race: "Governor"|"U.S. Senate"|"U.S. Senate (special)",
             status: "pending"|"called", winner|null, party|null, margin|null (e.g. "+4.2 pts"), source|null,
             reporting_pct: number|null,
             candidates[]: { name, party, incumbent: bool, votes: number|null, pct: number|null },
             win_probability: { status: "results pending", values: {"Name": "87%"}|null, source: string|null } }
timeline[]: { hour_pt: "5 PM", polls_close: string, update: string }   (fill `update` hourly)
sources[]: { title, url }
```

## Example: call a race
```json
{ "race": "Governor", "status": "called", "winner": "Jane Doe", "party": "D", "margin": "+3.1 pts", "source": "AP, 8:42 PM PT" }
```

## Option A — GitHub web edit
1. Open the "Edit on web" link above (pencil icon).
2. Change values; update `lastUpdated` and `lastUpdatedLabel`.
3. "Commit changes…" directly to `main`. Check the Actions tab goes green.

## Option B — git
```bash
git clone https://github.com/alecmazo/application-hub.git   # first time
cd application-hub && git pull
$EDITOR public/midterms-2026/data.json
python3 -m json.tool public/midterms-2026/data.json > /dev/null   # validate JSON
git add public/midterms-2026/data.json
git commit -m "Midterms: update $(date +%H:%M) PT"
git push origin main
```

## Page layout
Tabs: Overview (map, summary table, 2026-vs-2022 charts, timeline, all-race results, sources) and one tab
per state (`#KS`, `#IA`, … deep-linkable): turnout card, Governor/Senate candidates with votes, win-probability
panel, county/precinct feed links, county baselines. No polling data is shown anywhere.

Win probability shows **"results pending"** unless the race has at least one candidate with votes > 0 AND
`win_probability.values` AND `win_probability.source` are set from a published results-based model.
It is never computed from polls or by the page.

## Dropping in /workspace/election2026/data.json (candidates, baselines, feeds)
That file was not present at build time. When it exists, merge it (do not replace data.json):
```bash
cd application-hub/public/midterms-2026
python3 merge.py /workspace/election2026/data.json data.json
git add data.json && git commit -m "Midterms: merge candidates/feeds" && git push origin main
```
`merge.py` accepts `{"states": {"KS": {...}}}` or `{"states": [{"code": "KS", ...}]}`. Per state it copies
`feeds`, `county_baselines`, and `races` (matched to existing races by `race` name, case-insensitive;
unknown races are appended). Candidate fields copied: name, party, incumbent, votes, pct. Turnout fields are
untouched. If the file uses different key names, rename them to the ones above first (or extend merge.py).

## Election-night fields (v2, merged from /workspace/election2026/data.json on Nov 3)
- `states[].expected_vote_counted_pct` (number|null): "share of expected vote counted". Win probability stays
  **results pending** until this is ≥ 20 AND the race's `win_probability.values` + `.source` are filled.
- `states[].party_turnout`: early ballots by party registration; shown only for KS, IA, NV, PA, AZ, FL, CA.
  OH, MI, MN, TX show "No party registration".
- `states[].no_senate_race`: true for NV, PA, AZ, CA ("No Senate race in 2026").
- Candidate `votes`/`pct` start null; fill from official feeds. Everything is labeled Unofficial.
- merge.py mapping for the election2026 format: `candidates[ST].governor|senate` ([name, party] pairs) →
  `races[].candidates`; `feeds[ST].state|counties` → `feeds`; `county_baseline.counties[ST]` → `county_baselines`;
  `party_turnout[ST]` → `party_turnout`; `probability.by_state[ST].governor|senate` → `win_probability.values`.

## v3 (Nov 3): 2026 vs 2022 only; party bars; aggregate; 2024 reference tab
- Top "All 11 states at a glance" block: sums of total_cast/registered across states; party bars sum the latest
  `party_turnout.series` for the 7 party states (KS, IA, NV, PA, AZ, FL, CA). Optional top-level `aggregate` overrides:
  `{ total_ballots, registered, total_turnout_2022, party2026:{dem,rep,other}, party2022:{dem,rep,other} }`.
  2022 aggregate party bars sum `party_turnout_2022` only if all 7 states have it; otherwise n/a.
- Party bars: Republican, Democrat, Independent/Other; count + share of the three groups; 2026 vs '2022'.
- Every baseline in main views and state tabs is 2022. 2024 data appears only in the '2024 reference' tab,
  from top-level `baselines2024` if present, else each state's `county_baselines_2024` (or legacy `county_baselines`).
- merge.py mapping (election2026 file): `partyRegistration2022[ST]` -> `party_registration_2022`;
  `partyTurnout2022[ST]` -> `party_turnout_2022`; `countyBaselines2022[ST]` -> `county_baselines_2022`;
  `county_baseline.counties[ST]` -> `county_baselines_2022` if rows use *_2022 keys (or year==2022), else
  `county_baselines_2024`; top-level `aggregate` and `baselines2024` copied as-is.

## v4: 13 states (adds AK, GA)
- The page adds placeholder AK and GA tabs (all values pending/n/a) until data.json has them. merge.py creates
  skeleton entries for new state codes found in the election2026 file (candidates/feeds/party_turnout, or a
  top-level `AK`/`GA` block whose turnout fields, y2022, etc. are copied as-is).
- AK: ranked-choice note; deep dive labeled "House district" (`county_baselines_2022` rows hold districts).
- GA: "No party registration". Party aggregate still covers 7 states (KS, IA, NV, PA, AZ, FL, CA).
- Totals sum only states with reported numbers.

## v5 (Nov 3 2026): 2022 county baselines, Totals card, Election Day Votes card

In `/workspace/election2026/data.json` (top-level, keyed by state code), then run `python3 merge.py /workspace/election2026/data.json data.json`:

- `countyBaselines2022[ST]`: a list of `{county, gov_d_2022, gov_r_2022, gov_o_2022, gov_total_2022, sen_*_2022}`. Already filled in for all 13 states; AK is by House district. Don't edit these.
- `countyBaselines2022Meta[ST]`: `{source, url, note}`.
- `county_2026[ST]`: `{"<county name exactly as in baselines>": votes_2026}`. This fills the 2026 county bars.
- `hourly[ST]`: the FULL list for the day (merge replaces the state list). Optional `by_party_pct` {R,D,O} when only shares are published; `source_url` per row. Also set top-level `ST.election_day_turnout` (+ `_scope`, `_as_of`, `_source`, `_url`) to the latest value, or `ST.election_day_status = "Not yet published by state"`.
  `{"time_pt":"9 AM","ed_turnout":12345,"by_party":{"R":..,"D":..,"O":..}|null,"scope":"statewide"|"Maricopa County only","source":"..."}`
  This counts ELECTION DAY votes only (not mail or early). Use `by_party` only for KS, IA, NV, PA, AZ, FL, CA, and only when a source gives the split.
- `hourly_results[ST]`: rows are appended.
  `{"time_pt":"7 PM","expected_vote_counted_pct":12,"candidates":{"Name":votes},"scope":"...","source":"..."}`
  Use Election Day votes by candidate. Names must match the race candidates so the Net gap can find each candidate's party.
- The Net gap (candidate share minus their party's share of ED voters) is computed on the page only when the latest result row and a `by_party` row have the same `scope`.
- Election Day turnout: set `election_day_turnout` in the state's top-level block. The Totals card adds it to the grand total.
- AK `polls_close_pt` stays as it is once set.

## v6: precinct drill-down (AZ, TX, FL)
- 2022 baselines: `precincts/{AZ,TX,FL}.json` (MEDSL; `counties[County] = [[precinct, gov_d, gov_r, gov_o, sen_d, sen_r, sen_o], ...]`). These are lazy-loaded and are not in data.json.
- 2026 counts: the 10-minute routine writes `precincts/{ST}_2026.json` as `counties[County][Precinct] = {race, d, r, o, total, time_pt, source, source_url}`, using county names in Title Case and precinct names exactly as the county file gives them. The page shows "pending" for precincts that have no entry.
- Feed URLs: `precinctFeeds[ST]` in the election2026 file, which merge.py copies to `states[].precinct_feeds`.

## v7: county turnout before results (county_turnout_2026)
- Source key `countyTurnout2026[ST] = {as_of, label, source, url, note?, counties:{County:{total, R?, D?, O?, mail?, early?, ed?, partial?}}}`. merge.py copies it to `states[].county_turnout_2026`.
- Until `county_2026` (results) has entries, the county bars and table show this as "2026 ballots cast so far (turnout)". Counties with no figure show "not published". Once results exist, the column switches to "2026 results".
- Refresh it every 30 min. FL: all 67 counties from https://www.freshtake.vote/2026G/countydata.php (the table pairs a count row with a %-of-reg row). TX: TransparencyUSA county pages (SOS early vote) plus county ED updates. AZ: Maricopa Fast Facts. Add GA/NV/others only when the source publishes figures. Never estimate.

## v8: time zones
- Arizona (MST, no DST) is 1 hour ahead of PT on Nov 3: "noon" in Arizona is 11:00 AM PT. Always convert source times to PT before writing `time_pt`, and keep the original time in `source` (e.g. "as of 12 PM MST"). Do the same for ET (-3h), CT (-2h) and MT (-1h).

## v9: net lead headline
- "Net lead, all ballots cast" is calculated in the browser from data.json by `netAll()`: the latest early+mail party counts in `party_turnout` plus the latest statewide hourly row that has a party split (its `by_party`, or its `by_party_pct` × `ed_turnout`, shown with "~"). The change shown is against the previous statewide split row. Routines only need to keep `party_turnout` and `hourly` up to date; no separate field is needed.

## v10: precinct drill-down for all 13 states
- 2022 baselines are in `precincts/{ST}.json` for AZ, TX, FL, KS, IA, OH, MN, NV, MI, PA, CA, AK and GA (MEDSL). AK is grouped by state House district. MI and MN had no 2022 U.S. Senate race. The CA file has no Senate precinct rows.
- 2026 counts go in `precincts/{ST}_2026.json`, using the same schema as v6, and only from a public precinct-level source: county/SOS results pages or ENR exports, e.g. GA Clarity ENR (results.sos.ga.gov), PA county ENR, MI county ENR, OH county BOE, MN SOS results (electionresults.sos.mn.gov precinct downloads), NV Clark/Washoe, CA county ROVs, AK Division of Elections precinct reports, KS/IA county auditors. If a state has no such source, leave it empty; never estimate.
- Any file over ~1.5 MB is split as `precincts/{ST}/{county-slug}.json` with an index in `{ST}.json` (none split today).

## v11: 15 states (adds NH, ME)
- Routines (hourly, 10-minute, 30-minute) now also cover **NH** and **ME**: refresh `total_cast` / `mail_returned` / `early_in_person`, `hourly.NH` / `hourly.ME`, `party_turnout.ME` (NH publishes no early ballots by party, so leave its series empty), `county_turnout_2026`, and `precincts/NH_2026.json` / `precincts/ME_2026.json` (town names as in the 2022 file, e.g. "MANCHESTER WARD 1", county in Title Case).
- Sources: NH SOS results https://www.sos.nh.gov/elections/elections/election-results and party registration history; Maine SOS absentee voter file (https://www.maine.gov/sos/elections-voting/voter-data) and results https://www.maine.gov/sos/elections-voting/election-results-data.
- NH has no early in-person voting (absentee only); 2026 absentee count is 42,492 as of Oct 31 (SignalData compiling NH SOS). ME early = in-person absentee + other absentee returns.
- Polls close: ME 8 PM ET = 5 PM PT. NH towns close 7–8 PM ET (4–5 PM PT).
- ME U.S. Senate uses ranked-choice voting; first-choice counts first, RCV rounds only after the SOS tabulation. ME Governor is plurality. No ME Senate race in 2022, so the precinct file has Governor only.
- Overview party aggregate stays the original 7 states (`PARTY_AGG`); ME party data shows on its own tab.
