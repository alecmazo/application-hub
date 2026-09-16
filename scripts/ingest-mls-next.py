#!/usr/bin/env python3
"""Pull public MLS NEXT League 26/27 standings + completed results.

Source (same JSON the official standings viewer loads):
  https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-league-26-27.json
  https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-league-26-27.json

Linked from https://www.mlssoccer.com/mlsnext/standings/homegrown_division/
Never invents scores. 26/27 U13 = 2014 birth year (Homegrown rules).
"""

from __future__ import annotations

import json
import urllib.request
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/soccer-rankings/mls-next-public.json"
CACHE = Path("/tmp/mls-next-cache")
CACHE.mkdir(parents=True, exist_ok=True)

STANDINGS_URL = (
    "https://mls-assist.theintelligenceplatform.com/data/standings/"
    "mls-next-league-26-27.json"
)
SCHEDULE_URL = (
    "https://mls-assist.theintelligenceplatform.com/data/schedule/"
    "mls-next-league-26-27.json"
)
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "application-hub-soccer-rankings/1.0 (personal research; public MLS NEXT)",
}

AGE_BANDS = ("U12", "U13", "U14", "U15", "U16")
# Official 2026–27 Homegrown: born on or after Jan 1 of this year.
MLS_NEXT_BAND_BIRTH_YEAR = {
    "U12": 2015,  # not an official Homegrown age; reserved if a 2015 side appears
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
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read()
    path.write_bytes(raw)
    return json.loads(raw.decode())


def ingest() -> dict:
    standings = fetch_json(STANDINGS_URL, "standings-26-27.json")
    schedule = fetch_json(SCHEDULE_URL, "schedule-26-27.json")
    brackets = standings["competition_season"]["competition_brackets"]
    events = schedule.get("events") or []

    teams: dict[tuple[int, str], dict] = {}
    for br in brackets:
        age = (br.get("age_group") or {}).get("name")
        if age not in AGE_BANDS:
            continue
        if br.get("gender") and br["gender"] != "male":
            continue
        conference = br.get("name") or ""
        for row in br.get("standings") or []:
            org = row.get("team") or {}
            oid = org.get("organisation_id")
            if oid is None:
                continue
            key = (int(oid), age)
            teams[key] = {
                "orgId": int(oid),
                "squadId": org.get("squad_id"),
                "name": org.get("name") or "Unknown",
                "ageBand": age,
                "birthYear": MLS_NEXT_BAND_BIRTH_YEAR[age],
                "conference": conference,
                "conferenceRank": row.get("position"),
                "conferenceSize": len(br.get("standings") or []),
                "record": None,
                "played": 0,
                "gf": 0,
                "ga": 0,
            }

    records: dict[tuple[int, str], dict] = defaultdict(
        lambda: {"w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "played": 0}
    )
    compact_matches: list[dict] = []
    for ev in events:
        age = ev.get("home_squad_name") or ev.get("away_squad_name")
        if age not in AGE_BANDS:
            continue
        ho = ev.get("home_organisation") or {}
        ao = ev.get("away_organisation") or {}
        hid, aid = ho.get("id"), ao.get("id")
        hs, aws = ev.get("home_score"), ev.get("away_score")
        completed = bool(ev.get("completed")) and hs is not None and aws is not None
        if completed:
            compact_matches.append(
                {
                    "id": ev.get("id"),
                    "date": (ev.get("start_time") or "")[:10] or None,
                    "ageBand": age,
                    "homeOrgId": hid,
                    "homeName": ho.get("name"),
                    "awayOrgId": aid,
                    "awayName": ao.get("name"),
                    "homeScore": hs,
                    "awayScore": aws,
                    "event": "MLS NEXT League 26/27",
                    "kind": "league",
                }
            )
            for oid, gf, ga in ((hid, hs, aws), (aid, aws, hs)):
                if oid is None:
                    continue
                rec = records[(int(oid), age)]
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
            oid, age = key
            row = {
                "orgId": oid,
                "squadId": None,
                "name": "Unknown",
                "ageBand": age,
                "birthYear": MLS_NEXT_BAND_BIRTH_YEAR[age],
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
                "note": "MLS NEXT League 26/27 public schedule (completed games only)",
            }

    items = sorted(
        teams.values(),
        key=lambda t: (t["ageBand"], t.get("conference") or "", t.get("conferenceRank") or 99, t["name"]),
    )
    return {
        "season": "2026-27",
        "asOf": as_of,
        "source": "MLS NEXT public League Viewer (mls-assist.theintelligenceplatform.com)",
        "standingsUrl": STANDINGS_URL,
        "scheduleUrl": SCHEDULE_URL,
        "page": "https://www.mlssoccer.com/mlsnext/standings/homegrown_division/",
        "notes": {
            "ageMap": "Official 2026-27 Homegrown: U13=2014 BY, U14=2013, U15=2012, U16=2011. No Homegrown U12.",
            "scores": "Only completed public schedule rows with both scores. Nothing invented.",
            "scheduleSyncedAt": schedule.get("synced_at"),
        },
        "counts": {
            "teams": len(items),
            "completedMatches": len(compact_matches),
            "byAge": {
                age: sum(1 for t in items if t["ageBand"] == age) for age in AGE_BANDS
            },
        },
        "teams": items,
        "matches": compact_matches,
    }


def main() -> None:
    data = ingest()
    OUT.write_text(json.dumps(data, separators=(",", ":")))
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    print("counts", data["counts"])
    glens = [t for t in data["teams"] if "glen" in t["name"].lower()]
    for t in glens:
        print("GLENS", t["ageBand"], t["name"], t.get("conference"), t.get("conferenceRank"), t.get("record"))


if __name__ == "__main__":
    main()
