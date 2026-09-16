#!/usr/bin/env python3
"""Pull public GotSport per-team match lists into a compact cache.

Endpoint: GET https://system.gotsport.com/api/v1/teams/{team_id}/matches
(same host as the rankings API; unauthenticated).

GitHub Pages cannot call this from the browser (no CORS), so we ship a
priority cache (home club + CA ECNL/power sample + one-hop opponents).
Live fetch still works in `vite` / `preview:spa` via the /gotsport-api proxy.

Never invents scores. Games without both scores stay unscored.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEAMS = ROOT / "src/data/soccer-rankings/teams.json"
OUT = ROOT / "src/data/soccer-rankings/matches.json"
CACHE = Path("/tmp/gotsport-matches-cache")
CACHE.mkdir(parents=True, exist_ok=True)

API = "https://system.gotsport.com/api/v1/teams/{id}/matches"
HEADERS = {
    "Accept": "application/json",
    "X-Rankings-Client": "rankings-web",
    "User-Agent": "application-hub-soccer-rankings/1.0 (personal research; public matches)",
}

HOME_ID = 56506  # Marin FC ECNL B2013/14; last year same id as Marin FC B14Blue
# Last year is the same GotSport listing. Do not treat 2014/15 or 2015 Marin
# Blue/Red/Steel lines as home continuity (252973 / 260095 / 367188).
HOME_CONTINUITY_EXCLUDE = {252973, 260095, 367188}
RELATED: list[int] = []
SINCE = "2024-07-01"
MIN_KEEP = 40


def classify_kind(*parts: object) -> str:
    blob = " ".join(str(p or "") for p in parts).lower()
    if any(
        x in blob
        for x in (
            "cup",
            "showcase",
            "classic",
            "invite",
            "invitational",
            "tournament",
            "stampede",
            "super cup",
            "futsal",
            "shootout",
            "playdate",
        )
    ):
        return "tournament"
    if any(
        x in blob
        for x in ("league", "npl", "ecnl", "conference", "mls next", "flight")
    ):
        return "league"
    return "unknown"


def fetch_raw(team_id: int) -> list:
    cache_path = CACHE / f"{team_id}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    url = API.format(id=team_id)
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode())
            if not isinstance(data, list):
                data = []
            cache_path.write_text(json.dumps(data))
            return data
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last = err
            time.sleep(0.7 * (attempt + 1))
    print(f"  fail {team_id}: {last}", flush=True)
    return []


def compact_match(row: dict) -> dict:
    home = row.get("homeTeam") or {}
    away = row.get("awayTeam") or {}
    hs = row.get("home_score")
    aws = row.get("away_score")
    return {
        "id": row.get("id"),
        "date": row.get("match_date") or None,
        "event": (row.get("event_name") or "")[:80],
        "eventId": row.get("event_id"),
        "competition": (row.get("competition_name") or "")[:60],
        "division": (row.get("division_name") or "")[:60],
        "kind": classify_kind(
            row.get("event_name"),
            row.get("competition_name"),
            row.get("division_name"),
        ),
        "homeId": home.get("team_id"),
        "homeName": (home.get("full_name") or row.get("title") or "Unknown")[:80],
        "awayId": away.get("team_id"),
        "awayName": (away.get("full_name") or "Unknown")[:80],
        "homeScore": hs if isinstance(hs, int) else None,
        "awayScore": aws if isinstance(aws, int) else None,
        "winnerId": row.get("winner_team_id"),
    }


def select_matches(raw: list) -> list[dict]:
    items = [compact_match(r) for r in raw if isinstance(r, dict)]
    recent = [m for m in items if (m.get("date") or "") >= SINCE]
    if len(recent) >= 8:
        return sorted(recent, key=lambda m: m.get("date") or "", reverse=True)
    items.sort(key=lambda m: m.get("date") or "", reverse=True)
    return items[:MIN_KEEP]


def gotsport_id(team: dict) -> int | None:
    m = re.match(r"gs-(\d+)$", str(team.get("id") or ""))
    return int(m.group(1)) if m else None


def priority_ids(catalog: dict) -> list[int]:
    teams = catalog.get("teams") or []
    ids: list[int] = [
        HOME_ID,
        *[rid for rid in RELATED if rid not in HOME_CONTINUITY_EXCLUDE],
    ]
    ca = [t for t in teams if t.get("state") == "CA" and gotsport_id(t)]
    for t in ca:
        if t.get("league") in ("ecnl", "ecnl-rl", "mls-next", "mls-next-hg"):
            ids.append(gotsport_id(t))  # type: ignore[arg-type]
    ca.sort(key=lambda t: -int((t.get("gotsport") or {}).get("points") or 0))
    for t in ca[:80]:
        ids.append(gotsport_id(t))  # type: ignore[arg-type]
    # unique, preserve order
    seen: set[int] = set()
    out: list[int] = []
    for i in ids:
        if i and i not in seen:
            seen.add(i)
            out.append(i)
    return out


def main() -> None:
    catalog = json.loads(TEAMS.read_text())
    wanted = priority_ids(catalog)
    print(f"priority teams {len(wanted)}", flush=True)
    store: dict[str, list] = {}
    opponents: set[int] = set()
    for i, tid in enumerate(wanted, 1):
        raw = fetch_raw(tid)
        rows = select_matches(raw)
        store[str(tid)] = rows
        if tid == HOME_ID or tid in RELATED:
            for m in rows:
                for oid in (m.get("homeId"), m.get("awayId")):
                    if oid and oid != tid:
                        opponents.add(int(oid))
        if i % 25 == 0:
            print(f"  {i}/{len(wanted)} cached={len(store)}", flush=True)
        time.sleep(0.08)

    extra = [oid for oid in sorted(opponents) if str(oid) not in store]
    print(f"home-orbit opponents {len(extra)}", flush=True)
    for oid in extra:
        raw = fetch_raw(oid)
        store[str(oid)] = select_matches(raw)
        time.sleep(0.08)

    n_matches = sum(len(v) for v in store.values())
    payload = {
        "asOf": "2026-09-15",
        "since": SINCE,
        "source": "GotSport public GET /api/v1/teams/{id}/matches",
        "homeTeamId": HOME_ID,
        "notes": {
            "cors": "Browser calls from GitHub Pages are blocked; this JSON is the shipped cache. Live fetch works via the /gotsport-api Vite proxy.",
            "window": f"Prefer matches on/after {SINCE}; if fewer than 8, keep the latest {MIN_KEEP}.",
        },
        "counts": {
            "teamsWithMatches": sum(1 for v in store.values() if v),
            "teamsFetched": len(store),
            "matches": n_matches,
        },
        "teams": store,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    meta_path = ROOT / "src/data/soccer-rankings/matches-meta.json"
    meta_path.write_text(
        json.dumps(
            {
                "asOf": payload["asOf"],
                "since": payload["since"],
                "source": payload["source"],
                "homeTeamId": HOME_ID,
                "teamsWithMatches": payload["counts"]["teamsWithMatches"],
                "teamsFetched": payload["counts"]["teamsFetched"],
                "matches": payload["counts"]["matches"],
                "gameCounts": {k: len(v) for k, v in store.items() if v},
            },
            indent=2,
        )
        + "\n"
    )
    print("wrote", OUT, "bytes", OUT.stat().st_size, "counts", payload["counts"])


if __name__ == "__main__":
    main()
