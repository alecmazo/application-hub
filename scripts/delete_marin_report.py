#!/usr/bin/env python3
"""Remove a published Marin FC report page from the repo.

Deletes public/MarinFC-reports/<slug>/, drops that entry from reports.json and
the hub, and records the slug in deleted_reports.json so the generator will not
re-add the page. Does not change season stats or YTD card/trend data.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

PROTECTED_SLUGS = frozenset({
    "assets",
    "season-trend-ab0e5977a9e9",
    "player-cards-4333cd65c796",
    "player-cards-season-cc2378ad382d",
    "player-cards-latest-d2130e467695",
    "player-cards-newark-7cee276873b1",
    "pro-analytics-6feface8946d",
})
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,80}$")
REPORTS_DIR_NAME = "MarinFC-reports"


def repo_root_from(start: Path) -> Path:
    return start.resolve()


def reports_dir(root: Path) -> Path:
    return root / "public" / REPORTS_DIR_NAME


def validate_slug(slug: str) -> str:
    slug = (slug or "").strip()
    if not SLUG_RE.match(slug) or slug in PROTECTED_SLUGS or slug in {"index", "index.html"}:
        raise SystemExit(f"refusing to delete protected or invalid slug: {slug!r}")
    return slug


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def remove_articles_for_slug(html: str, slug: str) -> tuple[str, int]:
    needle = f'href="{slug}/"'
    out = []
    i = 0
    removed = 0
    while True:
        j = html.find(needle, i)
        if j < 0:
            out.append(html[i:])
            break
        start = html.rfind("<article", i, j)
        if start < 0:
            raise SystemExit(f"could not find <article> start for {slug}")
        end = html.find("</article>", j)
        if end < 0:
            raise SystemExit(f"could not find </article> for {slug}")
        end += len("</article>")
        out.append(html[i:start])
        i = end
        if i < len(html) and html[i] == "\n":
            i += 1
        removed += 1
    if removed == 0:
        raise SystemExit(f"hub has no card for {slug}")
    return "".join(out), removed


def bump_hub_counts(html: str, slug: str, original: str) -> str:
    """Decrement the Game Reports or Trends tab count if the card lived in that panel."""
    idx = original.find(f'href="{slug}/"')
    if idx < 0:
        return html
    games_pos = original.find('id="games"')
    trends_pos = original.find('id="trends"')
    in_games = games_pos != -1 and idx > games_pos and (trends_pos == -1 or idx < trends_pos or games_pos > trends_pos)
    # If the slug appears after #games and before #trends, it's a game report.
    if games_pos != -1 and trends_pos != -1:
        in_games = games_pos < idx < trends_pos if games_pos < trends_pos else not (trends_pos < idx < games_pos)
    label = "Game Reports" if in_games else "Trends"

    def dec(m):
        n = int(m.group(1))
        return m.group(0).replace(f">{n}<", f">{max(0, n - 1)}<", 1)

    pattern = rf'(<label for="tab-{"games" if in_games else "trends"}"[^>]*>{re.escape(label)} <span class="count">)(\d+)(</span>)'
    new, n = re.subn(pattern, lambda m: f"{m.group(1)}{max(0, int(m.group(2)) - 1)}{m.group(3)}", html, count=1)
    return new if n else html


def delete_report(root: Path, slug: str, when: str | None = None) -> dict:
    slug = validate_slug(slug)
    reports = reports_dir(root)
    folder = reports / slug
    index = folder / "index.html"
    if not index.is_file():
        raise SystemExit(f"no report at {folder}")

    manifest = reports / "reports.json"
    data = load_json(manifest, {"reports": []})
    entries = data.get("reports") or []
    title = next((e.get("title") for e in entries if e.get("slug") == slug), slug)
    data["reports"] = [e for e in entries if e.get("slug") != slug]
    if len(data["reports"]) == len(entries):
        raise SystemExit(f"reports.json has no entry for {slug}")

    hub_path = reports / "index.html"
    if not hub_path.is_file():
        raise SystemExit("hub index.html is missing")
    hub = hub_path.read_text(encoding="utf-8")
    new_hub, removed = remove_articles_for_slug(hub, slug)
    new_hub = bump_hub_counts(new_hub, slug, hub)

    deleted_path = reports / "deleted_reports.json"
    deleted = load_json(deleted_path, {"deleted": []})
    items = deleted.get("deleted") or []
    if not any((i.get("slug") if isinstance(i, dict) else i) == slug for i in items):
        items.append({
            "slug": slug,
            "title": title,
            "deleted_at": when or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
    deleted["deleted"] = items

    # Writes after all checks pass.
    import shutil
    shutil.rmtree(folder)
    manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    deleted_path.write_text(json.dumps(deleted, indent=2) + "\n", encoding="utf-8")
    hub_path.write_text(new_hub, encoding="utf-8")
    return {"slug": slug, "title": title, "cards_removed": removed, "season_data_changed": False}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("slug")
    p.add_argument("--root", type=Path, default=Path.cwd())
    args = p.parse_args(argv)
    result = delete_report(args.root, args.slug)
    print(f"deleted {result['slug']} ({result['title']}); season stats unchanged")
    return 0


if __name__ == "__main__":
    sys.exit(main())
