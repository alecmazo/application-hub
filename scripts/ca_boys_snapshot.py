"""Load the CA boys API snapshot for seed / verify.

Live ingest remains the default. The snapshot is a dated dump under
uploads/ca-boys-api-snapshot (extract ca-boys-api-snapshot-lean.tgz).
GotSport ranking_data in that dump is ~20 mixed-gender rows — do not seed
GotSport from it.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "src/data/soccer-rankings/fixtures/ca-boys-snapshot-expected.json"
AGE_FROM_BU = {
    "BU13": "U13",
    "BU14": "U14",
    "BU15": "U15",
    "BU16": "U16",
    "BU17": "U17",
    "BU18/19": "U18/19",
    "BU1819": "U18/19",
}


def snapshot_dir() -> Path | None:
    env = os.environ.get("CA_BOYS_SNAPSHOT", "").strip()
    candidates = []
    if env:
        candidates.append(Path(env))
    candidates.extend(
        (
            ROOT / "uploads" / "ca-boys-api-snapshot",
            ROOT / "uploads" / "ca-boys-api-snapshot-lean",
        )
    )
    for path in candidates:
        if path.is_dir() and (path / "SUMMARY.md").exists():
            return path
    return None


def load_expected() -> dict:
    return json.loads(FIXTURE.read_text())


def conference_from_event_name(name: str) -> str:
    s = name or ""
    s = s.replace("ECNL Boys ", "").replace("ECNL RL Boys ", "")
    s = s.replace("2026-27", "").strip()
    return s or name


def ecnl_teams_from_snapshot(path: Path | None = None) -> list[dict]:
    """Convert snapshot AthleteOne W–L–D rows into ingest W–D–L rows."""
    folder = path or snapshot_dir()
    if folder is None:
        return []
    src = folder / "ecnl-ca.json"
    if not src.exists():
        return []
    payload = json.loads(src.read_text())
    teams: list[dict] = []
    for row in payload.get("records") or []:
        age = AGE_FROM_BU.get((row.get("division_name") or "").replace(" ", ""))
        if not age:
            continue
        gp = int(row.get("gp") or 0)
        wins = int(row.get("wins") or 0)
        losses = int(row.get("losses") or 0)
        draws = int(row.get("draws") or 0)
        conference = conference_from_event_name(row.get("event_name") or "")
        record = None
        if gp:
            record = {
                "w": wins,
                "d": draws,
                "l": losses,
                "asOf": payload.get("fetched_at") or "",
                "note": (
                    f"ECNL {conference} 26/27 conference table "
                    "(snapshot seed; completed games only)"
                ),
            }
        teams.append(
            {
                "name": row.get("team_name") or "",
                "ageBand": age,
                "tier": "ecnl",
                "conference": conference,
                "conferenceRank": int(row.get("position") or 0),
                "conferenceSize": 0,
                "played": gp,
                "gf": int(row.get("gf") or 0),
                "ga": int(row.get("ga") or 0),
                "record": record,
                "athleteOneTeamId": row.get("data_team_id"),
                "athleteOneClubId": row.get("data_club_id"),
                "eventId": row.get("event_id") or row.get("data_event_id"),
                "seed": "ca-boys-api-snapshot",
            }
        )
    size_by: dict[tuple[str, str], int] = {}
    for team in teams:
        key = (team["ageBand"], team["conference"])
        size_by[key] = size_by.get(key, 0) + 1
    for team in teams:
        team["conferenceSize"] = size_by[(team["ageBand"], team["conference"])]
    return teams


def merge_ecnl_live_over_seed(seed: list[dict], live: list[dict]) -> list[dict]:
    """Live AthleteOne rows win; snapshot fills gaps only."""
    by_key: dict[tuple[str, str, str, str], dict] = {}
    for row in seed:
        by_key[_ecnl_key(row)] = row
    for row in live:
        by_key[_ecnl_key(row)] = row
    return list(by_key.values())


def _ecnl_key(row: dict) -> tuple[str, str, str, str]:
    return (
        (row.get("name") or "").lower(),
        row.get("ageBand") or "",
        row.get("tier") or "",
        (row.get("conference") or "").lower(),
    )


def mls_snapshot_path(division: str, path: Path | None = None) -> Path | None:
    folder = path or snapshot_dir()
    if folder is None:
        return None
    name = (
        "mls-next-homegrown-ca.json"
        if division == "homegrown"
        else "mls-next-academy-ca.json"
    )
    candidate = folder / name
    return candidate if candidate.exists() else None
