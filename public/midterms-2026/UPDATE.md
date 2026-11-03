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
  races[]: { race, status: "pending"|"called", winner|null, party|null, margin|null (e.g. "+4.2 pts"), source|null }
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
