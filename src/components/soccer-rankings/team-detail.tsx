import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRecord, formatScore, leagueDisplayLabel, publishedRecord } from "@/lib/soccer-rankings/compute";
import { alignmentLabel } from "@/lib/soccer-rankings/load";
import {
  HOME_CONTINUITY_COPY,
  HOME_LABEL,
  isHomeTeam,
  isPinnedHomeTeam,
  showHomeContinuity,
} from "@/lib/soccer-rankings/home";
import { PinHomeButton } from "./pin-home-button";
import {
  byGotsportId,
  eventHref,
  loadTeamMatches,
  matchFocusId,
  matchesApiHref,
  mlsNextScheduleHref,
  mlsOverlayFromTeam,
  notOnPublicFeedFor,
  opponentCue,
  opponentOf,
  refreshTeamMatches,
  resultFor,
  summarizeSos,
} from "@/lib/soccer-rankings/matches";
import type {
  CompactMatch,
  MatchLoadResult,
  RankedTeam,
} from "@/lib/soccer-rankings/types";
import { cn } from "@/lib/utils";
import { MatchupDetail } from "./matchup-detail";

export function TeamDetail({
  team,
  yearTeams,
  onOpenTeam,
  pinnedHomeId,
  onPinHome,
  onUnpinHome,
  refreshNonce = 0,
  prominentRefresh = false,
  showRefresh = true,
}: {
  team: RankedTeam;
  yearTeams: RankedTeam[];
  onOpenTeam: (teamId: string) => void;
  pinnedHomeId: string | null;
  onPinHome: (id: string) => void;
  onUnpinHome: () => void;
  refreshNonce?: number;
  prominentRefresh?: boolean;
  showRefresh?: boolean;
}) {
  const [load, setLoad] = useState<MatchLoadResult | null>(null);
  const [selected, setSelected] = useState<CompactMatch | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const overlay = useMemo(
    () => mlsOverlayFromTeam(team),
    [team.id, team.ageBand, team.mlsNext?.orgId, team.mlsNext?.division],
  );
  const index = useMemo(
    () => byGotsportId(yearTeams, overlay?.division),
    [yearTeams, overlay?.division],
  );

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    setSelected(null);
    void loadTeamMatches(team.id, {
      gotsportTeamId: team.gotsportTeamId ?? null,
      mlsNext: overlay,
    }).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [team.id, team.gotsportTeamId, overlay, refreshNonce]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshTeamMatches(team.id, {
        gotsportTeamId: team.gotsportTeamId ?? null,
        mlsNext: overlay,
      });
      setLoad(result);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!selected) return;
    document.getElementById("matchup-detail")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selected]);

  const focusId =
    load != null ? matchFocusId(load, overlay) : (overlay?.orgId ?? null);
  const sos =
    load && focusId != null
      ? summarizeSos(focusId, load.matches, index)
      : null;
  const missingFeed = notOnPublicFeedFor(focusId ?? null);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Team
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold leading-tight">
            {team.name}
          </h2>
          <PinHomeButton
            teamId={team.id}
            teamName={team.name}
            pinned={isPinnedHomeTeam(team.id, pinnedHomeId)}
            onPin={onPinHome}
            onUnpin={onUnpinHome}
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {team.club !== team.name ? `${team.club} · ` : ""}
          {team.state}
        </p>
        {isPinnedHomeTeam(team.id, pinnedHomeId) && (
          <div className="mt-2 space-y-1.5">
            <Badge variant="success">
              {isHomeTeam(team.id) ? HOME_LABEL : "Home"}
            </Badge>
            {showHomeContinuity(pinnedHomeId) && (
              <p className="text-sm font-medium text-foreground">
                {HOME_CONTINUITY_COPY}
              </p>
            )}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Chip label="US rank" value={`#${team.usRank}`} />
          <Chip label={`${team.state} rank`} value={`#${team.stateRank}`} />
          <Chip
            label="Record"
            value={formatRecord(
              publishedRecord(team) ?? load?.record,
            )}
          />
          <Chip label="Score" value={formatScore(team.score)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="outline">{leagueDisplayLabel(team.league, team.leagueLabel)}</Badge>
          {alignmentLabel(team.ageAlignment) && (
            <Badge variant="secondary">{alignmentLabel(team.ageAlignment)}</Badge>
          )}
          {team.mlsNext?.conference && (
            <Badge variant="success">
              MLS NEXT {team.mlsNext.conference}
              {team.mlsNext.conferenceRank
                ? ` #${team.mlsNext.conferenceRank}`
                : ""}
            </Badge>
          )}
          {team.ecnl?.conference && (
            <Badge variant="accent">
              {team.ecnl.tier === "ecnl-rl" ? "ECNL-RL" : "ECNL"}{" "}
              {team.ecnl.conference}
              {team.ecnl.conferenceRank ? ` #${team.ecnl.conferenceRank}` : ""}
              {team.ecnl.gf != null && team.ecnl.ga != null
                ? ` · ${team.ecnl.gf}–${team.ecnl.ga}`
                : ""}
            </Badge>
          )}
        </div>
      </div>

      {missingFeed?.status === "not_yet_on_gotsport_public_feed" && (
        <div className="rounded-xl border border-warn/35 bg-warn/10 px-3 py-2.5 text-xs leading-relaxed">
          <p className="font-medium text-foreground">
            Not yet on GotSport public feed
          </p>
          <p className="mt-1 text-muted-foreground">
            Reported {missingFeed.date}
            {missingFeed.timezone ? ` (${missingFeed.timezone})` : ""}:{" "}
            {missingFeed.reported}. The public GotSport match lists and rankings
            UI did not include this game as of this refresh, so no 1–0 is shown.
          </p>
        </div>
      )}

      {sos && (
        <div className="rounded-xl border border-border bg-bg-elevated/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Strength of schedule</p>
          <p className="mt-1">
            {sos.played} scored games in this list · {sos.opponentsInSeed}{" "}
            opponents in the seed
            {sos.medianOpponentUsRank != null
              ? ` · median opponent US #${sos.medianOpponentUsRank}`
              : ""}
            {` · ${sos.top50Us} top-50 US · ${sos.top100Us} top-100 US · ${sos.top10State} top-10 in their state`}
            . Unofficial composite among seeded teams.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {showRefresh && (
          <Button
            type="button"
            variant={prominentRefresh ? "default" : "outline"}
            size={prominentRefresh ? "default" : "sm"}
            onClick={() => void onRefresh()}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {prominentRefresh ? "Refresh matches" : "Refresh"}
          </Button>
        )}
        {overlay && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={mlsNextScheduleHref(overlay.division)}
              target="_blank"
              rel="noreferrer"
            >
              Raw Homegrown / MLS NEXT schedule JSON
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
        {load?.gotsportTeamId != null && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={matchesApiHref(load.gotsportTeamId)}
              target="_blank"
              rel="noreferrer"
            >
              Raw GotSport matches JSON
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>

      {!load && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading match list…
        </p>
      )}

      {load && (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {load.source === "live" &&
              "Live pull replaced this team’s schedule/record."}
            {load.source === "cache" &&
              `Shipped cache since ${load.since} — coverage may be partial.`}
            {load.source === "none" && (load.error ?? "No match list yet.")}{" "}
            Scores are only shown when the public feed published both. Nothing
            is invented.
          </p>
          {(load.endpointsTried?.length ?? 0) > 0 && load.matches.length === 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Endpoints tried:{" "}
              <span className="font-mono text-[11px]">
                {load.endpointsTried.join(" · ")}
              </span>
            </p>
          )}

          {selected && focusId != null && (
            <div
              id="matchup-detail"
              className="scroll-mt-4 rounded-2xl border border-primary/30 bg-card p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Matchup
                </p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
              <MatchupDetail
                match={selected}
                focusId={focusId}
                home={
                  selected.homeId != null
                    ? index.get(selected.homeId)
                    : undefined
                }
                away={
                  selected.awayId != null
                    ? index.get(selected.awayId)
                    : undefined
                }
                onOpenTeam={onOpenTeam}
              />
            </div>
          )}

          {load.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {load.error ??
                "Public feed returned no matches after the pull. Nothing was invented."}
            </p>
          ) : (
            <ol className="divide-y divide-border rounded-xl border border-border">
              {load.matches.map((m) => {
                const opp = focusId != null ? opponentOf(focusId, m) : null;
                const oppSeed = opp?.id != null ? index.get(opp.id) : undefined;
                const result = focusId != null ? resultFor(focusId, m) : null;
                const cue = opponentCue(
                  oppSeed?.usRank,
                  oppSeed?.stateRank,
                  oppSeed?.state,
                );
                const href = eventHref(m.eventId);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(m)}
                      className="flex w-full flex-col gap-1 px-3 py-2.5 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {m.date ?? "Date N/A"} · {m.kind}
                          {m.event ? ` · ${m.event}` : ""}
                        </p>
                        <p className="font-medium">
                          vs {opp?.name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {oppSeed
                            ? `Opp US #${oppSeed.usRank} · ${oppSeed.state} #${oppSeed.stateRank} · ${cue}`
                            : "Opponent not in this seed"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-mono-num text-sm font-semibold",
                            result === "W" && "text-success",
                            result === "L" && "text-destructive",
                          )}
                        >
                          {m.homeScore != null && m.awayScore != null
                            ? `${m.homeScore}–${m.awayScore}`
                            : "N/A"}
                        </span>
                        {result && (
                          <Badge
                            variant={
                              result === "W"
                                ? "success"
                                : result === "L"
                                  ? "outline"
                                  : "secondary"
                            }
                          >
                            {result}
                          </Badge>
                        )}
                      </div>
                    </button>
                    {href && (
                      <p className="px-3 pb-2 text-[11px]">
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          Event on GotSport
                        </a>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono-num text-sm font-semibold">{value}</p>
    </div>
  );
}
