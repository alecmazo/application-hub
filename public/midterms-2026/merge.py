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
    for code, c in e["candidates"].items():
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
        if code in cb:
            x["county_baselines"] = cb[code]
            x["county_baselines_note"] = (e.get("county_baseline") or {}).get("description")
        if code in e.get("party_turnout", {}): x["party_turnout"] = e["party_turnout"][code]
        x["no_senate_race"] = not c.get("senate")
        es[code] = x
if isinstance(es, list): es = {x.get("code"): x for x in es}
by = {s["code"]: s for s in d["states"]}
for code, x in es.items():
    s = by.get(code)
    if not s: print("skip unknown state", code); continue
    for k in ("feeds", "county_baselines", "county_baselines_note", "party_turnout", "candidate_source", "candidate_source_url", "candidate_verification", "no_senate_race"):
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
