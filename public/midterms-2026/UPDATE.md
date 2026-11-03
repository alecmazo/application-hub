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
