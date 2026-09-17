#!/usr/bin/env python3
"""Pull public GotSport boys U12–U16 rankings into compact seed JSON.

Uses the same unauthenticated JSON the rankings.gotsport.com UI calls.
Cache lives in /tmp/gotsport-rankings-cache so reruns are cheap.

Age tabs are U12–U16. MLS NEXT is assigned by birth year; ECNL / most
GotSport clubs use school-year alignment. See METHODOLOGY.md.
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

RE_2011 = re.compile(r"(?:^|[^0-9])(?:2011|b2011|\bb11\b|11b)(?:[^0-9]|$)", re.I)
RE_2012 = re.compile(r"(?:^|[^0-9])(?:2012|b2012|\bb12\b|12b)(?:[^0-9]|$)", re.I)
RE_2013 = re.compile(r"(?:^|[^0-9])(?:2013|b2013|\bb13\b|13b|13u)(?:[^0-9]|$)", re.I)
RE_2014 = re.compile(r"(?:^|[^0-9])(?:2014|b2014|\bb14\b|14b|14u)(?:[^0-9]|$)", re.I)
RE_2015 = re.compile(r"(?:^|[^0-9])(?:2015|b2015|\bb15\b|15b)(?:[^0-9]|$)", re.I)
RE_MIX_1011 = re.compile(r"2010\s*/\s*11|10\s*/\s*11|2010-11|b2010/11", re.I)
RE_MIX_1112 = re.compile(r"2011\s*/\s*12|11\s*/\s*12|2011-12|b2011/12", re.I)
RE_MIX_1213 = re.compile(r"2012\s*/\s*13|12\s*/\s*13|2012-13|b2012/13", re.I)
RE_MIX_1314 = re.compile(r"2013\s*/\s*14|13\s*/\s*14|2013-14|b2013/14", re.I)
RE_MIX_1415 = re.compile(r"2014\s*/\s*15|14\s*/\s*15|2014-15|b2014/15", re.I)

AGE_BANDS = ("U12", "U13", "U14", "U15", "U16")
GOTSPORT_AGES = (12, 13, 14, 15, 16)

# Alec + official 2026–27 Homegrown PDF (born on/after Jan 1 of BY).
# 2025–26 Homegrown PDF was one year older (U13 = 2013) — documented, not used.
MLS_NEXT_BY_TO_BAND = {
    2015: "U12",
    2014: "U13",
    2013: "U14",
    2012: "U15",
    2011: "U16",
}
SCHOOL_YEAR_MIX_TO_BAND = {
    "2014/15": "U12",
    "2013/14": "U13",
    "2012/13": "U14",
    "2011/12": "U15",
    "2010/11": "U16",
}

MLS_NEXT_PUBLIC = ROOT / "src/data/soccer-rankings/mls-next-public.json"
ECNL_PUBLIC = ROOT / "src/data/soccer-rankings/ecnl-public.json"


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


HG_LISTING_RE = re.compile(
    r"homegrown|\bmls\s*(next\s*)?(hg|hd)\b|\b(hg|hd)\b",
    re.I,
)
ACADEMY_LISTING_RE = re.compile(
    r"mls\s*next|mlsnext|\bmls\s*ad\b|mls\s*academy",
    re.I,
)


def classify_league(blob: str) -> tuple[str, str]:
    n = blob.lower()
    if HG_LISTING_RE.search(n):
        return "mls-next-hg", "MLS NEXT Homegrown · Tier 1"
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
        return "mls-next-hg", "MLS NEXT Homegrown · Tier 1"
    if any(
        x in n
        for x in ("mls next", "mls-next", "mlsnext", "mls ad", "mls academy")
    ):
        return "mls-next", "MLS NEXT Academy · Tier 2"
    if "ecnl-rl" in n or "ecnl rl" in n or "pre-ecnl" in n or "pre ecnl" in n:
        return "ecnl-rl", "ECNL-RL · Tier 2"
    if "ecnl" in n:
        return "ecnl", "ECNL · Tier 1"
    return "other", "GotSport / other"


def _named_years(blob: str) -> tuple[set[int], str | None]:
    years: set[int] = set()
    mix = None
    if RE_MIX_1415.search(blob):
        years.update((2014, 2015))
        mix = "2014/15"
    if RE_MIX_1314.search(blob):
        years.update((2013, 2014))
        mix = "2013/14"
    if RE_MIX_1213.search(blob):
        years.update((2012, 2013))
        mix = "2012/13"
    if RE_MIX_1112.search(blob):
        years.update((2011, 2012))
        mix = "2011/12"
    if RE_MIX_1011.search(blob):
        years.update((2010, 2011))
        mix = "2010/11"
    if RE_2011.search(blob):
        years.add(2011)
    if RE_2012.search(blob):
        years.add(2012)
    if RE_2013.search(blob):
        years.add(2013)
    if RE_2014.search(blob):
        years.add(2014)
    if RE_2015.search(blob):
        years.add(2015)
    return years, mix


def classify_age_bands(row: dict) -> tuple[list[str], str, list[int]]:
    """Return (ageBands, alignment, birthYears). MLS NEXT = birth year only."""
    blob = f"{row.get('team_name') or ''} {row.get('club_name') or ''}"
    gs_age = int(row.get("age") or 0)
    league, _ = classify_league(blob)
    named, mix = _named_years(blob)
    is_mls = league in ("mls-next", "mls-next-hg")

    if is_mls:
        by = None
        if 2015 in named and 2014 not in named:
            by = 2015
        elif 2014 in named and not mix:
            by = 2014
        elif 2013 in named and not mix and 2014 not in named:
            by = 2013
        elif 2012 in named and not mix and 2013 not in named:
            by = 2012
        elif 2011 in named and not mix and 2012 not in named:
            by = 2011
        elif mix and mix in SCHOOL_YEAR_MIX_TO_BAND:
            # School-year token on an MLS NEXT listing — still birth-year, never school-year chip.
            by = {
                "U12": 2015,
                "U13": 2014,
                "U14": 2013,
                "U15": 2012,
                "U16": 2011,
            }[SCHOOL_YEAR_MIX_TO_BAND[mix]]
        elif gs_age in GOTSPORT_AGES:
            by = {12: 2015, 13: 2014, 14: 2013, 15: 2012, 16: 2011}.get(gs_age)
        if by is None:
            return [], "skip-mls-unmapped", []
        band = MLS_NEXT_BY_TO_BAND.get(by)
        if not band:
            return [], "skip-mls-unmapped", []
        alignment = f"mls-next-{band.lower()}-{by}-by"
        return [band], alignment, [by]

    # ECNL / US Club-style / GotSport: school-year or listing age.
    if mix and mix in SCHOOL_YEAR_MIX_TO_BAND:
        band = SCHOOL_YEAR_MIX_TO_BAND[mix]
        alignment = (
            f"ecnl-{band.lower()}-{mix.replace('/', '-')}"
            if league.startswith("ecnl")
            else f"school-year-{mix.replace('/', '-')}"
        )
        return [band], alignment, sorted(named)

    if gs_age in GOTSPORT_AGES:
        band = f"U{gs_age}"
        if league.startswith("ecnl"):
            alignment = f"ecnl-{band.lower()}-school-year"
        elif named:
            alignment = "gotsport"
        else:
            alignment = f"{band.lower()}-year-unpublished"
        return [band], alignment, sorted(named)

    if named:
        # Single-year name, no GotSport age — map like school-year older-half.
        year = min(named)
        band = MLS_NEXT_BY_TO_BAND.get(year)  # 2014→U13 school-year older is actually 2013
        # Non-MLS single year: 2015→U12, 2014→U13, 2013→U14? Alec school-year U13=2013/14.
        school_older = {2015: "U12", 2014: "U13", 2013: "U13", 2012: "U14", 2011: "U15"}
        band = school_older.get(year)
        if band:
            return [band], "gotsport", sorted(named)

    return [], "skip", []


def display_name(row: dict) -> tuple[str, str]:
    club = (row.get("club_name") or "").strip() or "Unknown club"
    team = (row.get("team_name") or "").strip()
    if not team:
        return club, club
    if club.lower() in team.lower() or team.lower() in club.lower():
        return team, club
    return f"{club} {team}", club


def compact(
    row: dict,
    bands: list[str],
    alignment: str,
    state: str,
    years: list[int],
) -> dict:
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
        "ageBands": bands,
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


# Published-list names that do not match GotSport / League Viewer tokens 1:1.
CLUB_ALIASES = {
    "fcbayarea": ("bayareasurf", "fcbayareasurf", "bayarea"),
    "fcbayareasurf": ("bayareasurf", "fcbayarea"),
    "bayareasurf": ("fcbayareasurf", "fcbayarea"),
    "sanfranciscoglenssc": ("sanfranciscoglens", "sfglens", "sfglenssc"),
    "sanfranciscoglens": ("sfglens", "sfglenssc", "sanfranciscoglenssc"),
    "woodsidecrush": ("woodside",),
    "thetown": ("thetownfc", "townfc"),
    "sdsurf": ("sdscsurf", "sandiegosurf"),
    "sdscsurf": ("sandiegosurf", "sdsurf"),
    "sandiegosurf": ("sdsurf", "sdscsurf"),
    "gsa": ("gwinnettsoccer", "gsasoccer"),
    "sanfranciscoelite": ("sfea", "sfelite"),
    "sfea": ("sanfranciscoelite", "sfelite"),
    "elcaminosalinas": ("elcaminofutbolsalinas", "elcaminofutbolclubsalinas"),
    "elcaminofutbolsalinas": ("elcaminosalinas",),
}


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
        years = t.get("birthYears") or []
        if t["state"] != state or year not in years:
            continue
        blob = _norm(t["name"] + t["club"])
        tokens = _club_tokens(t["name"] + " " + t["club"])
        aliases = CLUB_ALIASES.get(target, ())
        hit = (
            target in blob
            or target in tokens
            or any(a and (a in blob or a in tokens) for a in aliases)
            or (len(target) >= 6 and target in tokens)
        )
        if not hit:
            # "FC Bay Area" → tokens "bayarea" inside "bayareasurf"
            club_tok = _club_tokens(club)
            if not club_tok or len(club_tok) < 6 or club_tok not in tokens:
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
        "ageBands": [MLS_NEXT_BY_TO_BAND[y] for y in years if y in MLS_NEXT_BY_TO_BAND] or ["U13"],
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
            # Do not invent a ghost side — unmatched TDS names stay off the table.
            print(f"  skip TDS overlay (no GotSport match): {club} {state}", flush=True)
            continue
        hit["tdsRank"] = rank
        hit["tdsAsOf"] = "2026-06"
        if "TDS TeamRank" not in hit["sources"]:
            hit["sources"].append("TDS TeamRank")

    merge_mls_next_public(teams)
    # Cup / UpNext after MLS merge so Homegrown stubs (LA Galaxy) can match.
    for club, state, cup, upnext in CURATED_2014_MLSNEXT_CUP:
        hit = _pick_club(teams, club, state, 2014, prefer_mls=True) or _pick_club(
            teams, club, state, 2014
        )
        if hit is not None and hit.get("gotsportAge") == 12:
            hit = None
        if hit is None:
            print(f"  skip MLS NEXT Cup overlay (no match): {club} {state}", flush=True)
            continue
        mls = dict(hit.get("mlsNext") or {})
        mls.update(
            {
                "cup": cup,
                "upnextRank": upnext,
                "upnextAsOf": "2026-02-13",
            }
        )
        hit["mlsNext"] = mls
        if hit["league"] == "other":
            hit["league"] = "mls-next"
            hit["leagueLabel"] = "MLS NEXT Academy · Tier 2"
            hit["ageAlignment"] = "mls-next-u13-2014-by"
        if "U13" not in hit.get("ageBands", []):
            hit["ageBands"] = sorted(set(hit.get("ageBands") or []) | {"U13"})
        for tag in ("MLS NEXT Cup", "UpNext"):
            if tag not in hit["sources"]:
                hit["sources"].append(tag)

    merge_ecnl_public(teams)


def _club_tokens(name: str) -> str:
    return _norm(re.sub(r"\b(fc|sc|academy|soccer|club|united)\b", "", name, flags=re.I))


def _division_league(division: str | None) -> tuple[str, str]:
    if division == "homegrown":
        return "mls-next-hg", "MLS NEXT Homegrown · Tier 1"
    return "mls-next", "MLS NEXT Academy · Tier 2"


def _is_homegrown_listing(team: dict, label: str) -> bool:
    if team.get("league") == "mls-next-hg":
        return True
    return bool(HG_LISTING_RE.search(label))


def _is_official_mls_listing(team: dict, label: str, division: str | None) -> bool:
    if re.search(r"pre[\s-]*mls", label):
        return False
    # Homegrown-named sides must not receive the Academy overlay (and vice versa).
    if _is_homegrown_listing(team, label):
        return division == "homegrown"
    league = team.get("league")
    if division == "homegrown":
        return False
    if division == "academy":
        if league == "mls-next":
            return True
        return bool(ACADEMY_LISTING_RE.search(label))
    return league in ("mls-next", "mls-next-hg") or bool(
        ACADEMY_LISTING_RE.search(label) or HG_LISTING_RE.search(label)
    )


def merge_mls_next_public(teams: list[dict]) -> None:
    if not MLS_NEXT_PUBLIC.exists():
        return
    public = json.loads(MLS_NEXT_PUBLIC.read_text())
    by_band: dict[str, list[dict]] = {b: [] for b in AGE_BANDS}
    for t in teams:
        for band in t.get("ageBands") or []:
            by_band.setdefault(band, []).append(t)

    # Homegrown first so HG-named GotSport rows are claimed before Academy.
    public_rows = sorted(
        public.get("teams") or [],
        key=lambda r: (0 if r.get("division") == "homegrown" else 1, r.get("name") or ""),
    )
    for row in public_rows:
        band = row.get("ageBand")
        if band not in AGE_BANDS:
            continue
        division = row.get("division") or "academy"
        league, label = _division_league(division)
        target = _club_tokens(row.get("name") or "")
        if len(target) < 5:
            continue
        aliases = set(CLUB_ALIASES.get(target, ()))
        hit = None
        scored: list[tuple[int, dict]] = []
        for t in by_band.get(band, []):
            listing = f"{t['name']} {t['club']}".lower()
            blob = _club_tokens(listing)
            alias_hit = any(a and (a in blob or blob in a) for a in aliases)
            if target not in blob and blob not in target and not alias_hit:
                continue
            if not _is_official_mls_listing(t, listing, division):
                continue
            # Same org already attached — reuse that row.
            existing_org = (t.get("mlsNext") or {}).get("orgId")
            if existing_org and existing_org != row.get("orgId"):
                continue
            existing_div = (t.get("mlsNext") or {}).get("division")
            if existing_div and existing_div != division:
                continue
            pts = 80 if t["league"] == league else 40
            if existing_org == row.get("orgId"):
                pts += 100
            if division == "homegrown" and _is_homegrown_listing(t, listing):
                pts += 60
            scored.append((pts, t))
        if scored:
            scored.sort(key=lambda x: x[0], reverse=True)
            hit = scored[0][1]
        if hit is None:
            by = row.get("birthYear")
            suffix = "hg" if division == "homegrown" else "ad"
            hit = _stub(
                sid=f"mlsnext-{row.get('orgId')}-{band}-{suffix}",
                name=f"{row['name']} {label} {by} ({band})",
                club=row["name"],
                state=_guess_state(row.get("conference"), row.get("name")),
                years=[by] if by else [],
                league=league,
                label=label,
                alignment=f"mls-next-{band.lower()}-{by}-by" if by else f"mls-next-{band.lower()}-by",
                sources=["MLS NEXT League 26/27"],
            )
            hit["ageBands"] = [band]
            teams.append(hit)
            by_band.setdefault(band, []).append(hit)
        mls = dict(hit.get("mlsNext") or {})
        mls.update(
            {
                "conference": row.get("conference"),
                "conferenceRank": row.get("conferenceRank"),
                "conferenceSize": row.get("conferenceSize"),
                "orgId": row.get("orgId"),
                "division": division,
                "season": public.get("season"),
                "asOf": public.get("asOf"),
            }
        )
        if row.get("record"):
            mls["record"] = row["record"]
            # Prefer published MLS NEXT W–D–L on official overlay / Homegrown sides.
            if (
                not hit.get("record")
                or str(hit.get("id") or "").startswith("mlsnext-")
                or division == "homegrown"
            ):
                hit["record"] = row["record"]
        hit["mlsNext"] = mls
        if hit["league"] == "other":
            hit["league"] = league
            hit["leagueLabel"] = label
        if league == "mls-next-hg" and hit["league"] == "mls-next":
            # GotSport listed Academy; Homegrown feed is the better label when names match HG.
            if re.search(r"homegrown|\bmls\s*(next\s*)?(hg|hd)\b", f"{hit['name']} {hit['club']}".lower()):
                hit["league"] = league
                hit["leagueLabel"] = label
        if not str(hit.get("ageAlignment") or "").startswith("mls-next"):
            by = row.get("birthYear")
            hit["ageAlignment"] = (
                f"mls-next-{band.lower()}-{by}-by" if by else f"mls-next-{band.lower()}-by"
            )
        if "MLS NEXT League 26/27" not in hit["sources"]:
            hit["sources"].append("MLS NEXT League 26/27")


def _is_ecnl_listing(team: dict, label: str, tier: str) -> bool:
    blob = label.lower()
    if re.search(r"pre[\s-]*ecnl", blob):
        return False
    if tier == "ecnl-rl":
        return team.get("league") == "ecnl-rl" or bool(
            re.search(r"ecnl[\s-]*rl|regional league", blob)
        )
    if team.get("league") == "ecnl-rl" or re.search(r"ecnl[\s-]*rl", blob):
        return False
    return team.get("league") == "ecnl" or bool(re.search(r"\becnl\b", blob))


def _ecnl_club_key(name: str) -> str:
    """Club identity without league / birth-year tokens (age is matched separately)."""
    s = re.sub(r"\b(ecnl[\s-]*rl|ecnl|regional\s+league|pre[\s-]*ecnl)\b", " ", name, flags=re.I)
    s = re.sub(r"\bb?20\d{2}\s*/\s*\d{2}\b", " ", s, flags=re.I)
    s = re.sub(r"\bb?20\d{2}\b", " ", s, flags=re.I)
    s = re.sub(r"\bb?1[0-9](?:\s*/\s*1[0-9])?\b", " ", s, flags=re.I)
    return _club_tokens(s)


def merge_ecnl_public(teams: list[dict]) -> None:
    if not ECNL_PUBLIC.exists():
        return
    public = json.loads(ECNL_PUBLIC.read_text())
    by_band: dict[str, list[dict]] = {b: [] for b in AGE_BANDS}
    for t in teams:
        for band in t.get("ageBands") or []:
            by_band.setdefault(band, []).append(t)

    for row in public.get("teams") or []:
        band = row.get("ageBand")
        if band not in AGE_BANDS:
            continue
        tier = row.get("tier") or "ecnl"
        target = _ecnl_club_key(row.get("name") or "")
        if len(target) < 4:
            continue
        aliases = set(CLUB_ALIASES.get(target, ()))
        scored: list[tuple[int, dict]] = []
        for t in by_band.get(band, []):
            listing = f"{t['name']} {t['club']}"
            blob = _ecnl_club_key(listing)
            if not blob:
                continue
            alias_hit = any(a and (a == blob or a in blob or blob in a) for a in aliases)
            if target != blob and target not in blob and blob not in target and not alias_hit:
                continue
            if not _is_ecnl_listing(t, listing.lower(), tier):
                continue
            existing = (t.get("ecnl") or {}).get("athleteOneTeamId")
            if existing and existing != row.get("athleteOneTeamId"):
                continue
            pts = 80 if t.get("league") == tier else 40
            if target == blob:
                pts += 40
            if existing == row.get("athleteOneTeamId"):
                pts += 100
            if t.get("state") == "CA":
                pts += 20
            scored.append((pts, t))
        if not scored:
            continue
        scored.sort(key=lambda x: x[0], reverse=True)
        hit = scored[0][1]
        overlay = dict(hit.get("ecnl") or {})
        overlay.update(
            {
                "tier": tier,
                "conference": row.get("conference"),
                "conferenceRank": row.get("conferenceRank"),
                "conferenceSize": row.get("conferenceSize"),
                "played": row.get("played"),
                "gf": row.get("gf"),
                "ga": row.get("ga"),
                "athleteOneTeamId": row.get("athleteOneTeamId"),
                "eventId": row.get("eventId"),
                "season": public.get("season"),
                "asOf": public.get("asOf"),
            }
        )
        if row.get("record"):
            overlay["record"] = row["record"]
            # Prefer published conference W–D–L on official ECNL / RL sides.
            if not hit.get("record") or hit.get("league") in ("ecnl", "ecnl-rl"):
                hit["record"] = row["record"]
        hit["ecnl"] = overlay
        if hit["league"] == "other":
            hit["league"] = tier
            hit["leagueLabel"] = "ECNL-RL · Tier 2" if tier == "ecnl-rl" else "ECNL · Tier 1"
        if "ECNL AthleteOne 26/27" not in hit["sources"]:
            hit["sources"].append("ECNL AthleteOne 26/27")


CONFERENCE_STATE = {
    "florida": "FL",
    "sunshine north": "FL",
    "sunshine south": "FL",
    "southwest": "CA",
    "northwest": "CA",
    "northern california coast": "CA",
    "northern california redwood": "CA",
    "southern california": "CA",
    "pacific northwest": "WA",
    "northeast": "NY",
    "new england": "MA",
    "garden state": "NJ",
    "mid-atlantic": "VA",
    "virginia": "VA",
    "carolinas": "NC",
    "southeast": "GA",
    "south": "TX",
    "mid-america": "TX",
    "pioneer": "TX",
    "central (pro player pathway)": "IL",
    "northeast (pro player pathway)": "NY",
    "southeast (pro player pathway)": "GA",
    "west (pro player pathway)": "CA",
    "frontier": "CO",
    "mountain": "UT",
    "desert": "AZ",
    "great lakes north": "MI",
    "great lakes south": "OH",
    "heartland": "MO",
    "north": "MN",
    "empire": "NY",
    "turnpike": "NJ",
}


def _guess_state(conference: str | None, name: str) -> str:
    conf = (conference or "").strip().lower()
    if conf in CONFERENCE_STATE:
        return CONFERENCE_STATE[conf]
    for key, state in CONFERENCE_STATE.items():
        if key in conf:
            return state
    blob = f"{conference or ''} {name}".lower()
    if any(
        x in blob
        for x in (
            "california",
            "san francisco",
            "los angeles",
            "san diego",
            "sacramento",
            "bay area",
            "de anza",
        )
    ):
        return "CA"
    if any(x in blob for x in ("miami", "orlando", "tampa", "florida")):
        return "FL"
    if "dallas" in blob or "houston" in blob or "austin" in blob:
        return "TX"
    if "chicago" in blob:
        return "IL"
    if "atlanta" in blob:
        return "GA"
    if "seattle" in blob or "portland" in blob:
        return "WA"
    return "CA" if "surf" in blob and "bay" in blob else "TX"


def upsert_gotsport(teams: dict[str, dict], rec: dict) -> None:
    prev = teams.get(rec["id"])
    if not prev:
        teams[rec["id"]] = rec
        return
    prev["ageBands"] = sorted(set(prev.get("ageBands") or []) | set(rec.get("ageBands") or []))
    prev["birthYears"] = sorted(set(prev.get("birthYears") or []) | set(rec.get("birthYears") or []))
    if (rec["gotsport"]["points"] or 0) > (prev.get("gotsport", {}).get("points") or 0):
        prev["gotsport"] = rec["gotsport"]
        prev["record"] = rec["record"]
        prev["gotsportAge"] = rec["gotsportAge"]
    if rec["league"] != "other" and prev["league"] == "other":
        prev["league"] = rec["league"]
        prev["leagueLabel"] = rec["leagueLabel"]
    if rec["ageAlignment"].startswith("mls-next") or rec["ageAlignment"].startswith("ecnl"):
        prev["ageAlignment"] = rec["ageAlignment"]


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
            bands, alignment, years = classify_age_bands(row)
            if not bands:
                skipped["other"] += 1
                continue
            rec = compact(row, bands, alignment, state, years)
            upsert_gotsport(teams, rec)

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
    labels = {
        "mls-next-hg": "MLS NEXT Homegrown · Tier 1",
        "mls-next": "MLS NEXT Academy · Tier 2",
        "ecnl": "ECNL · Tier 1",
        "ecnl-rl": "ECNL-RL · Tier 2",
    }
    for t in items:
        if t.get("league") in labels:
            t["leagueLabel"] = labels[t["league"]]
    items.sort(
        key=lambda t: (-int((t.get("gotsport") or {}).get("points") or 0), t["name"]),
    )
    ca = [t for t in items if t["state"] == "CA"]
    compiled_at = compiled_stamp()
    published = gotsport_as_of(items)
    by_age = {
        band: sum(1 for t in items if band in (t.get("ageBands") or []))
        for band in AGE_BANDS
    }
    notes = {
        "mlsNextU13": "2014 birth-year category (official 2026–27 Homegrown)",
        "ecnlU13": "2013/14 school-year alignment",
        "legend": "MLS NEXT = birth year · ECNL / US Club-style = school year where applicable.",
        "coverage": (
            "CA-first three-source refresh: GotSport boys U12–U16 rankings + matches, "
            "MLS NEXT League Viewer 26/27 (Homegrown Tier 1 + Academy Tier 2), and "
            "ECNL AthleteOne conference standings (ECNL Tier 1 + ECNL-RL Tier 2). "
            "US/state rank are among seeded teams in that age tab."
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
        "source": "GotSport + MLS NEXT League Viewer + ECNL AthleteOne (CA-first)",
        "caUniverseEstimate": 1100,
        "notes": notes,
        "counts": {
            "uniqueTeams": len(items),
            "caUnique": len(ca),
            "byAge": by_age,
            "y2013": sum(1 for t in items if 2013 in (t.get("birthYears") or [])),
            "y2014": sum(1 for t in items if 2014 in (t.get("birthYears") or [])),
            "skipped": skipped.get("other", 0),
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
        for age in GOTSPORT_AGES:
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
                bands, alignment, years = classify_age_bands(row)
                if not bands:
                    skipped["other"] += 1
                    continue
                rec = compact(row, bands, alignment, state, years)
                upsert_gotsport(teams, rec)
            time.sleep(0.05)

    return finalize_catalog(teams, skipped, pages_ok)


def reoverlay_existing() -> dict:
    """Rebuild overlays + MLS NEXT merge from the current teams.json (no GotSport refetch)."""
    prev = json.loads(OUT.read_text())
    kept: dict[str, dict] = {}
    dropped = 0
    for t in prev.get("teams") or []:
        tid = str(t.get("id") or "")
        if tid.startswith("mlsnext-") or tid.startswith("overlay-"):
            dropped += 1
            continue
        # Drop stale conference rows; cup / GotSport stay. merge_mls_next_public rewrites.
        if t.get("mlsNext"):
            mls = {
                k: t["mlsNext"][k]
                for k in ("cup", "upnextRank", "upnextAsOf", "qopNote")
                if k in t["mlsNext"]
            }
            if mls:
                t["mlsNext"] = mls
            else:
                t.pop("mlsNext", None)
        t["sources"] = [
            s
            for s in (t.get("sources") or [])
            if s not in ("MLS NEXT League 26/27", "ECNL AthleteOne 26/27")
        ]
        t.pop("ecnl", None)
        if "GotSport" in (t.get("sources") or []):
            league, label = classify_league(f"{t.get('name') or ''} {t.get('club') or ''}")
            if league == "mls-next-hg":
                t["league"] = league
                t["leagueLabel"] = label
        kept[tid] = t
    print(f"reoverlay: kept {len(kept)} dropped stubs {dropped}", flush=True)
    skipped = (prev.get("counts") or {}).get("skipped") or 0
    pages = (prev.get("counts") or {}).get("pagesFetched") or 0
    extra = {
        "reoverlay": True,
        "compiledAt": compiled_stamp(),
        "gotsportRankingDate": prev.get("asOf"),
    }
    return finalize_catalog(kept, {"other": skipped}, pages, extra)


def ca_refresh_existing() -> dict:
    """Refetch Cal South / Cal North GotSport pages; keep other states; re-overlay."""
    prev = json.loads(OUT.read_text()) if OUT.exists() else {"teams": []}
    kept: dict[str, dict] = {}
    dropped_ca = 0
    dropped_stubs = 0
    for t in prev.get("teams") or []:
        tid = str(t.get("id") or "")
        if tid.startswith("mlsnext-") or tid.startswith("overlay-") or tid.startswith("ecnl-"):
            dropped_stubs += 1
            continue
        if t.get("state") == "CA" and tid.startswith("gs-"):
            dropped_ca += 1
            continue
        if t.get("mlsNext"):
            mls = {
                k: t["mlsNext"][k]
                for k in ("cup", "upnextRank", "upnextAsOf", "qopNote")
                if k in t["mlsNext"]
            }
            if mls:
                t["mlsNext"] = mls
            else:
                t.pop("mlsNext", None)
        t.pop("ecnl", None)
        t["sources"] = [
            s
            for s in (t.get("sources") or [])
            if s not in ("MLS NEXT League 26/27", "ECNL AthleteOne 26/27")
        ]
        kept[tid] = t
    print(f"ca-refresh: kept {len(kept)} dropped CA {dropped_ca} stubs {dropped_stubs}", flush=True)

    skipped = {"other": 0}
    pages_ok = 0
    for assoc in ("CAS", "CAN"):
        state = ASSOC_TO_STATE[assoc]
        for age in GOTSPORT_AGES:
            # Force a live pull for California.
            for stale in CACHE.glob(f"a{age}_{assoc}_p*.json"):
                stale.unlink()
            first = fetch_page(age, assoc, 1)
            pages_ok += 1
            pag = first.get("pagination") or {}
            total_pages = int(pag.get("total_pages") or 1)
            total_count = int(pag.get("total_count") or 0)
            print(f"{assoc} {state} U{age}: {total_count} teams / {total_pages} pages", flush=True)
            rows = list(first.get("team_ranking_data") or [])
            for page in range(2, total_pages + 1):
                data = fetch_page(age, assoc, page)
                pages_ok += 1
                rows.extend(data.get("team_ranking_data") or [])
                time.sleep(0.08)
            for row in rows:
                bands, alignment, years = classify_age_bands(row)
                if not bands:
                    skipped["other"] += 1
                    continue
                rec = compact(row, bands, alignment, state, years)
                upsert_gotsport(kept, rec)
            time.sleep(0.05)

    extra = {
        "caRefresh": True,
        "compiledAt": compiled_stamp(),
        "gotsportRankingDate": gotsport_as_of(list(kept.values())),
    }
    return finalize_catalog(kept, skipped, pages_ok, extra)


def main() -> None:
    import sys

    if "--ca-refresh" in sys.argv:
        data = ca_refresh_existing()
    elif "--reoverlay" in sys.argv:
        data = reoverlay_existing()
    elif "--from-cache" in sys.argv:
        data = compile_from_cache()
    else:
        data = ingest()
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    print("counts", data["counts"])


if __name__ == "__main__":
    main()
