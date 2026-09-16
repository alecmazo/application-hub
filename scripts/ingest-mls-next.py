#!/usr/bin/env python3
"""Pull public MLS NEXT League 26/27 standings + completed results.

Sources (same JSON the official standings viewer loads from mlssoccer.com/mlsnext):

  Homegrown (Allstate):
    https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-league-26-27.json
    https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-league-26-27.json
    Viewer: https://mls-assist.theintelligenceplatform.com/#/standings/mls-next-league-26-27

  Academy:
    https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-2-academy-division-26-27.json
    https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-2-academy-division-26-27.json
    Viewer: https://mls-assist.theintelligenceplatform.com/#/standings/mls-next-2-academy-division-26-27

Never invents scores. 26/27 U13 = 2014 birth year (Homegrown rules).
"""

from __future__ import annotations

import json
import re
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/soccer-rankings/mls-next-public.json"
CACHE = Path("/tmp/mls-next-cache")
CACHE.mkdir(parents=True, exist_ok=True)

FEEDS = (
    {
        "division": "homegrown",
        "label": "MLS NEXT Homegrown",
        "standingsUrl": (
            "https://mls-assist.theintelligenceplatform.com/data/standings/"
            "mls-next-league-26-27.json"
        ),
        "scheduleUrl": (
            "https://mls-assist.theintelligenceplatform.com/data/schedule/"
            "mls-next-league-26-27.json"
        ),
        "page": "https://www.mlssoccer.com/mlsnext/standings/homegrown_division/",
        "viewer": "https://mls-assist.theintelligenceplatform.com/#/standings/mls-next-league-26-27",
    },
    {
        "division": "academy",
        "label": "MLS NEXT Academy",
        "standingsUrl": (
            "https://mls-assist.theintelligenceplatform.com/data/standings/"
            "mls-next-2-academy-division-26-27.json"
        ),
        "scheduleUrl": (
            "https://mls-assist.theintelligenceplatform.com/data/schedule/"
            "mls-next-2-academy-division-26-27.json"
        ),
        "page": "https://www.mlssoccer.com/mlsnext/standings/academy_division/",
        "viewer": "https://mls-assist.theintelligenceplatform.com/#/standings/mls-next-2-academy-division-26-27",
    },
)

HEADERS = {
    "Accept": "application/json",
    "User-Agent": "application-hub-soccer-rankings/1.0 (personal research; public MLS NEXT)",
}

AGE_BANDS = ("U12", "U13", "U14", "U15", "U16")
AGE_RE = re.compile(r"\b(U1[2-6])\b", re.I)
MLS_NEXT_BAND_BIRTH_YEAR = {
    "U12": 2015,
    "U13": 2014,
    "U14": 2013,
    "U15": 2012,
    "U16": 2011,
}


def compiled_stamp() -> str:
    return datetime.now(ZoneInfo("America/Los_Angeles")).isoformat(timespec="minutes")


def fetch_json(url: str, cache_name: str) -> dict:
    path = CACHE / cache_name
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read()
    path.write_bytes(raw)
    return json.loads(raw.decode())


def parse_age(value: object) -> str | None:
    if isinstance(value, dict):
        value = value.get("name") or value.get("code") or ""
    text = str(value or "")
    m = AGE_RE.search(text)
    if not m:
        return None
    band = m.group(1).upper()
    return band if band in AGE_BANDS else None


def ingest_feed(feed: dict) -> tuple[dict[tuple[int, str, str], dict], list[dict]]:
    division: str = feed["division"]
    standings = fetch_json(
        feed["standingsUrl"], f"standings-{division}-26-27.json"
    )
    schedule = fetch_json(
        feed["scheduleUrl"], f"schedule-{division}-26-27.json"
    )
    brackets = standings["competition_season"]["competition_brackets"]
    events = schedule.get("events") or []

    teams: dict[tuple[int, str, str], dict] = {}
    for br in brackets:
        age = parse_age(br.get("age_group"))
        if age not in AGE_BANDS:
            continue
        if br.get("gender") and br["gender"] != "male":
            continue
        conference = br.get("name") or ""
        rows = br.get("standings") or []
        for row in rows:
            org = row.get("team") or {}
            oid = org.get("organisation_id")
            if oid is None:
                continue
            key = (int(oid), age, division)
            teams[key] = {
                "orgId": int(oid),
                "squadId": org.get("squad_id"),
                "name": org.get("name") or "Unknown",
                "ageBand": age,
                "birthYear": MLS_NEXT_BAND_BIRTH_YEAR[age],
                "division": division,
                "divisionLabel": feed["label"],
                "conference": conference,
                "conferenceRank": row.get("position"),
                "conferenceSize": len(rows),
                "record": None,
                "played": 0,
                "gf": 0,
                "ga": 0,
            }

    records: dict[tuple[int, str, str], dict] = defaultdict(
        lambda: {"w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "played": 0}
    )
    compact_matches: list[dict] = []
    for ev in events:
        age = parse_age(ev.get("home_squad_name")) or parse_age(
            ev.get("away_squad_name")
        )
        if age not in AGE_BANDS:
            continue
        ho = ev.get("home_organisation") or {}
        ao = ev.get("away_organisation") or {}
        hid, aid = ho.get("id"), ao.get("id")
        hs, aws = ev.get("home_score"), ev.get("away_score")
        completed = bool(ev.get("completed")) and hs is not None and aws is not None
        if not completed:
            continue
        compact_matches.append(
            {
                "id": ev.get("id"),
                "date": (ev.get("start_time") or "")[:10] or None,
                "ageBand": age,
                "division": division,
                "homeOrgId": hid,
                "homeName": ho.get("name"),
                "awayOrgId": aid,
                "awayName": ao.get("name"),
                "homeScore": hs,
                "awayScore": aws,
                "event": feed["label"] + " 26/27",
                "kind": "league",
            }
        )
        for oid, gf, ga in ((hid, hs, aws), (aid, aws, hs)):
            if oid is None:
                continue
            rec = records[(int(oid), age, division)]
            rec["played"] += 1
            rec["gf"] += int(gf)
            rec["ga"] += int(ga)
            if gf > ga:
                rec["w"] += 1
            elif gf < ga:
                rec["l"] += 1
            else:
                rec["d"] += 1

    as_of = compiled_stamp()
    for key, rec in records.items():
        row = teams.get(key)
        if row is None:
            oid, age, _div = key
            row = {
                "orgId": oid,
                "squadId": None,
                "name": "Unknown",
                "ageBand": age,
                "birthYear": MLS_NEXT_BAND_BIRTH_YEAR[age],
                "division": division,
                "divisionLabel": feed["label"],
                "conference": None,
                "conferenceRank": None,
                "conferenceSize": None,
                "record": None,
                "played": 0,
                "gf": 0,
                "ga": 0,
            }
            teams[key] = row
        row["played"] = rec["played"]
        row["gf"] = rec["gf"]
        row["ga"] = rec["ga"]
        if rec["played"]:
            row["record"] = {
                "w": rec["w"],
                "d": rec["d"],
                "l": rec["l"],
                "asOf": as_of,
                "note": f"{feed['label']} 26/27 public schedule (completed games only)",
            }

    return teams, compact_matches


def ingest() -> dict:
    teams: dict[tuple[int, str, str], dict] = {}
    matches: list[dict] = []
    for feed in FEEDS:
        print("fetch", feed["division"], flush=True)
        part, part_matches = ingest_feed(feed)
        teams.update(part)
        matches.extend(part_matches)

    items = sorted(
        teams.values(),
        key=lambda t: (
            t["division"],
            t["ageBand"],
            t.get("conference") or "",
            t.get("conferenceRank") or 99,
            t["name"],
        ),
    )
    by_div_age: dict[str, dict[str, int]] = {"homegrown": {}, "academy": {}}
    for t in items:
        by_div_age.setdefault(t["division"], {})
        by_div_age[t["division"]][t["ageBand"]] = (
            by_div_age[t["division"]].get(t["ageBand"], 0) + 1
        )
    return {
        "season": "2026-27",
        "asOf": compiled_stamp(),
        "source": "MLS NEXT public League Viewer (mls-assist.theintelligenceplatform.com)",
        "feeds": [
            {
                "division": f["division"],
                "label": f["label"],
                "standingsUrl": f["standingsUrl"],
                "scheduleUrl": f["scheduleUrl"],
                "page": f["page"],
                "viewer": f["viewer"],
            }
            for f in FEEDS
        ],
        "notes": {
            "ageMap": "Official 2026-27 Homegrown: U13=2014 BY, U14=2013, U15=2012, U16=2011. No Homegrown U12.",
            "scores": "Only completed public schedule rows with both scores. Nothing invented.",
            "divisions": "Homegrown = mls-next-league-26-27; Academy = mls-next-2-academy-division-26-27.",
        },
        "counts": {
            "teams": len(items),
            "completedMatches": len(matches),
            "byDivision": {
                div: sum(1 for t in items if t["division"] == div)
                for div in ("homegrown", "academy")
            },
            "byAge": {
                age: sum(1 for t in items if t["ageBand"] == age) for age in AGE_BANDS
            },
            "byDivisionAge": by_div_age,
            "playedTeams": sum(1 for t in items if t.get("played")),
        },
        "teams": items,
        "matches": matches,
    }


def main() -> None:
    data = ingest()
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    print("counts", data["counts"])
    for needle in ("glen", "bay area", "marin"):
        hits = [t for t in data["teams"] if needle in t["name"].lower()]
        for t in hits:
            print(
                t["division"],
                t["ageBand"],
                t["name"],
                t.get("conference"),
                t.get("conferenceRank"),
                t.get("record"),
            )


if __name__ == "__main__":
    main()
