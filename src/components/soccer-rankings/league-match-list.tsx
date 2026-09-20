import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  leagueOpponent,
  leagueResultFor,
  loadLeagueMatches,
  type LeagueMatchLoad,
} from "@/lib/soccer-rankings/league-matches";
import type { LeagueTableRow } from "@/lib/soccer-rankings/league-tables";
import { HOME_LABEL } from "@/lib/soccer-rankings/home";
import { cn } from "@/lib/utils";

export function LeagueMatchList({
  row,
  compact = false,
}: {
  row: LeagueTableRow;
  compact?: boolean;
}) {
  const [load, setLoad] = useState<LeagueMatchLoad | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    void loadLeagueMatches(row).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [row.key, row.athleteOneTeamId, row.orgId, row.ageBand, row.pathway]);

  if (!load) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading {row.tierLabel} results…
      </p>
    );
  }

  return (
    <div
      id="league-match-list"
      className={cn("space-y-3", compact && "space-y-2")}
    >
      <div>
        <p className="text-sm font-semibold">
          {row.name}
          {row.homeHighlight ? ` · ${HOME_LABEL}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.tierLabel} · {row.conference} · {row.ageBand} · Pos {row.pos}
          {row.sourcePos && row.sourcePos !== row.pos
            ? ` (source place ${row.sourcePos})`
            : ""}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Conference games only — not cups or other platforms. Scores appear only
        when AthleteOne box score / MLS NEXT League Viewer published both.
        Nothing invented.
      </p>
      {load.error && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {load.error}
        </p>
      )}
      {load.matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No public league games in this feed. If a result is missing, it is
          not on the public schedule.
        </p>
      ) : (
        <ol className="space-y-2">
          {load.matches.map((m) => {
            const opp = leagueOpponent(load, m);
            const result = leagueResultFor(load, m);
            const scored = m.homeScore != null && m.awayScore != null;
            return (
              <li
                key={`${m.id}-${m.date}-${opp.name}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">
                    {m.date ?? "Date N/A"}
                    {m.event ? ` · ${m.event}` : ""}
                  </p>
                  <p className="truncate text-sm font-medium">
                    vs {opp.name}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono-num text-sm font-semibold">
                    {scored ? `${m.homeScore}–${m.awayScore}` : "N/A"}
                  </span>
                  {result && (
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                        result === "W" && "bg-primary text-primary-foreground",
                        result === "D" && "bg-muted text-muted-foreground",
                        result === "L" &&
                          "border border-border text-muted-foreground",
                      )}
                    >
                      {result}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
