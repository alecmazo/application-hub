#!/usr/bin/env python3
"""Pull public ECNL / ECNL-RL boys conference standings from AthleteOne.

Primary (API, all boys conferences):

  GET https://api.athleteone.com/api/Script/get-conference-standings/{eventId}/12/{seasonId}/{divisionId}/0

Bare curl is 403. Send Origin + Referer https://theecnl.com.

Taught UI fallback (discovery only, not invented tables):

  https://theecnl.com/sports/2023/8/8/ECNLB_0808235537.aspx
  LEAGUES → Boys → ECNL Standings → Select Conference
  data-org-id=12  data-org-season-id=81 (ECNL) / 83 (ECNL-RL)
  loader: https://public.totalglobalsports.com/standings.min.js

Sibling Script routes: team-info is public; schedule/results return 401.

  ECNL (Tier 1):  seasonId=81   root 0/12/81/0/0
  ECNL-RL (Tier 2): seasonId=83  root 0/12/83/0/0

Northern Cal is ingested first. Every other conference from the root
event-select is pulled too (QA / Champions Cup skipped).
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/soccer-rankings/ecnl-public.json"
CACHE = Path("/tmp/ecnl-athleteone-cache")
CACHE.mkdir(parents=True, exist_ok=True)

HOST = "https://api.athleteone.com/api/Script/get-conference-standings"
ORG_ID = 12
VIEWER = "https://theecnl.com/sports/2023/8/8/ECNLB_0808235537.aspx"
HEADERS = {
    "Accept": "text/html,application/json,*/*",
    "Origin": "https://theecnl.com",
    "Referer": "https://theecnl.com/",
    "User-Agent": "application-hub-soccer-rankings/1.0 (personal research; public ECNL)",
}
ORG_RE = re.compile(r'data-org-id="(\d+)"')
SEASON_RE = re.compile(r'data-org-season-id="(\d+)"')
PRIORITY_CONF_RE = re.compile(
    r"northern\s*cal|norcal|golden state|southern\s*cal|far west|southwest",
    re.I,
)

# National fallbacks (root / national tables). Conference events remap these.
ECNL_DIVISIONS = (("U13", 22184), ("U14", 22185), ("U15", 22186), ("U16", 22187))
ECNL_RL_DIVISIONS = (("U13", 22467), ("U14", 22468), ("U15", 22469), ("U16", 22470))
AGE_FROM_LABEL = {
    "BU13": "U13",
    "BU14": "U14",
    "BU15": "U15",
    "BU16": "U16",
}

# CA-relevant ECNL boys conferences (2026-27).
ECNL_CA_EVENTS = (
    {"eventId": 4283, "conference": "Northern Cal", "tier": "ecnl", "seasonId": 81},
    {"eventId": 4273, "conference": "Far West", "tier": "ecnl", "seasonId": 81},
    {"eventId": 4287, "conference": "Southwest", "tier": "ecnl", "seasonId": 81},
)
ECNL_RL_CA_EVENTS = (
    {"eventId": 4351, "conference": "NorCal", "tier": "ecnl-rl", "seasonId": 83},
    {"eventId": 4348, "conference": "Golden State", "tier": "ecnl-rl", "seasonId": 83},
    {"eventId": 4354, "conference": "Southern Cal", "tier": "ecnl-rl", "seasonId": 83},
    {"eventId": 4427, "conference": "Far West", "tier": "ecnl-rl", "seasonId": 83},
    {"eventId": 4358, "conference": "Southwest", "tier": "ecnl-rl", "seasonId": 83},
)

OPTION_RE = re.compile(r'<option value="(\d+)"[^>]*>([^<]+)</option>', re.I)
DIV_SELECT_RE = re.compile(
    r'<select id="division-select"[^>]*>([\s\S]*?)</select>', re.I
)
H3_RE = re.compile(r"<h3[^>]*>([^<]+)</h3>", re.I)
TR_RE = re.compile(r"<tr\b[^>]*>([\s\S]*?)</tr>", re.I)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
INT_RE = re.compile(r"^-?\d+$")
TEAM_ID_RE = re.compile(r'data-team-id="(\d+)"')
CLUB_ID_RE = re.compile(r'data-club-id="(\d+)"')
EVENT_ID_RE = re.compile(r'data-event-id="(\d+)"')
NAME_RE = re.compile(
    r'data-team-id="\d+"[^>]*>\s*([^<]+?)\s*<',
    re.I,
)
CA_CONF_RE = re.compile(
    r"northern\s*cal|norcal|far west|southwest|golden state|southern\s*cal",
    re.I,
)
SKIP_EVENT_RE = re.compile(r"\bqa\b|champions cup", re.I)
CONF_PREFIX_RE = re.compile(r"^ECNL(\s+RL)?\s+Boys\s+", re.I)


def compiled_stamp() -> str:
    return datetime.now(ZoneInfo("America/Los_Angeles")).isoformat(timespec="minutes")


def conference_name(label: str) -> str:
    s = CONF_PREFIX_RE.sub("", label)
    s = re.sub(r"\s+2026-27.*$", "", s, flags=re.I)
    return s.strip() or label


def feeds_from_root(
    events: list[tuple[int, str]], *, tier: str, season_id: int
) -> list[dict]:
    feeds: list[dict] = []
    seen: set[int] = set()
    for eid, label in events:
        if eid in seen or SKIP_EVENT_RE.search(label):
            continue
        seen.add(eid)
        feeds.append(
            {
                "eventId": eid,
                "conference": conference_name(label),
                "tier": tier,
                "seasonId": season_id,
            }
        )
    return feeds


def fetch_html(event_id: int, season_id: int, division_id: int) -> str:
    url = f"{HOST}/{event_id}/{ORG_ID}/{season_id}/{division_id}/0"
    cache = CACHE / f"{event_id}-{season_id}-{division_id}.html"
    last: Exception | None = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=40) as resp:
                raw = resp.read()
            cache.write_bytes(raw)
            return raw.decode("utf-8", "ignore")
        except urllib.error.HTTPError as err:
            last = err
            if err.code == 403:
                print(
                    f"  AthleteOne 403 without browser headers? retrying with Referer "
                    f"(bare curl is 403): {url}",
                    flush=True,
                )
            time.sleep(0.6 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError) as err:
            last = err
            time.sleep(0.6 * (attempt + 1))
    # Taught UI fallback: Sidearm page does not embed the table (JS injects it).
    # Re-read org/season from the viewer, then retry AthleteOne once. Do not
    # invent standings from the empty Sidearm shell.
    org, season = discover_org_season_from_viewer()
    retry = f"{HOST}/{event_id}/{org}/{season_id or season}/{division_id}/0"
    try:
        req = urllib.request.Request(retry, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = resp.read()
        cache.write_bytes(raw)
        print(f"  viewer-discovery retry ok org={org} {retry}", flush=True)
        return raw.decode("utf-8", "ignore")
    except (urllib.error.URLError, TimeoutError, urllib.error.HTTPError) as err:
        last = err
    raise RuntimeError(f"failed {url}: {last}")


def discover_org_season_from_viewer() -> tuple[int, int]:
    req = urllib.request.Request(VIEWER, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=40) as resp:
        html = resp.read().decode("utf-8", "ignore")
    org = int(ORG_RE.search(html).group(1)) if ORG_RE.search(html) else ORG_ID
    season = int(SEASON_RE.search(html).group(1)) if SEASON_RE.search(html) else 81
    print(f"  taught UI {VIEWER} data-org-id={org} data-org-season-id={season}", flush=True)
    return org, season


def prioritize_feeds(feeds: list[dict]) -> list[dict]:
    """Northern Cal / CA conferences first; every other region still follows."""
    def key(feed: dict) -> tuple[int, str]:
        name = feed.get("conference") or ""
        if re.search(r"northern\s*cal|^norcal$", name, re.I):
            return (0, name)
        if PRIORITY_CONF_RE.search(name):
            return (1, name)
        return (2, name)

    return sorted(feeds, key=key)


def parse_root_events(html: str) -> list[tuple[int, str]]:
    events: list[tuple[int, str]] = []
    for value, label in OPTION_RE.findall(html):
        if not value.isdigit() or value == "0":
            continue
        if "BU1" in label or label.strip() in {"CONFERENCE", "--- Select ---"}:
            continue
        events.append((int(value), label.strip()))
    return events


def parse_heading_age(html: str) -> str | None:
    m = H3_RE.search(html)
    if not m:
        return None
    label = re.sub(r"\s+", "", m.group(1).upper())
    for key, band in AGE_FROM_LABEL.items():
        if key in label:
            return band
    return None


def parse_division_map(html: str) -> dict[str, int]:
    """Conference-specific BU13–BU16 IDs from #division-select."""
    block = DIV_SELECT_RE.search(html)
    if not block:
        return {}
    out: dict[str, int] = {}
    for value, label in OPTION_RE.findall(block.group(1)):
        if not value.isdigit():
            continue
        key = re.sub(r"\s+", "", label.upper())
        if key in AGE_FROM_LABEL:
            out[AGE_FROM_LABEL[key]] = int(value)
    return out


def _cells(tr_html: str) -> list[str]:
    parts = TAG_RE.sub("\n", tr_html)
    return [WS_RE.sub(" ", p).strip() for p in parts.split("\n") if WS_RE.sub(" ", p).strip()]


def parse_standings(html: str, *, age_band: str, conference: str, tier: str) -> list[dict]:
    rows: list[dict] = []
    for tr in TR_RE.findall(html):
        if "data-team-id" not in tr:
            continue
        cells = _cells(tr)
        name_m = NAME_RE.search(tr)
        name = (name_m.group(1) if name_m else "").strip()
        if not name:
            for c in cells:
                if not INT_RE.match(c) and not re.match(r"^-?\d+\.\d+$", c) and len(c) > 3:
                    if c.lower() in {"qualification:", "n/a", "pos", "teams"}:
                        continue
                    name = c
                    break
        if not name:
            continue
        ints = [int(c) for c in cells if INT_RE.match(c)]
        if len(ints) < 7:
            continue
        pos = ints[0]
        gp, wins, losses, draws, gf, ga = ints[1:7]
        team_id = int(TEAM_ID_RE.search(tr).group(1)) if TEAM_ID_RE.search(tr) else None
        club_id = int(CLUB_ID_RE.search(tr).group(1)) if CLUB_ID_RE.search(tr) else None
        event_id = int(EVENT_ID_RE.search(tr).group(1)) if EVENT_ID_RE.search(tr) else None
        record = None
        if gp:
            league = "Regional League " if tier == "ecnl-rl" else ""
            record = {
                "w": wins,
                "d": draws,
                "l": losses,
                "asOf": compiled_stamp(),
                "note": f"ECNL {league}{conference} 26/27 conference table (completed games only)",
            }
        rows.append(
            {
                "name": name,
                "ageBand": age_band,
                "tier": tier,
                "conference": conference,
                "conferenceRank": pos,
                "conferenceSize": 0,
                "played": gp,
                "gf": gf,
                "ga": ga,
                "record": record,
                "athleteOneTeamId": team_id,
                "athleteOneClubId": club_id,
                "eventId": event_id,
            }
        )
    size = len(rows)
    for row in rows:
        row["conferenceSize"] = size
    return rows


def ingest_group(
    feeds: tuple[dict, ...],
    divisions: tuple[tuple[str, int], ...],
    label: str,
) -> tuple[list[dict], list[dict]]:
    items: list[dict] = []
    maps: list[dict] = []
    bootstrap_age, bootstrap_national = divisions[0]
    for feed in feeds:
        print(
            f"bootstrap {label} {feed['conference']} event={feed['eventId']} "
            f"national={bootstrap_national}",
            flush=True,
        )
        html0 = fetch_html(feed["eventId"], feed["seasonId"], bootstrap_national)
        div_map = parse_division_map(html0)
        heading0 = parse_heading_age(html0)
        maps.append(
            {
                "label": label,
                "conference": feed["conference"],
                "eventId": feed["eventId"],
                "seasonId": feed["seasonId"],
                "divisionSelect": div_map,
                "bootstrapHeading": heading0,
            }
        )
        print(f"  division-select {div_map} heading={heading0}", flush=True)
        cached_html = {bootstrap_national: html0}
        for age, national_id in divisions:
            div_id = div_map.get(age, national_id)
            if age != bootstrap_age and not div_map:
                print(f"  skip {age}: no conference division-select map", flush=True)
                continue
            if div_id not in cached_html:
                print(
                    f"fetch {label} {feed['conference']} {age} "
                    f"event={feed['eventId']} div={div_id}",
                    flush=True,
                )
                cached_html[div_id] = fetch_html(feed["eventId"], feed["seasonId"], div_id)
                time.sleep(0.08)
            html = cached_html[div_id]
            heading = parse_heading_age(html)
            if heading != age:
                print(
                    f"  skip {age}: heading={heading} wanted={age} div={div_id}",
                    flush=True,
                )
                continue
            part = parse_standings(
                html,
                age_band=age,
                conference=feed["conference"],
                tier=feed["tier"],
            )
            print(f"  rows {age} {len(part)}", flush=True)
            items.extend(part)
    return items, maps


def main() -> None:
    # Discover conferences from the public root (documented; CA list is curated).
    root_ecnl = fetch_html(0, 81, 0)
    root_rl = fetch_html(0, 83, 0)
    discovered = {
        "ecnl": parse_root_events(root_ecnl),
        "ecnl-rl": parse_root_events(root_rl),
    }
    ecnl_feeds = prioritize_feeds(
        feeds_from_root(discovered["ecnl"], tier="ecnl", season_id=81)
    )
    rl_feeds = prioritize_feeds(
        feeds_from_root(discovered["ecnl-rl"], tier="ecnl-rl", season_id=83)
    )
    # Keep curated CA events even if the root list is missing a label.
    have_ecnl = {f["eventId"] for f in ecnl_feeds}
    have_rl = {f["eventId"] for f in rl_feeds}
    for feed in ECNL_CA_EVENTS:
        if feed["eventId"] not in have_ecnl:
            ecnl_feeds.append(dict(feed))
    for feed in ECNL_RL_CA_EVENTS:
        if feed["eventId"] not in have_rl:
            rl_feeds.append(dict(feed))
    print(
        f"ECNL conferences {len(ecnl_feeds)} RL {len(rl_feeds)} "
        f"(CA-priority {[f['conference'] for f in ECNL_CA_EVENTS + ECNL_RL_CA_EVENTS]})",
        flush=True,
    )

    teams: list[dict] = []
    maps: list[dict] = []
    part, part_maps = ingest_group(tuple(ecnl_feeds), ECNL_DIVISIONS, "ECNL")
    teams.extend(part)
    maps.extend(part_maps)
    part, part_maps = ingest_group(tuple(rl_feeds), ECNL_RL_DIVISIONS, "ECNL-RL")
    teams.extend(part)
    maps.extend(part_maps)
    payload = {
        "season": "2026-27",
        "asOf": compiled_stamp(),
        "source": "ECNL AthleteOne get-conference-standings (theecnl.com)",
        "endpoint": f"{HOST}/{{eventId}}/{ORG_ID}/{{seasonId}}/{{divisionId}}/0",
        "notes": {
            "format": "AthleteOne returns an HTML table. Parsed POS/GP/W/L/D/GF/GA only.",
            "scores": "Nothing invented. Empty GP stays without a W–D–L.",
            "tier": "ECNL seasonId=81 Tier 1; ECNL-RL seasonId=83 Tier 2. Boys only.",
            "caConferences": "Northern Cal / NorCal, Far West, Southwest, Golden State, Southern Cal (priority).",
            "allConferences": "Every ECNL / ECNL-RL boys conference from the AthleteOne root event-select (skip QA + Champions Cup).",
            "ages": "BU13–BU16 → U13–U16 (school-year). BU17/U18-19 skipped.",
            "divisionIds": (
                "Conference events use #division-select IDs (e.g. Northern Cal "
                "22383–22386). National 22184–22187 on a conference event still "
                "serve the BU13 table and are rejected when <h3> age mismatches."
            ),
            "viewer": "https://theecnl.com/sports/2023/8/8/ECNLB_0808235537.aspx",
            "loader": "https://public.totalglobalsports.com/standings.min.js",
            "schedules": (
                "AthleteOne get-team-schedule / get-conference-results return 401. "
                "get-individual-team-info is public but has an empty RESULTS table. "
                "Match lists stay on GotSport."
            ),
        },
        "discoveredEvents": discovered,
        "divisionMaps": maps,
        "feeds": [{**f, "label": "ECNL"} for f in ecnl_feeds]
        + [{**f, "label": "ECNL-RL"} for f in rl_feeds],
        "counts": {
            "teams": len(teams),
            "ecnl": sum(1 for t in teams if t["tier"] == "ecnl"),
            "ecnlRl": sum(1 for t in teams if t["tier"] == "ecnl-rl"),
            "playedTeams": sum(1 for t in teams if t.get("played")),
            "byAge": {
                age: sum(1 for t in teams if t["ageBand"] == age)
                for age in ("U13", "U14", "U15", "U16")
            },
        },
        "teams": teams,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print("wrote", OUT, "bytes", OUT.stat().st_size, "counts", payload["counts"])
    for needle in ("marin fc", "el camino", "mvla"):
        hits = [t for t in teams if needle in t["name"].lower()]
        for t in hits:
            rec = t.get("record")
            recs = f"{rec['w']}-{rec['d']}-{rec['l']}" if rec else "N/A"
            print(
                t["tier"],
                t["ageBand"],
                t["conference"],
                t.get("conferenceRank"),
                recs,
                f"{t.get('gf')}-{t.get('ga')}",
                t["name"],
            )


if __name__ == "__main__":
    main()
