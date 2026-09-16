#!/usr/bin/env python3
"""Pull public GotSport boys U12/U13 rankings into compact seed JSON.

Uses the same unauthenticated JSON the rankings.gotsport.com UI calls.
Cache lives in /tmp/gotsport-rankings-cache so reruns are cheap.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/soccer-rankings/teams.json"
CACHE = Path("/tmp/gotsport-rankings-cache")
CACHE.mkdir(parents=True, exist_ok=True)

API = "https://system.gotsport.com/api/v1/team_ranking_data"
HEADERS = {
    "Accept": "application/json",
    "X-Rankings-Client": "rankings-web",
    "User-Agent": "application-hub-soccer-rankings/1.0 (personal research; public rankings)",
}

ASSOC_TO_STATE = {
    "CAS": "CA",
    "CAN": "CA",
    "TXN": "TX",
    "TXS": "TX",
    "NYE": "NY",
    "NYW": "NY",
    "PAE": "PA",
    "PAW": "PA",
    "FL": "FL",
    "NJ": "NJ",
    "GA": "GA",
    "VA": "VA",
    "WA": "WA",
    "AZ": "AZ",
    "CO": "CO",
    "IL": "IL",
    "OH": "OH",
    "NC": "NC",
    "MD": "MD",
    "MA": "MA",
    "NV": "NV",
    "MO": "MO",
    "TN": "TN",
    "OK": "OK",
    "MI": "MI",
    "CT": "CT",
    "OR": "OR",
    "UT": "UT",
    "NM": "NM",
    "LA": "LA",
    "SC": "SC",
    "AL": "AL",
    "WI": "WI",
    "MN": "MN",
    "KS": "KS",
    "KY": "KY",
    "IN": "IN",
    "IA": "IA",
    "NE": "NE",
    "AR": "AR",
    "MS": "MS",
    "DC": "DC",
    "DE": "DE",
    "RI": "RI",
    "NH": "NH",
    "ME": "ME",
    "VT": "VT",
    "WV": "WV",
    "ID": "ID",
    "HI": "HI",
    "AK": "AK",
    "MT": "MT",
    "WY": "WY",
    "ND": "ND",
    "SD": "SD",
    "PR": "PR",
}

# California first, then the large soccer states Alec named, then the rest.
ASSOCS = [
    "CAS",
    "CAN",
    "TXN",
    "TXS",
    "FL",
    "NYE",
    "NJ",
    "GA",
    "VA",
    "WA",
    "AZ",
    "CO",
    "IL",
    "OH",
    "NC",
    "PAE",
    "PAW",
    "NYW",
    "MD",
    "MA",
    "NV",
    "MO",
    "TN",
    "MI",
    "CT",
    "OR",
    "UT",
    "OK",
    "LA",
    "SC",
    "AL",
    "WI",
    "MN",
    "IN",
    "KY",
    "KS",
    "NM",
    "DC",
    "NH",
    "IA",
    "NE",
    "AR",
    "MS",
    "DE",
    "RI",
    "ID",
    "HI",
]

RE_2013 = re.compile(
    r"(?:^|[^0-9])(?:2013|b2013|\bb13\b|13b|13u)(?:[^0-9]|$)", re.I
)
RE_2014 = re.compile(
    r"(?:^|[^0-9])(?:2014|b2014|\bb14\b|14b|14u)(?:[^0-9]|$)", re.I
)
RE_2015 = re.compile(
    r"(?:^|[^0-9])(?:2015|b2015|\bb15\b|15b)(?:[^0-9]|$)", re.I
)
RE_2012 = re.compile(
    r"(?:^|[^0-9])(?:2012|b2012|\bb12\b|12b)(?:[^0-9]|$)", re.I
)
RE_MIX_1314 = re.compile(r"2013\s*/\s*14|13\s*/\s*14|2013-14|b2013/14", re.I)
RE_MIX_1415 = re.compile(r"2014\s*/\s*15|14\s*/\s*15|2014-15|b2014/15", re.I)


def fetch_page(age: int, assoc: str, page: int) -> dict:
    key = f"a{age}_{assoc}_p{page}.json"
    cache_path = CACHE / key
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    params = {
        "search[age]": str(age),
        "search[gender]": "m",
        "search[team_country]": "USA",
        "search[page]": str(page),
        "search[filter_by]": "state",
        "search[team_association]": assoc,
    }
    url = f"{API}?{urllib.parse.urlencode(params)}"
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode())
            cache_path.write_text(json.dumps(data))
            return data
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            time.sleep(0.6 * (attempt + 1))
            last = err
    raise RuntimeError(f"failed {assoc} U{age} page {page}: {last}")


def classify_league(blob: str) -> tuple[str, str]:
    n = blob.lower()
    if any(
        x in n
        for x in (
            "mls next hg",
            "mls next homegrown",
            "mls-next hg",
            "mlsnext hg",
            "mls hg",
            "mls hd",
        )
    ):
        return "mls-next-hg", "MLS NEXT Homegrown"
    if any(
        x in n
        for x in ("mls next", "mls-next", "mlsnext", "mls ad", "mls academy")
    ):
        return "mls-next", "MLS NEXT"
    if "ecnl-rl" in n or "ecnl rl" in n or "pre-ecnl" in n or "pre ecnl" in n:
        return "ecnl-rl", "ECNL-RL"
    if "ecnl" in n:
        return "ecnl", "ECNL"
    return "other", "GotSport / other"


def classify_years(row: dict) -> tuple[list[int], str]:
    blob = f"{row.get('team_name') or ''} {row.get('club_name') or ''}"
    age = int(row.get("age") or 0)
    league, _ = classify_league(blob)
    years: set[int] = set()
    alignment = "gotsport"

    mix1314 = bool(RE_MIX_1314.search(blob))
    mix1415 = bool(RE_MIX_1415.search(blob))
    y2013 = bool(RE_2013.search(blob))
    y2014 = bool(RE_2014.search(blob))
    y2015 = bool(RE_2015.search(blob))
    y2012 = bool(RE_2012.search(blob))

    if mix1314:
        years.update((2013, 2014))
        alignment = "ecnl-u13-2013-14" if league.startswith("ecnl") else "school-year-2013-14"
    if mix1415:
        years.add(2014)
        alignment = "u12-2014-15"
    if y2013:
        years.add(2013)
    if y2014:
        years.add(2014)

    if league in ("mls-next", "mls-next-hg") and age == 13:
        if y2013 and not y2014 and not mix1314:
            years.add(2013)
            alignment = "gotsport"
        else:
            years.add(2014)
            alignment = "mls-next-u13-2014-by"
    elif league == "ecnl" and age == 13:
        if y2014 and not y2013 and not mix1314:
            years.add(2014)
            alignment = "gotsport"
        else:
            years.update((2013, 2014))
            alignment = "ecnl-u13-2013-14"

    if not years:
        if y2015 and not y2014:
            return [], "skip-2015"
        if y2012 and not (y2013 or y2014):
            return [], "skip-2012"
        if age == 13:
            years.update((2013, 2014))
            alignment = "u13-year-unpublished"
        elif age == 12 and not y2015:
            years.add(2014)
            alignment = "u12-2014-15"
        else:
            return [], "skip"

    if y2015 and years == {2014} and not mix1415 and not y2014:
        # 2015-only U12
        return [], "skip-2015"

    return sorted(years), alignment


def display_name(row: dict) -> tuple[str, str]:
    club = (row.get("club_name") or "").strip() or "Unknown club"
    team = (row.get("team_name") or "").strip()
    if not team:
        return club, club
    if club.lower() in team.lower() or team.lower() in club.lower():
        return team, club
    return f"{club} {team}", club


def compact(row: dict, years: list[int], alignment: str, state: str) -> dict:
    league, label = classify_league(
        f"{row.get('team_name') or ''} {row.get('club_name') or ''}"
    )
    name, club = display_name(row)
    wins = row.get("total_wins")
    draws = row.get("total_draws")
    losses = row.get("total_losses")
    matches = row.get("total_matches") or 0
    as_of = row.get("ranking_date") or compiled_date()
    rec = None
    if matches and (wins or draws or losses):
        rec = {"w": int(wins or 0), "d": int(draws or 0), "l": int(losses or 0), "asOf": as_of}
    return {
        "id": f"gs-{row.get('team_id') or row.get('id')}",
        "name": name[:120],
        "club": club[:80],
        "state": state,
        "birthYears": years,
        "league": league,
        "leagueLabel": label,
        "ageAlignment": alignment,
        "gotsportAge": int(row.get("age") or 0),
        "gotsport": {
            "rank": row.get("national_rank"),
            "points": int(row.get("total_points") or 0),
            "associationRank": row.get("association_rank"),
            "asOf": as_of,
        },
        "record": rec,
        "sources": ["GotSport"],
    }


def compiled_date() -> str:
    return datetime.now(ZoneInfo("America/Los_Angeles")).date().isoformat()


def compiled_stamp() -> str:
    return datetime.now(ZoneInfo("America/Los_Angeles")).isoformat(timespec="minutes")


def gotsport_as_of(items: list[dict]) -> str:
    dates = [
        str((t.get("gotsport") or {}).get("asOf") or "")
        for t in items
        if (t.get("gotsport") or {}).get("asOf")
    ]
    return max(dates) if dates else compiled_date()


# Small curated overlays — TDS 2013 birth-year table and MLS NEXT U13 (2014 BY).
CURATED_2013_TDS = [
    ("Atlanta United FC", "GA", 1),
    ("Philadelphia Union", "PA", 2),
    ("SDSC Surf", "CA", 3),
    ("Orlando City SC", "FL", 4),
    ("LA Galaxy", "CA", 5),
    ("FC Dallas", "TX", 6),
    ("Inter Miami CF", "FL", 7),
    ("Weston FC", "FL", 8),
    ("FC Bay Area", "CA", 9),
    ("New York Red Bulls", "NJ", 10),
    ("GSA", "GA", 11),
    ("Pipeline SC", "MD", 12),
    ("New York City FC", "NY", 13),
    ("Crossfire Premier", "WA", 14),
    ("Florida Kraze Krush", "FL", 15),
]

CURATED_2014_MLSNEXT_CUP = [
    ("Atlanta United", "GA", "champion", 3),
    ("LA Galaxy", "CA", "finalist", 1),
    ("Inter Miami", "FL", "semifinalist", 2),
    ("Weston FC", "FL", None, 5),
]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _pick_club(
    teams: list[dict],
    club: str,
    state: str,
    year: int,
    prefer_mls: bool = False,
) -> dict | None:
    target = _norm(club)
    scored: list[tuple[int, dict]] = []
    for t in teams:
        if t["state"] != state or year not in t["birthYears"]:
            continue
        blob = _norm(t["name"] + t["club"])
        if target not in blob:
            continue
        pts = int((t.get("gotsport") or {}).get("points") or 0)
        name = (t["name"] + " " + t["club"]).lower()
        score = pts
        if t["league"] in ("mls-next", "mls-next-hg"):
            score += 80_000
        if "mls" in name:
            score += 25_000
        if t.get("gotsportAge") == 13:
            score += 12_000
        stripped = re.sub(r"u1[0-9]", " ", name)
        nblob = _norm(stripped)
        year_token = str(year)
        other = "2013" if year == 2014 else "2014"
        yy, yo = year % 100, int(other) % 100
        has_this = (
            year_token in name
            or f"b{year_token}" in nblob
            or f"{yy}b" in nblob
            or f"b{yy}" in nblob
        )
        has_other = (
            other in stripped
            or f"b{other}" in nblob
            or f"{yo}b" in nblob
            or f"b{yo}" in nblob
        )
        if has_other and not has_this:
            continue
        if has_this:
            score += 40_000
        if prefer_mls and t["league"] not in ("mls-next", "mls-next-hg") and "mls" not in name:
            continue
        scored.append((score, t))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]


def _stub(
    *,
    sid: str,
    name: str,
    club: str,
    state: str,
    years: list[int],
    league: str,
    label: str,
    alignment: str,
    sources: list[str],
) -> dict:
    return {
        "id": sid,
        "name": name,
        "club": club,
        "state": state,
        "birthYears": years,
        "league": league,
        "leagueLabel": label,
        "ageAlignment": alignment,
        "gotsportAge": 13,
        "sources": sources,
    }


def apply_overlays(teams: list[dict]) -> None:
    for club, state, rank in CURATED_2013_TDS:
        hit = _pick_club(teams, club, state, 2013)
        if hit is None:
            hit = _stub(
                sid=f"overlay-tds-2013-{_norm(club)}",
                name=f"{club} U13 (2013)",
                club=club,
                state=state,
                years=[2013],
                league="other",
                label="Published ranking overlay",
                alignment="gotsport",
                sources=["TDS TeamRank"],
            )
            teams.append(hit)
        hit["tdsRank"] = rank
        hit["tdsAsOf"] = "2026-06"
        if "TDS TeamRank" not in hit["sources"]:
            hit["sources"].append("TDS TeamRank")

    for club, state, cup, upnext in CURATED_2014_MLSNEXT_CUP:
        hit = _pick_club(teams, club, state, 2014, prefer_mls=True) or _pick_club(
            teams, club, state, 2014
        )
        if hit is not None and hit.get("gotsportAge") == 12:
            hit = None
        if hit is None:
            hit = _stub(
                sid=f"overlay-mlsnext-2014-{_norm(club)}",
                name=f"{club} U13 (2014 BY · MLS NEXT)",
                club=club,
                state=state,
                years=[2014],
                league="mls-next",
                label="MLS NEXT",
                alignment="mls-next-u13-2014-by",
                sources=["MLS NEXT Cup", "UpNext"],
            )
            teams.append(hit)
        hit["mlsNext"] = {
            "cup": cup,
            "upnextRank": upnext,
            "upnextAsOf": "2026-02-13",
        }
        if hit["league"] == "other":
            hit["league"] = "mls-next"
            hit["leagueLabel"] = "MLS NEXT"
            hit["ageAlignment"] = "mls-next-u13-2014-by"
        for tag in ("MLS NEXT Cup", "UpNext"):
            if tag not in hit["sources"]:
                hit["sources"].append(tag)


def compile_from_cache() -> dict:
    """Rebuild teams.json from whatever association pages are already cached."""
    teams: dict[str, dict] = {}
    skipped = {"2015": 0, "2012": 0, "other": 0}
    pages_ok = 0
    seen: set[tuple[str, int]] = set()
    for path in sorted(CACHE.glob("a*_*.json")):
        m = re.match(r"a(\d+)_([A-Z]+)_p(\d+)\.json", path.name)
        if not m:
            continue
        age, assoc, page = int(m.group(1)), m.group(2), int(m.group(3))
        if assoc not in ASSOC_TO_STATE:
            continue
        state = ASSOC_TO_STATE[assoc]
        data = json.loads(path.read_text())
        pages_ok += 1
        seen.add((assoc, age))
        for row in data.get("team_ranking_data") or []:
            years, alignment = classify_years(row)
            if not years:
                if "2015" in alignment:
                    skipped["2015"] += 1
                elif "2012" in alignment:
                    skipped["2012"] += 1
                else:
                    skipped["other"] += 1
                continue
            rec = compact(row, years, alignment, state)
            prev = teams.get(rec["id"])
            if prev:
                prev["birthYears"] = sorted(set(prev["birthYears"]) | set(years))
                if (rec["gotsport"]["points"] or 0) > (prev["gotsport"]["points"] or 0):
                    prev["gotsport"] = rec["gotsport"]
                    prev["record"] = rec["record"]
                    prev["gotsportAge"] = rec["gotsportAge"]
                if rec["league"] != "other" and prev["league"] == "other":
                    prev["league"] = rec["league"]
                    prev["leagueLabel"] = rec["leagueLabel"]
                if rec["ageAlignment"].startswith("mls-next") or rec[
                    "ageAlignment"
                ].startswith("ecnl"):
                    prev["ageAlignment"] = rec["ageAlignment"]
            else:
                teams[rec["id"]] = rec

    extra = {
        "cachedAssocs": sorted({f"{a}-U{age}" for a, age in seen}),
        "compiledAt": compiled_stamp(),
    }
    return finalize_catalog(teams, skipped, pages_ok, extra)


def finalize_catalog(
    teams: dict[str, dict],
    skipped: dict[str, int],
    pages_ok: int,
    extra_notes: dict | None = None,
) -> dict:
    items = list(teams.values())
    apply_overlays(items)
    items.sort(
        key=lambda t: (-int((t.get("gotsport") or {}).get("points") or 0), t["name"]),
    )
    ca = [t for t in items if t["state"] == "CA"]
    compiled_at = compiled_stamp()
    published = gotsport_as_of(items)
    notes = {
        "mlsNextU13": "2014 birth-year category",
        "ecnlU13": "2013/14 school-year alignment",
        "coverage": (
            "GotSport CAS+CAN U12/U13 directory is ingested in full. "
            "CA vintage universe ≈1,100+ competitive sides; the seed lists every "
            "public ranking row (multiple teams per club, mixed U12/U13 bands). "
            "US/state rank are among seeded teams. National ingest is still a sample."
        ),
        "compiledAt": compiled_at,
        "gotsportRankingDate": published,
    }
    if extra_notes:
        notes.update(extra_notes)
    return {
        "season": "2025-26",
        "asOf": published,
        "compiledAt": compiled_at,
        "source": "GotSport public rankings API (system.gotsport.com/api/v1/team_ranking_data)",
        "caUniverseEstimate": 1100,
        "notes": notes,
        "counts": {
            "uniqueTeams": len(items),
            "caUnique": len(ca),
            "y2013": sum(1 for t in items if 2013 in t["birthYears"]),
            "y2014": sum(1 for t in items if 2014 in t["birthYears"]),
            "skipped2015": skipped["2015"],
            "skipped2012": skipped["2012"],
            "pagesFetched": pages_ok,
        },
        "teams": items,
    }


def ingest() -> dict:
    teams: dict[str, dict] = {}
    skipped = {"2015": 0, "2012": 0, "other": 0}
    pages_ok = 0
    for assoc in ASSOCS:
        state = ASSOC_TO_STATE[assoc]
        for age in (13, 12):
            first = fetch_page(age, assoc, 1)
            pages_ok += 1
            pag = first.get("pagination") or {}
            total_pages = int(pag.get("total_pages") or 1)
            total_count = int(pag.get("total_count") or 0)
            if total_count == 0:
                continue
            print(f"{assoc} {state} U{age}: {total_count} teams / {total_pages} pages", flush=True)
            rows = list(first.get("team_ranking_data") or [])
            for page in range(2, total_pages + 1):
                cached = (CACHE / f"a{age}_{assoc}_p{page}.json").exists()
                data = fetch_page(age, assoc, page)
                pages_ok += 1
                rows.extend(data.get("team_ranking_data") or [])
                if not cached:
                    time.sleep(0.08)
            for row in rows:
                years, alignment = classify_years(row)
                if not years:
                    if "2015" in alignment:
                        skipped["2015"] += 1
                    elif "2012" in alignment:
                        skipped["2012"] += 1
                    else:
                        skipped["other"] += 1
                    continue
                rec = compact(row, years, alignment, state)
                prev = teams.get(rec["id"])
                if prev:
                    prev["birthYears"] = sorted(set(prev["birthYears"]) | set(years))
                    if (rec["gotsport"]["points"] or 0) > (prev["gotsport"]["points"] or 0):
                        prev["gotsport"] = rec["gotsport"]
                        prev["record"] = rec["record"]
                        prev["gotsportAge"] = rec["gotsportAge"]
                    if rec["league"] != "other" and prev["league"] == "other":
                        prev["league"] = rec["league"]
                        prev["leagueLabel"] = rec["leagueLabel"]
                    if rec["ageAlignment"].startswith("mls-next") or rec[
                        "ageAlignment"
                    ].startswith("ecnl"):
                        prev["ageAlignment"] = rec["ageAlignment"]
                else:
                    teams[rec["id"]] = rec
            time.sleep(0.05)

    return finalize_catalog(teams, skipped, pages_ok)


def main() -> None:
    import sys

    data = compile_from_cache() if "--from-cache" in sys.argv else ingest()
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    print("counts", data["counts"])


if __name__ == "__main__":
    main()
