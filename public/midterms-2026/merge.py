#!/usr/bin/env python3
"""Merge an election-detail file (candidates, county baselines, feed URLs) into data.json.
Usage: python3 merge.py /workspace/election2026/data.json [data.json]
Accepted input shapes: {"states": {"KS": {...}}} or {"states": [{"code":"KS", ...}]}.
Per state it copies: races (matched by "race" name, else appended), feeds, county_baselines.
Nothing is computed or invented; missing values stay null (rendered as 'pending')."""
import json, sys, datetime
src, dst = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "data.json")
e, d = json.load(open(src)), json.load(open(dst))
es = e.get("states", {})
if not es and "candidates" in e:  # election2026 format: top-level dicts keyed by state code
    es = {}
    cb = (e.get("county_baseline") or {}).get("counties", {})
    pr = (e.get("probability") or {}).get("by_state", {})
    codes = set(e["candidates"]) | set(e.get("feeds", {})) | set(e.get("party_turnout", {})) | {k for k in ("AK", "GA") if k in e}
    for code in codes:
        c = e["candidates"].get(code, {})
        x = {"races": [], "candidate_source": c.get("source"), "candidate_source_url": c.get("source_url"),
             "candidate_verification": c.get("verification")}
        for key, name in (("governor", "Governor"), ("senate", "U.S. Senate")):
            if c.get(key):
                p = pr.get(code, {}).get(key)
                x["races"].append({"race": name, "candidates": [{"name": n, "party": pt} for n, pt in c[key]],
                                   "win_probability": {"status": "results pending" if p is None else "reported",
                                                       "values": p if isinstance(p, dict) else None, "source": None}})
        f = e.get("feeds", {}).get(code)
        if f:
            x["feeds"] = ([{"label": "Statewide results", "url": f["state"], "type": "statewide"}] if f.get("state") else []) + \
                         [{"label": k + " County", "url": u, "type": "county"} for k, u in (f.get("counties") or {}).items()]
        cbd = e.get("county_baseline") or {}
        rows = cb.get(code)
        if rows:
            is22 = cbd.get("year") == 2022 or any(k.endswith("_2022") for k in rows[0])
            is24 = cbd.get("year") == 2024 or any(k.endswith("_2024") for k in rows[0])
            if is22 and not is24:
                x["county_baselines_2022"] = rows; x["county_baselines_2022_note"] = cbd.get("description")
            elif is24:  # legacy 2024 data -> 2024 reference tab only
                x["county_baselines_2024"] = rows; x["county_baselines_2024_note"] = cbd.get("description")
        for src_k, dst_k in (("countyBaselines2022", "county_baselines_2022"), ("partyRegistration2022", "party_registration_2022"),
                             ("partyTurnout2022", "party_turnout_2022")):
            if code in (e.get(src_k) or {}): x[dst_k] = e[src_k][code]
        if code in e.get("party_turnout", {}): x["party_turnout"] = e["party_turnout"][code]
        if code in e["candidates"]: x["no_senate_race"] = not c.get("senate")
        if isinstance(e.get(code), dict):  # optional top-level block, e.g. e["AK"] = {turnout fields, y2022, ...}
            x.update({k: v for k, v in e[code].items() if k not in x})
        es[code] = x
if isinstance(es, list): es = {x.get("code"): x for x in es}
by = {s["code"]: s for s in d["states"]}
for s in d["states"]:  # old unlabeled key held 2024 data; superseded by county_baselines_2024
    if "county_baselines" in s:
        s.setdefault("county_baselines_2024", s.pop("county_baselines")); s.setdefault("county_baselines_2024_note", s.pop("county_baselines_note", None))
for k in ("aggregate", "baselines2024"):
    if e.get(k) is not None: d[k] = e[k]
for code, x in es.items():
    s = by.get(code)
    if not s:  # new state (e.g. AK, GA): skeleton with nulls; nothing invented
        s = {"code": code, "name": x.get("name") or {"AK": "Alaska", "GA": "Georgia"}.get(code, code),
             "early_in_person": None, "early_in_person_note": None, "mail_returned": None, "total_cast": None,
             "early_data_as_of": None, "registered": None, "registered_note": None, "election_day_turnout": None,
             "expected_vote_counted_pct": None, "polls_close_pt": None,
             "y2022": {"early_in_person": None, "mail_returned": None, "early_total": None, "total_turnout": None,
                       "vep": None, "vep_turnout_pct": None, "headline_results": None},
             "races": [], "feeds": []}
        d["states"].append(s); by[code] = s
    for k in ("name", "early_in_person", "early_in_person_note", "mail_returned", "total_cast", "early_data_as_of",
              "registered", "registered_note", "election_day_turnout", "expected_vote_counted_pct", "polls_close_pt"):
        if x.get(k) is not None: s[k] = x[k]
    if isinstance(x.get("y2022"), dict): s["y2022"].update({k: v for k, v in x["y2022"].items() if v is not None})
    for k in ("feeds", "county_baselines_2022", "county_baselines_2022_note", "county_baselines_2024", "county_baselines_2024_note", "party_turnout", "party_registration_2022", "party_turnout_2022", "candidate_source", "candidate_source_url", "candidate_verification", "no_senate_race"):
        if k in x: s[k] = x[k]
    for r in x.get("races", []):
        t = next((q for q in s["races"] if q["race"].lower().startswith(str(r.get("race","")).lower())), None)
        if t is None:
            t = {"race": r.get("race"), "status": "pending", "winner": None, "party": None, "margin": None, "source": None,
                 "candidates": [], "reporting_pct": None, "win_probability": {"status": "results pending", "values": None, "source": None}}
            s["races"].append(t)
        for k, v in r.items():
            if k == "win_probability" and isinstance(v, dict): t[k].update(v)
            elif k == "race": continue
            elif k in ("candidates",):
                t[k] = [{"name": c.get("name"), "party": c.get("party"), "incumbent": c.get("incumbent"),
                         "votes": c.get("votes"), "pct": c.get("pct")} for c in v]
            else: t[k] = v
now = datetime.datetime.now().astimezone()
d["lastUpdated"] = now.isoformat(timespec="minutes")
d["lastUpdatedLabel"] = now.strftime("%a %b %-d, %Y, %-I:%M %p PT")
json.dump(d, open(dst, "w"), indent=2, ensure_ascii=False)
print("merged", len(es), "states into", dst)
