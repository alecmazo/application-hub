import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AGE_LEGEND } from "@/lib/soccer-rankings/age-map";
import {
  HOME_CONTINUITY_COPY,
  HOME_LABEL,
} from "@/lib/soccer-rankings/home";
import { useRankings } from "./rankings-context";

export function MethodologyCard() {
  const { showMethod, setShowMethod } = useRankings();
  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="inline-flex items-center gap-2 font-display text-lg">
            <BookOpen className="size-4 text-primary" />
            Methodology & sources
          </CardTitle>
          <CardDescription className="mt-1">
            Honest composite. No official MLS / ECNL / GotSport affiliation.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMethod((v) => !v)}
        >
          {showMethod ? "Hide" : "About"}
        </Button>
      </CardHeader>
      {showMethod && (
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Pinned home:</strong> Highlight
            only — pin any side from a row or team page, or unpin entirely.
            Default pin is {HOME_LABEL} (
            <code className="font-mono text-xs">56506</code>
            ). Continuity ({HOME_CONTINUITY_COPY}) shows only while that Marin
            2013/14 ECNL side is pinned. Marin FC Blue 2014/15 (
            <code className="font-mono text-xs">252973</code>) is a separate
            line — never last-year continuity. Browse and search stay unlocked.
          </p>
          <p>
            <strong className="text-foreground">Age tabs U12–U16:</strong>{" "}
            {AGE_LEGEND} MLS NEXT U13 = 2014 BY (official 2026–27 Homegrown).
            ECNL U13 ≈ 2013/14 school year. MLS NEXT sides are never forced onto
            school-year labels.
          </p>
          <p>
            Ranks are computed in-browser from a public GotSport ingest plus a
            few published TDS / MLS NEXT Cup overlays.{" "}
            <strong className="text-foreground">usRank</strong> sorts composite
            score among seeded teams in this age tab.{" "}
            <strong className="text-foreground">stateRank</strong> is among
            seeded teams in that state — not every club that exists.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              GotSport public rankings API (boys U12–U16, USA), including Cal
              South (CAS) and Cal North (CAN).
            </li>
            <li>
              GotSport public match lists:{" "}
              <code className="font-mono text-xs">
                GET /api/v1/teams/{"{id}"}/matches
              </code>{" "}
              (league season + tournaments). Shipped cache + live via the Vite{" "}
              <code className="font-mono text-xs">/gotsport-api</code> proxy.
              GitHub Pages cannot call GotSport directly (no CORS).
            </li>
            <li>
              ECNL AthleteOne conference standings (
              <code className="font-mono text-xs">
                api.athleteone.com/api/Script/get-conference-standings
              </code>
              , Referer theecnl.com): ECNL Tier 1 + ECNL-RL Tier 2 for CA
              conferences (Northern Cal / NorCal, Far West, Southwest, Golden
              State, Southern Cal). Boys U13–U16 only. Conference-specific
              division IDs from the page; a mismatched age heading is dropped.
              HTML table; no invented scores.
            </li>
            <li>
              MLS NEXT Homegrown / Academy public League Viewer JSON on{" "}
              <code className="font-mono text-xs">
                mls-assist.theintelligenceplatform.com
              </code>{" "}
              (same files the official standings viewer loads). Homegrown U13 =
              2014 BY. Team Refresh pulls that schedule API first; the
              mlssoccer.com Homegrown standings page is fallback discovery only.
            </li>
            <li>
              MLS NEXT Cup 2026 U13 recaps applied to the 2014 view (Atlanta
              United champion; LA Galaxy finalist; Inter Miami semifinalist).
            </li>
            <li>
              TopDrawerSoccer TeamRank boys U13, which TDS labeled as the 2013
              birth year, overlaid on matching 2013-view clubs.
            </li>
          </ul>
          <p>
            Refresh (CA three-source):{" "}
            <code className="font-mono text-xs text-foreground">
              ingest-ecnl-athleteone.py
            </code>
            ,{" "}
            <code className="font-mono text-xs text-foreground">
              ingest-soccer-rankings.py --ca-refresh
            </code>
            ,{" "}
            <code className="font-mono text-xs text-foreground">
              ingest-gotsport-matches.py
            </code>
            . See{" "}
            <code className="font-mono text-xs text-foreground">
              src/data/soccer-rankings/METHODOLOGY.md
            </code>
            .
          </p>
        </CardContent>
      )}
    </Card>
  );
}
