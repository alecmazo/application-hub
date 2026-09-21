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
            Default layout is <strong className="text-foreground">Matchday Cards</strong>.
            Split is an alternate on the Layout control.
          </p>
          <p>
            Ranks are computed in-browser from a public GotSport ingest plus a
            few published TDS / MLS NEXT Cup overlays.{" "}
            <strong className="text-foreground">usRank</strong> sorts composite
            score among seeded teams in this age tab.{" "}
            <strong className="text-foreground">stateRank</strong> is among
            seeded teams in that state — not every club that exists.
          </p>
          <p>
            <strong className="text-foreground">CA Tables</strong> are official
            conference standings from the ingested MLS NEXT League Viewer and
            ECNL AthleteOne JSON (Northern Cal first; Far West / Southwest as
            CA).             Columns are Pos, GP, W–D–L, GF, GA, GD, Pts (3×W+D) and PPG.
            Display Pos is Pts then GD (then GF, then name) — not the source
            place if it disagrees. Click a side for that conference’s games
            only (AthleteOne get-individual-team-info RESULTS, or MLS NEXT
            League Viewer). Unmatched AthleteOne sides stay off
            the composite list but still appear on the CA table. Marin FC is
            highlighted; Blue 2014/15 is not home. The CA Tables{" "}
            <strong className="text-foreground">Refresh</strong> updates only
            the table on screen (one pathway, age, and conference — for example
            ECNL · Northern Cal · BU13). It re-fetches that AthleteOne
            standings page, get-individual-team-info for teams on that table,
            or that MLS NEXT division’s League Viewer JSON. Local dev uses the
            Vite proxy. GitHub Pages uses the Jina reader, which can send
            Referer https://theecnl.com — the browser cannot. Other conferences
            stay on the shipped rows. Nothing is invented.
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
              , Referer theecnl.com; Sidearm page loads
              public.totalglobalsports.com/standings.min.js with
              data-org-season-id 81 / 83). Refresh loads the open
              conference and age only. Northern Cal is the verification
              priority. ECNL = Tier 1; ECNL-RL = Tier 2 (separate from MLS NEXT
              Homegrown T1 / Academy T2). Conference-specific division IDs;
              national 22184–22189 on a conference event still serve BU13 and
              are dropped when the heading mismatches. HTML table; no invented
              scores. A dated CA snapshot under uploads/ is seed/verify only —
              live AthleteOne still refreshes. Snapshot GotSport ranking_data
              (~20 rows, 0 CA boys) is not used.
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
