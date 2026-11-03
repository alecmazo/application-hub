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
  county_baselines[]: free-form rows, e.g. { county, registered, votes_2022, dem_2022, rep_2022 }
                      (columns are rendered from the first row's keys)
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
