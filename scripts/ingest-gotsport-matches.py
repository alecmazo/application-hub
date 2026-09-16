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
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

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
EL_CAMINO_ECNL_ID = 71106  # El Camino FC Salinas ECNL B2013/14
# Last year is the same GotSport listing. Do not treat 2014/15 or 2015 Marin
# Blue/Red/Steel lines as home continuity (252973 / 260095 / 367188).
HOME_CONTINUITY_EXCLUDE = {252973, 260095, 367188}
RELATED: list[int] = []
# Always merge rankings-UI past/upcoming views for these sides.
FOCUS_IDS = {HOME_ID, EL_CAMINO_ECNL_ID}
SINCE = "2024-07-01"
MIN_KEEP = 40
EXPECTED_MARIN_EL_CAMINO = {
    "date": "2026-09-13",
    "timezone": "America/Los_Angeles",
    "teamIds": [HOME_ID, EL_CAMINO_ECNL_ID],
    "reported": (
        "Marin FC ECNL 2013/14 boys beat El Camino FC Salinas ECNL B2013/14 1–0"
    ),
}


def compiled_date() -> str:
    return datetime.now(ZoneInfo("America/Los_Angeles")).date().isoformat()


def compiled_stamp() -> str:
    return datetime.now(ZoneInfo("America/Los_Angeles")).isoformat(timespec="minutes")


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


def fetch_json(url: str) -> object | None:
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
            last = err
            time.sleep(0.7 * (attempt + 1))
    print(f"  fail {url}: {last}", flush=True)
    return None


def fetch_raw(team_id: int) -> list:
    cache_path = CACHE / f"{team_id}.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    data = fetch_json(API.format(id=team_id))
    if not isinstance(data, list):
        data = []
    cache_path.write_text(json.dumps(data))
    return data


def fetch_ranking_views(team_id: int) -> list:
    """Also pull the past/upcoming views the rankings.gotsport.com UI uses."""
    rows: list = []
    cache_path = CACHE / f"{team_id}-ranking-views.json"
    if cache_path.exists():
        cached = json.loads(cache_path.read_text())
        if isinstance(cached, list):
            return cached
    upcoming = fetch_json(
        API.format(id=team_id) + "?" + urllib.parse.urlencode({"upcoming": "true"})
    )
    if isinstance(upcoming, list):
        rows.extend(upcoming)
    elif isinstance(upcoming, dict):
        extra = upcoming.get("matches") or upcoming.get("data") or []
        if isinstance(extra, list):
            rows.extend(extra)
    page = 1
    while page <= 20:
        past = fetch_json(
            API.format(id=team_id)
            + "?"
            + urllib.parse.urlencode(
                {"past": "true", "page": page, "per_page": 10}
            )
        )
        if isinstance(past, dict):
            rows.extend(past.get("matches") or [])
            pag = past.get("pagination") or {}
            if page >= int(pag.get("total_pages") or 1):
                break
        elif isinstance(past, list):
            rows.extend(past)
            break
        else:
            break
        page += 1
        time.sleep(0.05)
    cache_path.write_text(json.dumps(rows))
    return rows


def merge_raw(*groups: list) -> list:
    seen: set[int] = set()
    out: list = []
    for group in groups:
        for row in group:
            if not isinstance(row, dict):
                continue
            mid = row.get("id")
            if isinstance(mid, int):
                if mid in seen:
                    continue
                seen.add(mid)
            out.append(row)
    return out


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


def find_expected_match(store: dict[str, list]) -> dict | None:
    want = set(EXPECTED_MARIN_EL_CAMINO["teamIds"])
    date = EXPECTED_MARIN_EL_CAMINO["date"]
    for tid in want:
        for m in store.get(str(tid), []):
            if (m.get("date") or "") != date:
                continue
            ids = {m.get("homeId"), m.get("awayId")}
            if want <= ids:
                return m
    return None


def not_on_public_feed_note(found: dict | None) -> dict:
    endpoints = [
        "GET https://system.gotsport.com/api/v1/teams/56506/matches",
        "GET https://system.gotsport.com/api/v1/teams/56506/matches?past=true&page=1..N&per_page=10",
        "GET https://system.gotsport.com/api/v1/teams/56506/matches?upcoming=true",
        "GET https://system.gotsport.com/api/v1/teams/71106/matches",
        "GET https://system.gotsport.com/api/v1/teams/71106/matches?past=true&page=1..N&per_page=10",
        "GET https://system.gotsport.com/api/v1/teams/71106/matches?upcoming=true",
        "GET https://system.gotsport.com/api/v1/team_ranking_data?team_id=56506 (events + event_results_json)",
        "GET https://system.gotsport.com/api/v1/team_ranking_data?team_id=71106 (events + event_results_json)",
        "GET https://system.gotsport.com/api/v1/team_ranking_data/team_details?team_id=56506",
        "GET https://system.gotsport.com/api/v1/team_ranking_data/team_details?team_id=71106",
        "GET https://rankings.gotsport.com/teams/56506/game-history",
        "GET https://rankings.gotsport.com/teams/56506/upcoming-games",
        "GET https://rankings.gotsport.com/teams/71106/game-history",
        "GET https://rankings.gotsport.com/teams/71106/upcoming-games",
        "CA ECNL U13 / 2013-14 match scan for dates on/after 2026-09-08",
    ]
    if found:
        return {
            "status": "found_on_gotsport_public_feed",
            "date": EXPECTED_MARIN_EL_CAMINO["date"],
            "reported": EXPECTED_MARIN_EL_CAMINO["reported"],
            "matchId": found.get("id"),
            "eventId": found.get("eventId"),
            "event": found.get("event"),
            "homeScore": found.get("homeScore"),
            "awayScore": found.get("awayScore"),
        }
    return {
        "status": "not_yet_on_gotsport_public_feed",
        "date": EXPECTED_MARIN_EL_CAMINO["date"],
        "timezone": EXPECTED_MARIN_EL_CAMINO["timezone"],
        "reported": EXPECTED_MARIN_EL_CAMINO["reported"],
        "homeTeamId": HOME_ID,
        "opponentTeamId": EL_CAMINO_ECNL_ID,
        "note": (
            "Alec confirmed this result. The public GotSport rankings UI match "
            "APIs and per-team match lists did not include it. Score is not "
            "invented."
        ),
        "endpointsTried": endpoints,
    }


def priority_ids(catalog: dict) -> list[int]:
    teams = catalog.get("teams") or []
    ids: list[int] = [
        HOME_ID,
        EL_CAMINO_ECNL_ID,
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
    extra_views = set(FOCUS_IDS)
    for t in catalog.get("teams") or []:
        gid = gotsport_id(t)
        if (
            gid
            and t.get("state") == "CA"
            and t.get("league") == "ecnl"
            and t.get("gotsportAge") == 13
            and 2013 in (t.get("birthYears") or [])
        ):
            extra_views.add(gid)
    print(f"priority teams {len(wanted)} extraViews={len(extra_views)}", flush=True)
    store: dict[str, list] = {}
    opponents: set[int] = set()
    for i, tid in enumerate(wanted, 1):
        raw = fetch_raw(tid)
        if tid in extra_views:
            raw = merge_raw(raw, fetch_ranking_views(tid))
        rows = select_matches(raw)
        store[str(tid)] = rows
        if tid == HOME_ID or tid == EL_CAMINO_ECNL_ID:
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
    compiled_at = compiled_stamp()
    expected = find_expected_match(store)
    missing = not_on_public_feed_note(expected)
    if expected:
        print(
            "found expected Marin vs El Camino",
            expected.get("id"),
            expected.get("eventId"),
            expected.get("date"),
            flush=True,
        )
    else:
        print("not_yet_on_gotsport_public_feed", EXPECTED_MARIN_EL_CAMINO["date"], flush=True)
    payload = {
        "asOf": compiled_date(),
        "compiledAt": compiled_at,
        "since": SINCE,
        "source": "GotSport public GET /api/v1/teams/{id}/matches",
        "homeTeamId": HOME_ID,
        "elCaminoEcnlTeamId": EL_CAMINO_ECNL_ID,
        "notes": {
            "cors": "Browser calls from GitHub Pages are blocked; this JSON is the shipped cache. Live fetch works via the /gotsport-api Vite proxy.",
            "window": f"Prefer matches on/after {SINCE}; if fewer than 8, keep the latest {MIN_KEEP}.",
            "rankingViews": (
                "Home, El Camino Salinas ECNL, and CA ECNL U13 2013/14 sides "
                "also merge rankings-web past=true / upcoming=true views."
            ),
        },
        "notOnPublicFeed": missing,
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
                "compiledAt": compiled_at,
                "since": payload["since"],
                "source": payload["source"],
                "homeTeamId": HOME_ID,
                "elCaminoEcnlTeamId": EL_CAMINO_ECNL_ID,
                "teamsWithMatches": payload["counts"]["teamsWithMatches"],
                "teamsFetched": payload["counts"]["teamsFetched"],
                "matches": payload["counts"]["matches"],
                "notOnPublicFeed": missing,
                "gameCounts": {k: len(v) for k, v in store.items() if v},
            },
            indent=2,
        )
        + "\n"
    )
    print("wrote", OUT, "bytes", OUT.stat().st_size, "counts", payload["counts"])


if __name__ == "__main__":
    main()
