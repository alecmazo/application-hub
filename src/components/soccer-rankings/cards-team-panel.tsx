import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatRecord,
  leagueDisplayLabel,
  publishedRecord,
} from "@/lib/soccer-rankings/compute";
import { leaguePoints } from "@/lib/soccer-rankings/league-tables";
import { HOME_LABEL, isHomeTeam } from "@/lib/soccer-rankings/home";
import {
  loadTeamMatches,
  matchFocusId,
  mlsOverlayFromTeam,
  opponentOf,
  resultFor,
} from "@/lib/soccer-rankings/matches";
import { leagueBadgeVariant } from "@/lib/soccer-rankings/use-soccer-rankings";
import type { CompactMatch, MatchLoadResult, RankedTeam } from "@/lib/soccer-rankings/types";
import { cn } from "@/lib/utils";
import { LeagueMatchList } from "./league-match-list";
import { useRankings } from "./rankings-context";

type PanelTab = "overview" | "schedule" | "stats";

export function CardsTeamPanel() {
  const {
    selected,
    pinnedTeam,
    closeTeam,
    openTeam,
    teams,
    caInYear,
    matchRefreshNonce,
    caTableFocus,
    pageView,
  } = useRankings();
  const team = selected ?? (pageView === "ca-tables" ? undefined : pinnedTeam);
  const [tab, setTab] = useState<PanelTab>("overview");

  useEffect(() => {
    setTab(caTableFocus ? "schedule" : "overview");
  }, [team?.id, caTableFocus?.key]);

  if (!team && !caTableFocus) {
    return (
      <aside className="hidden w-[22rem] shrink-0 border-l border-border bg-card xl:flex xl:flex-col">
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Pin a home team or open a row for overview and recent matches.
        </div>
      </aside>
    );
  }

  if (!team && caTableFocus) {
    return (
      <aside
        id="team-page"
        className="flex w-full shrink-0 flex-col border-t border-border bg-card xl:w-[22rem] xl:border-l xl:border-t-0"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-5">
          <div className="min-w-0">
            <TeamMark name={caTableFocus.name} />
            <h2 className="mt-3 text-lg font-semibold leading-tight tracking-tight">
              {caTableFocus.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {caTableFocus.tierLabel} · {caTableFocus.conference}
            </p>
          </div>
          <button
            type="button"
            onClick={closeTeam}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close team panel"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <LeagueMatchList row={caTableFocus} compact />
        </div>
      </aside>
    );
  }

  if (!team) return null;

  return (
    <aside
      id="team-page"
      className="flex w-full shrink-0 flex-col border-t border-border bg-card xl:w-[22rem] xl:border-l xl:border-t-0"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-5">
        <div className="min-w-0">
          <TeamMark name={team.name} />
          <h2 className="mt-3 text-lg font-semibold leading-tight tracking-tight">
            {team.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[team.city, team.state === "CA" ? "California" : team.state]
              .filter(Boolean)
              .join(", ")}
          </p>
          <Badge variant={leagueBadgeVariant(team.league)} className="mt-2">
            {leagueDisplayLabel(team.league, team.leagueLabel)}
          </Badge>
        </div>
        {selected && (
          <button
            type="button"
            onClick={closeTeam}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close team panel"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-border px-5 py-4">
        <RankStat
          label="US"
          value={`#${team.usRank}`}
          hint={`${teams.length.toLocaleString()} teams`}
        />
        <RankStat
          label={team.state}
          value={`#${team.stateRank}`}
          hint={
            team.state === "CA"
              ? `${caInYear.toLocaleString()} teams`
              : "seeded in state"
          }
        />
      </div>

      <div
        className="flex gap-1 border-b border-border px-3"
        role="tablist"
        aria-label="Team panel"
      >
        {(
          [
            ["overview", "Overview"],
            ["schedule", "Schedule"],
            ["stats", "Stats"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "relative h-10 px-3 text-sm font-medium",
              tab === key
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {tab === key && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "overview" && <Overview team={team} />}
        {tab === "schedule" &&
          (caTableFocus ? (
            <LeagueMatchList row={caTableFocus} compact />
          ) : (
            <RecentMatches team={team} nonce={matchRefreshNonce} />
          ))}
        {tab === "stats" && <Stats team={team} />}
      </div>

      <div className="border-t border-border px-5 py-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => openTeam(team.id, { scroll: false })}
        >
          View team profile
        </Button>
      </div>
    </aside>
  );
}

function Overview({ team }: { team: RankedTeam }) {
  const rec = publishedRecord(team);
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {isHomeTeam(team.id) ? `Pinned · ${HOME_LABEL}` : "Selected team"}
      </p>
      <dl className="grid grid-cols-2 gap-3">
        <Fact label="Record" value={formatRecord(rec)} />
        <Fact
          label="Pts"
          value={rec ? String(leaguePoints(rec.w, rec.d, rec.l)) : "—"}
        />
        <Fact
          label="Conference"
          value={
            team.ecnl?.conference ??
            team.mlsNext?.conference ??
            "—"
          }
        />
        <Fact
          label="Place"
          value={
            team.ecnl?.conferenceRank
              ? `#${team.ecnl.conferenceRank}`
              : team.mlsNext?.conferenceRank
                ? `#${team.mlsNext.conferenceRank}`
                : "—"
          }
        />
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Official conference W–D–L is from AthleteOne / MLS NEXT League Viewer.
        US and state ranks are the unofficial composite among seeded teams.
        No invented scores.
      </p>
    </div>
  );
}

function Stats({ team }: { team: RankedTeam }) {
  const rec = publishedRecord(team);
  const gf = team.mlsNext?.gf ?? team.ecnl?.gf;
  const ga = team.mlsNext?.ga ?? team.ecnl?.ga;
  const gp =
    team.mlsNext?.played ??
    team.ecnl?.played ??
    (rec ? rec.w + rec.d + rec.l : undefined);
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3">
        <Fact label="GP" value={gp != null ? String(gp) : "—"} />
        <Fact label="W–D–L" value={formatRecord(rec)} />
        <Fact
          label="GF–GA"
          value={gf != null && ga != null ? `${gf}–${ga}` : "—"}
        />
        <Fact
          label="GD"
          value={
            gf != null && ga != null
              ? gf - ga > 0
                ? `+${gf - ga}`
                : String(gf - ga)
              : "—"
          }
        />
      </dl>
      <p className="text-xs text-muted-foreground">
        Stats are published conference numbers only. Empty stays empty.
      </p>
    </div>
  );
}

function RecentMatches({
  team,
  nonce,
}: {
  team: RankedTeam;
  nonce: number;
}) {
  const [load, setLoad] = useState<MatchLoadResult | null>(null);
  const overlay = useMemo(
    () => mlsOverlayFromTeam(team),
    [team.id, team.ageBand, team.mlsNext?.orgId, team.mlsNext?.division],
  );

  useEffect(() => {
    let cancelled = false;
    setLoad(null);
    void loadTeamMatches(team.id, {
      gotsportTeamId: team.gotsportTeamId ?? null,
      mlsNext: overlay,
    }).then((result) => {
      if (!cancelled) setLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [team.id, team.gotsportTeamId, overlay, nonce]);

  const focusId = load ? matchFocusId(load, overlay) : overlay?.orgId ?? null;
  const rows = (load?.matches ?? []).slice(0, 6);

  if (!load) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading recent matches…
      </p>
    );
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        {load.error ??
          "No public match list for this side. Nothing was invented."}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Recent matches</p>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          Public feed
        </span>
      </div>
      <ol className="space-y-2">
        {rows.map((m) => (
          <MatchRow key={m.id} match={m} focusId={focusId} />
        ))}
      </ol>
    </div>
  );
}

function MatchRow({
  match,
  focusId,
}: {
  match: CompactMatch;
  focusId: number | null;
}) {
  const opp = focusId != null ? opponentOf(focusId, match) : null;
  const result = focusId != null ? resultFor(focusId, match) : null;
  const scored = match.homeScore != null && match.awayScore != null;
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">
          {match.date ?? "Date N/A"}
          {match.event ? ` · ${match.event}` : ""}
        </p>
        <p className="truncate text-sm font-medium">
          vs {opp?.name ?? "Unknown"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-mono-num text-sm font-semibold">
          {scored ? `${match.homeScore}–${match.awayScore}` : "N/A"}
        </span>
        {result && (
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
              result === "W" && "bg-primary text-primary-foreground",
              result === "D" && "bg-muted text-muted-foreground",
              result === "L" && "border border-border text-muted-foreground",
            )}
          >
            {result}
          </span>
        )}
      </div>
    </li>
  );
}

function RankStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono-num text-2xl font-semibold text-primary">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value}</dd>
    </div>
  );
}

export function TeamMark({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w) && !/^(FC|SC|B\d|U\d)/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "FC";
  return (
    <span className="inline-flex size-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
      {initials}
    </span>
  );
}
