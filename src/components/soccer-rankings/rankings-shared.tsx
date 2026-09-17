import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  Search,
  Shield,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COMPILED_AS_OF,
  GOTSPORT_AS_OF,
  LEAGUE_FILTERS,
  SEASON_LABEL,
  leagueDisplayLabel,
  leagueTierChip,
} from "@/lib/soccer-rankings/compute";
import { AGE_BANDS, AGE_LEGEND, ageTabHint } from "@/lib/soccer-rankings/age-map";
import { alignmentLabel, COVERAGE } from "@/lib/soccer-rankings/load";
import {
  HOME_LABEL,
  isHomeTeam,
  isPinnedHomeTeam,
} from "@/lib/soccer-rankings/home";
import {
  dualRank,
  hubHomeHref,
  leagueBadgeVariant,
  PAGE_SIZE,
  sosMedianLabel,
  STATE_RANK_EXPLAIN,
  US_RANK_EXPLAIN,
  type SortDir,
} from "@/lib/soccer-rankings/use-soccer-rankings";
import { cachedMatchCount, mlsOverlayFromTeam } from "@/lib/soccer-rankings/matches";
import type { LeaguePlatform, RankedTeam } from "@/lib/soccer-rankings/types";
import { STATE_CODES, STATE_NAMES } from "@/lib/soccer-rankings/states";
import { cn } from "@/lib/utils";
import { CoverageFlag } from "./coverage-flag";
import { PinHomeButton } from "./pin-home-button";
import { RankHeader } from "./rank-header";
import { useRankings } from "./rankings-context";

export function HubBackLink() {
  return (
    <a
      href={hubHomeHref()}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      <ChevronLeft className="size-3.5" />
      Application Hub
    </a>
  );
}

export function RankingsTitle({
  kicker,
}: {
  kicker?: string;
}) {
  const { year } = useRankings();
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-success">
        <Trophy className="size-5" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {kicker ?? `Boys club · ${SEASON_LABEL}`}
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Soccer Rankings
        </h1>
      </div>
    </div>
  );
}

export function AgeAlignmentCopy() {
  const { year } = useRankings();
  return (
    <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
      Unofficial composite for boys {year}. MLS NEXT uses{" "}
      <strong className="text-foreground">birth year</strong> (U13 = 2014 BY).
      ECNL and many GotSport clubs use{" "}
      <strong className="text-foreground">school-year</strong> alignment (ECNL
      U13 ≈ 2013/14). The same “U13” label is not one national slice.
    </p>
  );
}

export function AsOfStamp({ className }: { className?: string }) {
  return (
    <p className={cn("font-mono text-[11px] text-muted-foreground", className)}>
      GotSport as of {GOTSPORT_AS_OF}
      {COMPILED_AS_OF !== GOTSPORT_AS_OF
        ? ` · refreshed ${COMPILED_AS_OF}`
        : ""}
    </p>
  );
}

export function AgeTabs({
  variant = "segmented",
}: {
  variant?: "segmented" | "pills";
}) {
  const { year, setYear, stateFilter, applyScope } = useRankings();
  return (
    <div
      className={cn(
        "inline-flex flex-wrap",
        variant === "segmented"
          ? "rounded-lg border border-border bg-card p-1"
          : "gap-1.5",
      )}
      role="tablist"
      aria-label="Age group"
    >
      {AGE_BANDS.map((y) => (
        <button
          key={y}
          type="button"
          role="tab"
          aria-selected={year === y}
          title={ageTabHint(y)}
          onClick={() => {
            setYear(y);
            applyScope(stateFilter);
          }}
          className={cn(
            "h-9 text-sm font-medium transition-colors",
            variant === "pills"
              ? "rounded-full border px-4"
              : "rounded-md px-2.5 sm:px-3",
            year === y
              ? variant === "pills"
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-primary text-primary-foreground"
              : variant === "pills"
                ? "border-border bg-card text-muted-foreground hover:text-foreground"
                : "text-muted-foreground hover:text-foreground",
          )}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

export function AgeLegendBadges() {
  return (
    <>
      <Badge variant="outline">{AGE_LEGEND}</Badge>
      <Badge variant="success">MLS NEXT U13 = 2014 BY</Badge>
      <Badge variant="accent">ECNL U13 = 2013/14 school year</Badge>
    </>
  );
}

export function RankingsCoverageFlag() {
  const {
    year,
    teams,
    caInYear,
    refreshFromGotsport,
    refreshingMatches,
    refreshNote,
  } = useRankings();
  return (
    <CoverageFlag
      year={year}
      rankedCount={teams.length}
      caInYear={caInYear}
      onRefresh={() => void refreshFromGotsport()}
      refreshing={refreshingMatches}
      refreshNote={refreshNote}
    />
  );
}

export function SearchField({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const { query, setQuery } = useRankings();
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search team, club, city, or state…"
        className="pl-9"
        aria-label="Search teams"
      />
    </div>
  );
}

export function ScopeSelect({ id }: { id: string }) {
  const { stateFilter, applyScope } = useRankings();
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Scope
      </label>
      <select
        id={id}
        value={stateFilter}
        onChange={(e) => applyScope(e.target.value)}
        className="h-9 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground"
      >
        <option value="all">US overall</option>
        {STATE_CODES.map((s) => (
          <option key={s} value={s}>
            {STATE_NAMES[s]} ({s})
          </option>
        ))}
      </select>
    </>
  );
}

export function LeagueSelect({ id }: { id: string }) {
  const { leagueFilter, setLeagueFilter } = useRankings();
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Leagues / platforms
      </label>
      <select
        id={id}
        value={leagueFilter}
        onChange={(e) =>
          setLeagueFilter(e.target.value as "all" | LeaguePlatform)
        }
        className="h-9 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground"
      >
        {LEAGUE_FILTERS.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    </>
  );
}

export function FilterCluster({
  searchId,
  scopeId,
  leagueId,
}: {
  searchId: string;
  scopeId: string;
  leagueId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Filter className="size-3.5" />
        Filters
      </span>
      <ScopeSelect id={scopeId} />
      <LeagueSelect id={leagueId} />
      <SearchField id={searchId} className="min-w-[12rem] flex-1" />
    </div>
  );
}

export function ScopeHint() {
  const { stateFilter } = useRankings();
  if (stateFilter === "all") return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <MapPin className="size-3.5 text-success" />
      {STATE_NAMES[stateFilter] ?? stateFilter} — US rank is among the national
      seed; state rank is among seeded {stateFilter} teams only
      {stateFilter === "CA"
        ? `, not the full ${COVERAGE.caUniverseEstimate.toLocaleString()}+ CA universe.`
        : "."}
    </p>
  );
}

export function RankingsStats() {
  const { status, teams, caInYear, filtered, stateFilter, year } = useRankings();
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Ranked this year"
        value={status === "ready" ? teams.length.toLocaleString() : "—"}
        hint={`${year} age tab`}
      />
      <Stat
        label="CA in this view"
        value={status === "ready" ? caInYear.toLocaleString() : "—"}
        hint={`Universe ≈${COVERAGE.caUniverseEstimate.toLocaleString()}+`}
      />
      <Stat
        label="Showing"
        value={status === "ready" ? filtered.length.toLocaleString() : "—"}
        hint={stateFilter === "all" ? "US table" : `${stateFilter} seeded`}
      />
      <Stat
        label="Unique seed"
        value={COVERAGE.uniqueTeams.toLocaleString()}
        hint="Both birth years"
      />
    </section>
  );
}

export function StatusBlocks() {
  const { status, error } = useRankings();
  if (status === "loading") {
    return (
      <Card className="p-5">
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }
  if (status === "error") {
    return (
      <Card className="flex items-start gap-3 p-6">
        <AlertCircle className="mt-0.5 size-5 text-destructive" />
        <div>
          <p className="font-medium">Could not load rankings</p>
          <p className="text-sm text-muted-foreground">
            {error ?? "Unknown error"}
          </p>
        </div>
      </Card>
    );
  }
  return null;
}

export function EmptyMatches() {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
      <Shield className="size-6 text-muted-foreground" />
      <p className="font-medium">No teams match</p>
      <p className="text-sm text-muted-foreground">
        Clear search or widen the state / league filters.
      </p>
    </Card>
  );
}

export function Pager() {
  const { pageSafe, pageCount, setPage } = useRankings();
  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pageSafe <= 1}
        onClick={() => setPage(pageSafe - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-3.5" />
        Prev
      </Button>
      <span className="font-mono-num text-xs">
        {pageSafe} / {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pageSafe >= pageCount}
        onClick={() => setPage(pageSafe + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

export function PinnedHomeChip({
  openScroll = false,
}: {
  openScroll?: boolean;
}) {
  const { pinnedId, pinnedTeam, openTeam, unpinHome } = useRankings();
  if (!pinnedId) return null;
  if (!pinnedTeam) {
    return (
      <p className="text-xs text-muted-foreground">
        Pinned home is not in this age tab.
      </p>
    );
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-success/35 bg-success/10 px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => openTeam(pinnedTeam.id, { scroll: openScroll })}
        className="min-w-0 text-left"
      >
        <p className="truncate text-xs font-medium text-foreground">
          {isHomeTeam(pinnedTeam.id) ? HOME_LABEL : pinnedTeam.name}
        </p>
        <p className="font-mono-num text-[11px] text-success">
          {dualRank(pinnedTeam)}
        </p>
      </button>
      <PinHomeButton
        teamId={pinnedTeam.id}
        teamName={pinnedTeam.name}
        pinned
        onPin={() => undefined}
        onUnpin={unpinHome}
        compact
      />
    </div>
  );
}

export function ResultCount() {
  const { pageSafe, filtered } = useRankings();
  return (
    <p>
      Rows {(pageSafe - 1) * PAGE_SIZE + 1}–
      {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of{" "}
      {filtered.length.toLocaleString()}
    </p>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display font-mono-num text-2xl font-semibold tracking-tight">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

export function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono-num text-sm font-medium">{value}</p>
    </div>
  );
}

export function SortTh({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn(
        "px-2 py-3 font-medium",
        align === "right" && "text-right",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "justify-end",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </th>
  );
}

export function TeamSourceBadges({
  team,
  limit,
}: {
  team: RankedTeam;
  limit?: number;
}) {
  const { pinnedId } = useRankings();
  const sources = limit ? team.sources.slice(0, limit) : team.sources;
  const tier = leagueTierChip(team.league);
  return (
    <>
      {isPinnedHomeTeam(team.id, pinnedId) && (
        <Badge variant="success">
          {isHomeTeam(team.id) ? HOME_LABEL : "Home"}
        </Badge>
      )}
      {tier && (
        <Badge variant={leagueBadgeVariant(team.league)}>{tier}</Badge>
      )}
      {alignmentLabel(team.ageAlignment) && (
        <Badge variant="secondary">{alignmentLabel(team.ageAlignment)}</Badge>
      )}
      {sources.map((s) => (
        <Badge key={s} variant="outline">
          {s}
        </Badge>
      ))}
    </>
  );
}

export function RankingsFooter() {
  const { year, teams } = useRankings();
  return (
    <footer className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
      Unofficial composite for personal use. Not an official ranking of MLS, MLS
      NEXT, ECNL, GotSport, or TopDrawerSoccer. GotSport rankings as of{" "}
      {GOTSPORT_AS_OF}
      {COMPILED_AS_OF !== GOTSPORT_AS_OF
        ? `; seed refreshed ${COMPILED_AS_OF}`
        : ""}
      . {year} view: {teams.length.toLocaleString()} seeded teams. California
      vintage universe ≈{COVERAGE.caUniverseEstimate.toLocaleString()}+.
    </footer>
  );
}

export function RankingsTable({
  density = "comfortable",
  columns = "full",
  openScroll = true,
}: {
  density?: "dense" | "comfortable";
  columns?: "full" | "split";
  openScroll?: boolean;
}) {
  const {
    pageRows,
    sortKey,
    sortDir,
    toggleSort,
    openTeam,
    onRowKeyDown,
    pinnedId,
    pinTeam,
    unpinHome,
    sosMap,
    selectedId,
    formatRecord,
    formatPoints,
    formatScore,
    publishedRecord,
  } = useRankings();
  const pad = density === "dense" ? "px-2 py-1.5" : "px-2 py-2.5";

  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-12" />
          <col className="w-16" />
          <col />
          {columns === "full" && <col className="w-28" />}
          <col className="w-20" />
          {columns === "full" && <col className="w-16" />}
          <col className="w-14" />
          {columns === "full" && <col className="w-16" />}
        </colgroup>
        <thead className="sticky top-0 z-10 border-b border-border bg-bg-elevated/90 text-xs uppercase tracking-wider text-muted-foreground backdrop-blur">
          <tr>
            <RankHeader
              label="US"
              active={sortKey === "usRank"}
              dir={sortDir}
              onClick={() => toggleSort("usRank")}
              explain={US_RANK_EXPLAIN}
            />
            <RankHeader
              label="State"
              active={sortKey === "stateRank"}
              dir={sortDir}
              onClick={() => toggleSort("stateRank")}
              explain={STATE_RANK_EXPLAIN}
            />
            <SortTh
              label="Team"
              active={sortKey === "name"}
              dir={sortDir}
              onClick={() => toggleSort("name")}
            />
            {columns === "full" && (
              <SortTh
                label="League"
                active={sortKey === "league"}
                dir={sortDir}
                onClick={() => toggleSort("league")}
              />
            )}
            <SortTh
              label="Record"
              active={sortKey === "record"}
              dir={sortDir}
              onClick={() => toggleSort("record")}
              align="right"
            />
            {columns === "full" && (
              <SortTh
                label="Pts"
                active={sortKey === "points"}
                dir={sortDir}
                onClick={() => toggleSort("points")}
                align="right"
              />
            )}
            <SortTh
              label="SOS"
              active={sortKey === "sos"}
              dir={sortDir}
              onClick={() => toggleSort("sos")}
              align="right"
            />
            {columns === "full" && (
              <SortTh
                label="Score"
                active={sortKey === "score"}
                dir={sortDir}
                onClick={() => toggleSort("score")}
                align="right"
              />
            )}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((t) => (
            <tr
              key={`${t.id}-${t.birthYear}`}
              role="button"
              tabIndex={0}
              aria-label={`Open ${t.name}`}
              aria-current={selectedId === t.id ? "true" : undefined}
              className={cn(
                "cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                isPinnedHomeTeam(t.id, pinnedId) &&
                  "border-l-2 border-l-success bg-success/10",
                selectedId === t.id && "bg-primary/10",
              )}
              onClick={() => openTeam(t.id, { scroll: openScroll })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTeam(t.id, { scroll: openScroll });
                } else {
                  onRowKeyDown(e, t.id);
                }
              }}
            >
              <td
                className={cn(
                  pad,
                  "text-right font-mono-num text-base font-semibold text-primary",
                )}
              >
                {t.usRank}
              </td>
              <td className={cn(pad, "text-right font-mono-num whitespace-nowrap")}>
                {t.stateRank}
                <span className="ml-1 text-xs text-muted-foreground">
                  {t.state}
                </span>
              </td>
              <td className={cn(pad, "min-w-0 px-3")}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium" title={t.name}>
                    {t.name}
                  </p>
                  <PinHomeButton
                    teamId={t.id}
                    teamName={t.name}
                    pinned={isPinnedHomeTeam(t.id, pinnedId)}
                    onPin={pinTeam}
                    onUnpin={unpinHome}
                    compact
                  />
                </div>
                <p className="mt-0.5 truncate font-mono-num text-xs font-medium text-foreground">
                  {dualRank(t)}
                  <span className="ml-1.5 font-sans font-normal text-muted-foreground">
                    {[t.city, t.state].filter(Boolean).join(", ")}
                    {t.club !== t.name ? ` · ${t.club}` : ""}
                  </span>
                </p>
                <div className="mt-1 flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                  <TeamSourceBadges team={t} limit={2} />
                </div>
              </td>
              {columns === "full" && (
                <td className={pad}>
                  <Badge variant={leagueBadgeVariant(t.league)}>
                    {leagueDisplayLabel(t.league, t.leagueLabel)}
                  </Badge>
                </td>
              )}
              <td
                className={cn(
                  pad,
                  "text-right font-mono-num whitespace-nowrap text-muted-foreground",
                )}
              >
                {formatRecord(publishedRecord(t))}
                {cachedMatchCount(t.id, mlsOverlayFromTeam(t)) > 0 && (
                  <span className="ml-1 text-[10px] text-success">
                    {cachedMatchCount(t.id, mlsOverlayFromTeam(t))}g
                  </span>
                )}
              </td>
              {columns === "full" && (
                <td
                  className={cn(
                    pad,
                    "text-right font-mono-num whitespace-nowrap text-muted-foreground",
                  )}
                >
                  {formatPoints(t.gotsport?.points)}
                </td>
              )}
              <td
                className={cn(
                  pad,
                  "text-right font-mono-num whitespace-nowrap text-muted-foreground",
                )}
              >
                {sosMedianLabel(sosMap.get(t.id))}
              </td>
              {columns === "full" && (
                <td
                  className={cn(
                    pad,
                    "text-right font-mono-num font-medium whitespace-nowrap",
                  )}
                >
                  {formatScore(t.score)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompactTeamList({
  openScroll = true,
}: {
  openScroll?: boolean;
}) {
  const {
    pageRows,
    openTeam,
    pinnedId,
    pinTeam,
    unpinHome,
    sosMap,
    selectedId,
    formatRecord,
    formatScore,
    publishedRecord,
  } = useRankings();

  return (
    <div className="grid gap-2 md:hidden">
      {pageRows.map((t) => (
        <div
          key={`${t.id}-${t.birthYear}`}
          role="button"
          tabIndex={0}
          aria-label={`Open ${t.name}`}
          className={cn(
            "w-full cursor-pointer rounded-xl border border-border bg-card p-3 text-left shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isPinnedHomeTeam(t.id, pinnedId) && "border-success/35 bg-success/5",
            selectedId === t.id && "border-primary/50 bg-primary/10",
          )}
          onClick={() => openTeam(t.id, { scroll: openScroll })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openTeam(t.id, { scroll: openScroll });
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium" title={t.name}>
                {t.name}
              </p>
              <p className="mt-0.5 font-mono-num text-xs font-medium">
                {dualRank(t)}
              </p>
              {leagueTierChip(t.league) && (
                <p className="mt-1">
                  <Badge variant={leagueBadgeVariant(t.league)}>
                    {leagueTierChip(t.league)}
                  </Badge>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PinHomeButton
                teamId={t.id}
                teamName={t.name}
                pinned={isPinnedHomeTeam(t.id, pinnedId)}
                onPin={pinTeam}
                onUnpin={unpinHome}
                compact
              />
              <p className="font-mono-num text-lg font-semibold text-primary">
                #{t.usRank}
              </p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <MetaChip
              label="Record"
              value={formatRecord(publishedRecord(t))}
            />
            <MetaChip
              label="SOS"
              value={sosMedianLabel(sosMap.get(t.id))}
            />
            <MetaChip label="Score" value={formatScore(t.score)} />
          </div>
        </div>
      ))}
    </div>
  );
}
