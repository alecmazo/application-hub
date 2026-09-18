#!/usr/bin/env python3
"""Verify shipped Soccer Rankings JSON against the CA boys API snapshot.

Marin FC ECNL Northern Cal must match the snapshot W–L–T lines
(AthleteOne W–L–D → app W–D–L). GotSport ranking_data in the dump is
ignored (~20 mixed-gender rows, 0 CA boys).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from ca_boys_snapshot import load_expected, snapshot_dir  # noqa: E402

ECNL_OUT = ROOT / "src/data/soccer-rankings/ecnl-public.json"
MLS_OUT = ROOT / "src/data/soccer-rankings/mls-next-public.json"
TEAMS_OUT = ROOT / "src/data/soccer-rankings/teams.json"


def _wdl(row: dict) -> tuple[int, int, int, int, int, int]:
    rec = row.get("record") or {}
    return (
        int(rec.get("w") or 0),
        int(rec.get("d") or 0),
        int(rec.get("l") or 0),
        int(row.get("played") or row.get("gp") or 0),
        int(row.get("gf") or 0),
        int(row.get("ga") or 0),
    )


def _fail(errors: list[str], msg: str) -> None:
    errors.append(msg)
    print("FAIL", msg)


def verify_marin(ecnl: dict, expected: dict, errors: list[str]) -> None:
    live = [
        t
        for t in ecnl.get("teams") or []
        if t.get("tier") == "ecnl"
        and t.get("conference") == "Northern Cal"
        and "marin fc" in (t.get("name") or "").lower()
    ]
    by_age = {t["ageBand"]: t for t in live}
    print("Marin FC ECNL Northern Cal (snapshot W–L–D → app W–D–L)")
    for exp in expected["marinEcnlNorthernCal"]:
        age = exp["ageBand"]
        hit = by_age.get(age)
        want = (exp["w"], exp["d"], exp["l"], exp["gp"], exp["gf"], exp["ga"])
        if hit is None:
            _fail(errors, f"missing Marin {age} {exp['name']}")
            continue
        got = _wdl(hit)
        rank = hit.get("conferenceRank")
        ok = got == want and rank == exp["conferenceRank"]
        line = (
            f"  {age} {exp['name']}: AthleteOne {exp['athleteOneWL']} "
            f"→ app {exp['w']}-{exp['d']}-{exp['l']} "
            f"GP{exp['gp']} {exp['gf']}-{exp['ga']} #{exp['conferenceRank']}"
        )
        if ok:
            print("OK ", line)
        else:
            _fail(errors, f"{line} but live {got} #{rank}")


def verify_norcal(ecnl: dict, expected: dict, errors: list[str]) -> None:
    for age, rows in expected["northernCalByAge"].items():
        live = [
            t
            for t in ecnl.get("teams") or []
            if t.get("tier") == "ecnl"
            and t.get("conference") == "Northern Cal"
            and t.get("ageBand") == age
        ]
        by_name = {t["name"].lower(): t for t in live}
        missing = 0
        mismatch = 0
        for exp in rows:
            hit = by_name.get(exp["name"].lower())
            if hit is None:
                missing += 1
                _fail(errors, f"NorCal {age} missing {exp['name']}")
                continue
            want = (exp["w"], exp["d"], exp["l"], exp["gp"], exp["gf"], exp["ga"])
            if _wdl(hit) != want or hit.get("conferenceRank") != exp["conferenceRank"]:
                mismatch += 1
                _fail(
                    errors,
                    f"NorCal {age} {exp['name']} want {want} #{exp['conferenceRank']} "
                    f"got {_wdl(hit)} #{hit.get('conferenceRank')}",
                )
        extra = len(live) - len(rows) + missing
        print(
            f"OK  NorCal {age}: {len(rows)} snapshot rows, "
            f"{len(live)} live, missing {missing}, mismatch {mismatch}, extra {max(extra, 0)}"
            if not missing and not mismatch
            else f"     NorCal {age}: {len(rows)} snapshot / {len(live)} live"
        )


def verify_teams_json(teams: dict, expected: dict, errors: list[str]) -> None:
    by_name = {t["name"].lower(): t for t in teams.get("teams") or []}
    for exp in expected["marinEcnlNorthernCal"]:
        if exp["ageBand"] not in {"U13", "U14", "U15", "U16"}:
            continue
        hit = by_name.get(exp["name"].lower())
        if hit is None:
            _fail(errors, f"teams.json missing {exp['name']}")
            continue
        overlay = hit.get("ecnl") or {}
        rec = overlay.get("record") or hit.get("record") or {}
        got = (
            int(rec.get("w") or 0),
            int(rec.get("d") or 0),
            int(rec.get("l") or 0),
            int(overlay.get("played") or 0),
            int(overlay.get("gf") or 0),
            int(overlay.get("ga") or 0),
        )
        want = (exp["w"], exp["d"], exp["l"], exp["gp"], exp["gf"], exp["ga"])
        if got != want or overlay.get("conferenceRank") != exp["conferenceRank"]:
            _fail(
                errors,
                f"teams.json {exp['name']} want {want} #{exp['conferenceRank']} "
                f"got {got} #{overlay.get('conferenceRank')}",
            )
        else:
            print(f"OK  teams.json {hit.get('id')} {exp['name']} {exp['w']}-{exp['d']}-{exp['l']}")


def verify_ca_tables_present(ecnl: dict, mls: dict, errors: list[str]) -> None:
    """CA Tables read these files — empty ingest means the live SPA ignores standings."""
    norcal = [
        t
        for t in ecnl.get("teams") or []
        if t.get("tier") == "ecnl"
        and t.get("conference") == "Northern Cal"
        and t.get("ageBand") == "U13"
    ]
    if len(norcal) < 10:
        _fail(errors, f"CA table Northern Cal U13 too small ({len(norcal)})")
    names = { (t.get("name") or "").lower() for t in norcal }
    if "marin fc ecnl b2013/14" not in names:
        _fail(errors, "CA table missing Marin FC ECNL B2013/14 on Northern Cal U13")
    if "san francisco elite academy ecnl b2013/14" not in names:
        _fail(errors, "CA table missing SF Elite Academy ECNL B2013/14 (unmatched GotSport listing still belongs on the official table)")
    nw = [
        t
        for t in mls.get("teams") or []
        if t.get("division") == "homegrown"
        and t.get("ageBand") == "U13"
        and t.get("conference") == "Northwest"
    ]
    if len(nw) < 8:
        _fail(errors, f"CA table MLS NEXT Homegrown Northwest U13 too small ({len(nw)})")
    print(f"OK  CA tables NorCal U13 ECNL {len(norcal)} · MLS HG NW U13 {len(nw)}")


def verify_mls_u13_nw(mls: dict, expected: dict, errors: list[str]) -> None:
    live = [
        t
        for t in mls.get("teams") or []
        if t.get("division") == "homegrown"
        and t.get("ageBand") == "U13"
        and t.get("conference") == "Northwest"
    ]
    by_name = {t["name"].lower(): t for t in live}
    for exp in expected["mlsU13NorthwestHomegrown"]:
        hit = by_name.get(exp["name"].lower())
        if hit is None:
            _fail(errors, f"MLS U13 NW missing {exp['name']}")
            continue
        rec = hit.get("record")
        if exp["gp"] == 0:
            empty = rec is None or (
                rec.get("w", 0) == 0 and rec.get("d", 0) == 0 and rec.get("l", 0) == 0
            )
            if empty and int(hit.get("played") or 0) == 0:
                print(f"OK  MLS U13 NW {exp['name']} no completed games")
                continue
        got = _wdl(hit)
        want = (exp["w"], exp["d"], exp["l"], exp["gp"], exp["gf"], exp["ga"])
        if got != want or hit.get("conferenceRank") != exp["conferenceRank"]:
            _fail(
                errors,
                f"MLS U13 NW {exp['name']} want {want} #{exp['conferenceRank']} "
                f"got {got} #{hit.get('conferenceRank')}",
            )
        else:
            print(
                f"OK  MLS U13 NW {exp['name']} {exp['w']}-{exp['d']}-{exp['l']} "
                f"#{exp['conferenceRank']}"
            )


def main() -> int:
    expected = load_expected()
    errors: list[str] = []
    folder = snapshot_dir()
    print("fixture", expected["source"])
    print("snapshot dir", folder or "(not extracted; using committed fixture)")
    print("gotsport", expected["notes"]["gotsport"])

    ecnl = json.loads(ECNL_OUT.read_text())
    mls = json.loads(MLS_OUT.read_text())
    teams = json.loads(TEAMS_OUT.read_text())

    verify_marin(ecnl, expected, errors)
    verify_norcal(ecnl, expected, errors)
    verify_ca_tables_present(ecnl, mls, errors)
    verify_teams_json(teams, expected, errors)
    verify_mls_u13_nw(mls, expected, errors)

    if errors:
        print(f"{len(errors)} mismatch(es)")
        return 1
    print("snapshot verify ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
