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
if isinstance(es, list): es = {x.get("code"): x for x in es}
by = {s["code"]: s for s in d["states"]}
for code, x in es.items():
    s = by.get(code)
    if not s: print("skip unknown state", code); continue
    for k in ("feeds", "county_baselines"):
        if k in x: s[k] = x[k]
    for r in x.get("races", []):
        t = next((q for q in s["races"] if q["race"].lower() == str(r.get("race","")).lower()), None)
        if t is None:
            t = {"race": r.get("race"), "status": "pending", "winner": None, "party": None, "margin": None, "source": None,
                 "candidates": [], "reporting_pct": None, "win_probability": {"status": "results pending", "values": None, "source": None}}
            s["races"].append(t)
        for k, v in r.items():
            if k == "win_probability" and isinstance(v, dict): t[k].update(v)
            elif k in ("candidates",):
                t[k] = [{"name": c.get("name"), "party": c.get("party"), "incumbent": c.get("incumbent", False),
                         "votes": c.get("votes"), "pct": c.get("pct")} for c in v]
            else: t[k] = v
d["lastUpdated"] = datetime.datetime.now().astimezone().isoformat(timespec="minutes")
json.dump(d, open(dst, "w"), indent=2, ensure_ascii=False)
print("merged", len(es), "states into", dst)
