#!/usr/bin/env python3
import json
import shutil
import tempfile
import unittest
from pathlib import Path
import importlib.util

SPEC = importlib.util.spec_from_file_location(
    "delete_marin_report", Path(__file__).with_name("delete_marin_report.py")
)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)


def fixture(tmp: Path):
    reports = tmp / "public" / "MarinFC-reports"
    game = "game-davis-legacy-2026-11-15-9c86fb2e5fba"
    trend = "season-trend-ab0e5977a9e9"
    earlier = "passing-and-control-91f2292b8b5f"
    for slug in (game, trend, earlier, "player-cards-4333cd65c796"):
        d = reports / slug
        d.mkdir(parents=True)
        (d / "index.html").write_text(f"<html><body>{slug}</body></html>\n", encoding="utf-8")
    reports_json = {
        "reports": [
            {"slug": earlier, "title": "Passing & Control", "date": "2026-11-10"},
            {"slug": game, "title": "Game Report: Marin 5-0 Davis Legacy (Nov 15)", "date": "2026-11-15"},
            {"slug": trend, "title": "Season Trend Report (YTD)", "date": "2026-11-18"},
            {"slug": "player-cards-4333cd65c796", "title": "Player Cards (Last 5 Games)", "date": "2026-11-25"},
        ]
    }
    (reports / "reports.json").write_text(json.dumps(reports_json, indent=2) + "\n", encoding="utf-8")
    (reports / "index.html").write_text(
        """<!DOCTYPE html>
<html><body>
<label for="tab-games" class="tab">Game Reports <span class="count">1</span></label>
<label for="tab-trends" class="tab">Trends <span class="count">3</span></label>
<section class="panel" id="games">
<article class="card"><a class="card-main" href="game-davis-legacy-2026-11-15-9c86fb2e5fba/"><h3>Davis Legacy</h3></a></article>
</section>
<section class="panel" id="trends">
<article class="card featured"><a class="card-main" href="season-trend-ab0e5977a9e9/"><h3>Season Trend</h3></a></article>
<article class="card"><a class="card-main" href="player-cards-4333cd65c796/"><h3>Cards</h3></a></article>
<article class="card"><a class="card-main" href="passing-and-control-91f2292b8b5f/"><h3>Passing</h3></a></article>
</section>
</body></html>
""",
        encoding="utf-8",
    )
    (tmp / "season_data.json").write_text('{"keep": true}\n', encoding="utf-8")
    return game, earlier, trend


class DeleteReportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.game, self.earlier, self.trend = fixture(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_deletes_game_report_and_records_slug(self):
        result = mod.delete_report(self.tmp, self.game, when="2026-11-25T20:00:00Z")
        self.assertEqual(result["season_data_changed"], False)
        reports = self.tmp / "public" / "MarinFC-reports"
        self.assertFalse((reports / self.game).exists())
        slugs = [e["slug"] for e in json.loads((reports / "reports.json").read_text())["reports"]]
        self.assertNotIn(self.game, slugs)
        self.assertIn(self.trend, slugs)
        hidden = json.loads((reports / "deleted_reports.json").read_text())["deleted"]
        self.assertEqual(hidden[0]["slug"], self.game)
        hub = (reports / "index.html").read_text()
        self.assertNotIn(self.game, hub)
        self.assertIn(self.trend, hub)
        self.assertIn('Game Reports <span class="count">0</span>', hub)
        self.assertIn('Trends <span class="count">3</span>', hub)
        self.assertEqual((self.tmp / "season_data.json").read_text(), '{"keep": true}\n')

    def test_deletes_earlier_analysis_and_drops_trends_count(self):
        mod.delete_report(self.tmp, self.earlier, when="2026-11-25T20:00:00Z")
        hub = (self.tmp / "public" / "MarinFC-reports" / "index.html").read_text()
        self.assertNotIn(self.earlier, hub)
        self.assertIn('Trends <span class="count">2</span>', hub)
        self.assertIn('Game Reports <span class="count">1</span>', hub)

    def test_refuses_protected_and_missing(self):
        with self.assertRaises(SystemExit):
            mod.delete_report(self.tmp, self.trend)
        with self.assertRaises(SystemExit):
            mod.delete_report(self.tmp, "assets")
        with self.assertRaises(SystemExit):
            mod.delete_report(self.tmp, "../secrets")
        with self.assertRaises(SystemExit):
            mod.delete_report(self.tmp, "game-does-not-exist-aaaaaaaaaaaa")
        self.assertTrue((self.tmp / "public" / "MarinFC-reports" / self.trend / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()
