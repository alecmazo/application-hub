import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  COMPILED_AS_OF,
  GOTSPORT_AS_OF,
  LEAGUE_FILTERS,
  SEASON_LABEL,
  formatPoints,
  formatRecord,
  formatScore,
  usableRank,
  winPct,
} from "@/lib/soccer-rankings/compute";
import { AGE_BANDS, AGE_LEGEND, ageTabHint } from "@/lib/soccer-rankings/age-map";
import { alignmentLabel, COVERAGE, loadRankedAge } from "@/lib/soccer-rankings/load";
import {
  HOME_CONTINUITY_COPY,
  HOME_LABEL,
  homeSearchAliases,
  isHomeTeam,
  isPinnedHomeTeam,
} from "@/lib/soccer-rankings/home";
import { usePinnedHomeTeam } from "@/lib/soccer-rankings/use-pinned-home";
import {
  cachedMatchCount,
  refreshTeamMatches,
  sosByTeamId,
} from "@/lib/soccer-rankings/matches";
import type {
  AgeBand,
  LeaguePlatform,
  RankedTeam,
  SosSummary,
} from "@/lib/soccer-rankings/types";
import { STATE_CODES, STATE_NAMES } from "@/lib/soccer-rankings/states";
import { cn } from "@/lib/utils";
import { CoverageFlag } from "./coverage-flag";
import { PinHomeButton } from "./pin-home-button";
import { RankHeader } from "./rank-header";
import { TeamDetail } from "./team-detail";

type SortKey =
  | "usRank"
  | "name"
  | "state"
  | "league"
  | "stateRank"
  | "score"
  | "points"
  | "record"
  | "sos";
type SortDir = "asc" | "desc";
type Status = "loading" | "ready" | "error";

const PAGE_SIZE = 50;

const US_RANK_EXPLAIN =
  "Unofficial personal composite among seeded teams in this age tab. Mixes GotSport points, MLS NEXT results / SOS / conference place (only after games are played), and ECNL / TDS overlays when we have them. As-of the GotSport date in the header. Not an official ranking.";

const STATE_RANK_EXPLAIN =
  "Same unofficial composite, ranked only among seeded teams in that state — not every club that exists there. California is one state in this list, not a separate universe. As-of the GotSport date in the header.";

function hubHomeHref(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function leagueBadgeVariant(
  league: LeaguePlatform,
): "success" | "accent" | "default" | "secondary" | "outline" {
  if (league === "mls-next" || league === "mls-next-hg") return "success";
  if (league === "ecnl") return "accent";
  if (league === "ecnl-rl") return "default";
  return "secondary";
}

function compareRows(
  a: RankedTeam,
  b: RankedTeam,
  key: SortKey,
  dir: SortDir,
  sosMap: Map<string, SosSummary>,
) {
  const mul = dir === "asc" ? 1 : -1;
  const us = () => usableRank(a.usRank) - usableRank(b.usRank);
  switch (key) {
    case "name":
      return mul * a.name.localeCompare(b.name) || us();
    case "state":
      return mul * a.state.localeCompare(b.state) || us();
    case "league":
      return mul * a.leagueLabel.localeCompare(b.leagueLabel) || us();
    case "score":
      return mul * (a.score - b.score) || us();
    case "stateRank":
      return (
        mul * (usableRank(a.stateRank) - usableRank(b.stateRank)) || us()
      );
    case "points":
      return (
        mul * ((a.gotsport?.points ?? -1) - (b.gotsport?.points ?? -1)) || us()
      );
    case "record": {
      const pa = winPct(a.record) ?? -1;
      const pb = winPct(b.record) ?? -1;
      return mul * (pa - pb) || us();
    }
    case "sos": {
      const sa = sosMap.get(a.id)?.medianOpponentUsRank ?? 99_999;
      const sb = sosMap.get(b.id)?.medianOpponentUsRank ?? 99_999;
      return mul * (sa - sb) || us();
    }
    default:
      return mul * us() || a.name.localeCompare(b.name);
  }
}

function dualRank(t: RankedTeam): string {
  return `US #${t.usRank} · ${t.state} #${t.stateRank}`;
}

function sosMedianLabel(sos?: SosSummary): string {
  return sos?.medianOpponentUsRank != null
    ? `#${sos.medianOpponentUsRank}`
    : "—";
}

function teamMatchesQuery(t: RankedTeam, q: string): boolean {
  if (!q) return true;
  const stateName = STATE_NAMES[t.state] ?? "";
  const aliases = [homeSearchAliases(t.id)];
  const hay = [
    t.name,
    t.club,
    t.city ?? "",
    t.state,
    stateName,
    t.leagueLabel,
    ...aliases,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function SoccerRankingsPage() {
  const [year, setYear] = useState<AgeBand>("U13");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<RankedTeam[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState<"all" | LeaguePlatform>(
    "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("usRank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [showMethod, setShowMethod] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sosMap, setSosMap] = useState<Map<string, SosSummary>>(
    () => new Map(),
  );
  const { pinnedId, pinTeam, unpinHome } = usePinnedHomeTeam();
  const [matchRefreshNonce, setMatchRefreshNonce] = useState(0);
  const [refreshingMatches, setRefreshingMatches] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Soccer Rankings";
  }, []);

  useEffect(() => {
    setStatus("loading");
    setError(null);
    try {
      const ranked = loadRankedAge(year);
      setTeams(ranked.teams);
      setStatus("ready");
    } catch (e) {
      setTeams([]);
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not load rankings");
    }
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    void sosByTeamId(teams).then((map) => {
      if (!cancelled) setSosMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [teams]);

  const caInYear = useMemo(
    () => teams.filter((t) => t.state === "CA").length,
    [teams],
  );

  const selected = useMemo(
    () => (selectedId ? teams.find((t) => t.id === selectedId) : undefined),
    [teams, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = teams.filter((t) => {
      if (stateFilter !== "all" && t.state !== stateFilter) return false;
      if (leagueFilter !== "all" && t.league !== leagueFilter) return false;
      if (!teamMatchesQuery(t, q)) return false;
      return true;
    });
    rows.sort((a, b) => compareRows(a, b, sortKey, sortDir, sosMap));
    return rows;
  }, [
    teams,
    query,
    stateFilter,
    leagueFilter,
    sortKey,
    sortDir,
    sosMap,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
    setSelectedId(null);
  }, [year, query, stateFilter, leagueFilter]);

  useEffect(() => {
    setPage(1);
  }, [sortKey, sortDir]);

  function openTeam(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => {
      document.getElementById("team-page")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTeam(id);
    }
  }

  function applyScope(next: string) {
    setStateFilter(next);
    setSortKey(next === "all" ? "usRank" : "stateRank");
    setSortDir("asc");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(
      key === "score" || key === "points" || key === "record" ? "desc" : "asc",
    );
  }

  async function refreshFromGotsport() {
    setRefreshingMatches(true);
    setRefreshNote(null);
    const targets = [...new Set([selectedId, pinnedId].filter(Boolean))] as string[];
    try {
      const results = await Promise.all(
        targets.map((id) => refreshTeamMatches(id)),
      );
      setMatchRefreshNonce((n) => n + 1);
      const live = results.filter((r) => r.source === "live").length;
      if (targets.length === 0) {
        setRefreshNote(
          "Open a team (or pin one) to pull its live GotSport match list. Seeded ranks stay compiled.",
        );
      } else if (live > 0) {
        setRefreshNote(
          `Pulled live GotSport matches for ${live} team${live === 1 ? "" : "s"}. Seeded ranks stay as of ${GOTSPORT_AS_OF}.`,
        );
      } else if (results.some((r) => r.source === "cache")) {
        setRefreshNote(
          "GotSport live API unavailable here (no CORS on GitHub Pages). Showing the shipped match cache.",
        );
      } else {
        setRefreshNote(
          results.find((r) => r.error)?.error ??
            "No live match list returned. Seeded ranks unchanged.",
        );
      }
    } catch (e) {
      setRefreshNote(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshingMatches(false);
    }
  }

  return (
    <div className="pitch-atmosphere min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[90rem] flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <a
              href={hubHomeHref()}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ChevronLeft className="size-3.5" />
              Application Hub
            </a>
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-success">
                <Trophy className="size-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Boys club · {SEASON_LABEL}
                </p>
                <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  Soccer Rankings
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Unofficial composite for boys {year}. MLS NEXT uses{" "}
              <strong className="text-foreground">birth year</strong> (U13 = 2014
              BY). ECNL and many GotSport clubs use{" "}
              <strong className="text-foreground">school-year</strong> alignment
              (ECNL U13 ≈ 2013/14). The same “U13” label is not one national
              slice.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div
              className="inline-flex rounded-lg border border-border bg-card p-1"
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
                    "h-9 rounded-md px-2.5 text-sm font-medium transition-colors sm:px-3",
                    year === y
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
            <p className="text-right font-mono text-[11px] text-muted-foreground">
              GotSport as of {GOTSPORT_AS_OF}
              {COMPILED_AS_OF !== GOTSPORT_AS_OF
                ? ` · refreshed ${COMPILED_AS_OF}`
                : ""}
            </p>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{AGE_LEGEND}</Badge>
          <Badge variant="success">MLS NEXT U13 = 2014 BY</Badge>
          <Badge variant="accent">ECNL U13 = 2013/14 school year</Badge>
          <CoverageFlag
            year={year}
            rankedCount={teams.length}
            caInYear={caInYear}
            onRefresh={() => void refreshFromGotsport()}
            refreshing={refreshingMatches}
            refreshNote={refreshNote}
          />
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        <div className="mt-6 flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="rankings-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search team, club, city, or state…"
                  className="pl-9"
                  aria-label="Search teams"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Matching teams appear in the list. Click or press Enter on a row
                to open that team’s record and schedule.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Filter className="size-3.5" />
                Filters
              </span>
              <label className="sr-only" htmlFor="scope-filter">
                Scope
              </label>
              <select
                id="scope-filter"
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
              <label className="sr-only" htmlFor="league-filter">
                Leagues / platforms
              </label>
              <select
                id="league-filter"
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
            </div>
          </div>
        </div>

        {stateFilter !== "all" && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 text-success" />
            {STATE_NAMES[stateFilter] ?? stateFilter} — US rank is among the
            national seed; state rank is among seeded {stateFilter} teams only
            {stateFilter === "CA"
              ? `, not the full ${COVERAGE.caUniverseEstimate.toLocaleString()}+ CA universe.`
              : "."}
          </p>
        )}

        <div className="relative z-10 mt-5 flex-1">
          {status === "loading" && (
            <Card className="p-5">
              <div className="space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          )}

          {status === "error" && (
            <Card className="flex items-start gap-3 p-6">
              <AlertCircle className="mt-0.5 size-5 text-destructive" />
              <div>
                <p className="font-medium">Could not load rankings</p>
                <p className="text-sm text-muted-foreground">
                  {error ?? "Unknown error"}
                </p>
              </div>
            </Card>
          )}

          {status === "ready" && selected && (
            <div id="team-page" className="scroll-mt-4 space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft className="size-3.5" />
                Back to rankings
              </Button>
              <Card id="team-detail" className="p-4">
                <TeamDetail
                  team={selected}
                  yearTeams={teams}
                  onOpenTeam={openTeam}
                  pinnedHomeId={pinnedId}
                  onPinHome={pinTeam}
                  onUnpinHome={unpinHome}
                  refreshNonce={matchRefreshNonce}
                />
              </Card>
            </div>
          )}

          {status === "ready" && !selected && filtered.length === 0 && (
            <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <Shield className="size-6 text-muted-foreground" />
              <p className="font-medium">No teams match</p>
              <p className="text-sm text-muted-foreground">
                Clear search or widen the state / league filters.
              </p>
            </Card>
          )}

          {status === "ready" && !selected && filtered.length > 0 && (
            <div id="rankings-results">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>
                  Rows {(pageSafe - 1) * PAGE_SIZE + 1}–
                  {Math.min(pageSafe * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length.toLocaleString()}
                </p>
                <Pager
                  page={pageSafe}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </div>

              <div className="hidden rounded-2xl border border-border bg-card md:block">
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-14" />
                    <col className="w-16" />
                    <col />
                    <col className="w-28" />
                    <col className="w-24" />
                    <col className="w-20" />
                    <col className="w-16" />
                    <col className="w-16" />
                  </colgroup>
                  <thead className="border-b border-border bg-bg-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
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
                      <SortTh
                        label="League"
                        active={sortKey === "league"}
                        dir={sortDir}
                        onClick={() => toggleSort("league")}
                      />
                      <SortTh
                        label="Record"
                        active={sortKey === "record"}
                        dir={sortDir}
                        onClick={() => toggleSort("record")}
                        align="right"
                      />
                      <SortTh
                        label="Pts"
                        active={sortKey === "points"}
                        dir={sortDir}
                        onClick={() => toggleSort("points")}
                        align="right"
                      />
                      <SortTh
                        label="SOS"
                        active={sortKey === "sos"}
                        dir={sortDir}
                        onClick={() => toggleSort("sos")}
                        align="right"
                      />
                      <SortTh
                        label="Score"
                        active={sortKey === "score"}
                        dir={sortDir}
                        onClick={() => toggleSort("score")}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((t) => (
                      <tr
                        key={`${t.id}-${t.birthYear}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${t.name}`}
                        className={cn(
                          "cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/30 focus-visible:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          isPinnedHomeTeam(t.id, pinnedId) && "bg-success/5",
                        )}
                        onClick={() => openTeam(t.id)}
                        onKeyDown={(e) => onRowKeyDown(e, t.id)}
                      >
                        <td className="px-2 py-2.5 text-right font-mono-num text-base font-semibold text-primary">
                          {t.usRank}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono-num whitespace-nowrap">
                          {t.stateRank}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {t.state}
                          </span>
                        </td>
                        <td className="min-w-0 px-3 py-2.5">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <p
                              className="min-w-0 truncate font-medium"
                              title={t.name}
                            >
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
                            {isPinnedHomeTeam(t.id, pinnedId) && (
                              <Badge variant="success">
                                {isHomeTeam(t.id) ? HOME_LABEL : "Home"}
                              </Badge>
                            )}
                            {alignmentLabel(t.ageAlignment) && (
                              <Badge variant="secondary">
                                {alignmentLabel(t.ageAlignment)}
                              </Badge>
                            )}
                            {t.sources.slice(0, 2).map((s) => (
                              <Badge key={s} variant="outline">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge variant={leagueBadgeVariant(t.league)}>
                            {t.leagueLabel}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono-num whitespace-nowrap text-muted-foreground">
                          {formatRecord(t.record ?? t.mlsNext?.record)}
                          {cachedMatchCount(t.id) > 0 && (
                            <span className="ml-1 text-[10px] text-success">
                              {cachedMatchCount(t.id)}g
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono-num whitespace-nowrap text-muted-foreground">
                          {formatPoints(t.gotsport?.points)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono-num whitespace-nowrap text-muted-foreground">
                          {sosMedianLabel(sosMap.get(t.id))}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono-num font-medium whitespace-nowrap">
                          {formatScore(t.score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {pageRows.map((t) => (
                  <div
                    key={`${t.id}-${t.birthYear}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${t.name}`}
                    className={cn(
                      "w-full cursor-pointer rounded-2xl border border-border bg-card p-4 text-left shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isPinnedHomeTeam(t.id, pinnedId) &&
                        "border-success/35 bg-success/5",
                    )}
                    onClick={() => openTeam(t.id)}
                    onKeyDown={(e) => onRowKeyDown(e, t.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="line-clamp-2 font-display text-lg font-semibold leading-tight"
                          title={t.name}
                        >
                          {t.name}
                        </p>
                        <p className="mt-1 font-mono-num text-sm font-medium">
                          {dualRank(t)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[t.city, t.state].filter(Boolean).join(", ")} ·{" "}
                          {t.leagueLabel}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="mb-2 flex justify-end">
                          <PinHomeButton
                            teamId={t.id}
                            teamName={t.name}
                            pinned={isPinnedHomeTeam(t.id, pinnedId)}
                            onPin={pinTeam}
                            onUnpin={unpinHome}
                            compact
                          />
                        </div>
                        <p className="font-mono-num text-xl font-semibold text-primary">
                          US #{t.usRank}
                        </p>
                        <p className="font-mono-num text-sm font-medium">
                          {t.state} #{t.stateRank}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <MetaChip
                        label="Record"
                        value={formatRecord(t.record ?? t.mlsNext?.record)}
                      />
                      <MetaChip
                        label="SOS med. US"
                        value={sosMedianLabel(sosMap.get(t.id))}
                      />
                      <MetaChip label="Score" value={formatScore(t.score)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {isPinnedHomeTeam(t.id, pinnedId) && (
                        <Badge variant="success">
                          {isHomeTeam(t.id) ? HOME_LABEL : "Home"}
                        </Badge>
                      )}
                      {alignmentLabel(t.ageAlignment) && (
                        <Badge variant="secondary">
                          {alignmentLabel(t.ageAlignment)}
                        </Badge>
                      )}
                      {t.sources.map((s) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-end">
                <Pager page={pageSafe} pageCount={pageCount} onPage={setPage} />
              </div>
            </div>
          )}
        </div>

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
                <strong className="text-foreground">Pinned home:</strong>{" "}
                Highlight only — pin any side from a row or team page, or unpin
                entirely. Default pin is {HOME_LABEL} (
                <code className="font-mono text-xs">56506</code>
                ). Continuity ({HOME_CONTINUITY_COPY}) shows only while that
                Marin 2013/14 ECNL side is pinned. Marin FC Blue 2014/15 (
                <code className="font-mono text-xs">252973</code>) is a
                separate line — never last-year continuity. Browse and search
                stay unlocked.
              </p>
              <p>
                <strong className="text-foreground">Age tabs U12–U16:</strong>{" "}
                {AGE_LEGEND} MLS NEXT U13 = 2014 BY (official 2026–27 Homegrown).
                ECNL U13 ≈ 2013/14 school year. MLS NEXT sides are never forced
                onto school-year labels.
              </p>
              <p>
                Ranks are computed in-browser from a public GotSport ingest plus
                a few published TDS / MLS NEXT Cup overlays.{" "}
                <strong className="text-foreground">usRank</strong> sorts
                composite score among seeded teams in this age tab.{" "}
                <strong className="text-foreground">stateRank</strong> is among
                seeded teams in that state — not every club that exists.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  GotSport public rankings API (boys U12–U16, USA), including
                  Cal South (CAS) and Cal North (CAN).
                </li>
                <li>
                  GotSport public match lists:{" "}
                  <code className="font-mono text-xs">
                    GET /api/v1/teams/{"{id}"}/matches
                  </code>{" "}
                  (league season + tournaments). Shipped cache + live via the
                  Vite <code className="font-mono text-xs">/gotsport-api</code>{" "}
                  proxy. GitHub Pages cannot call GotSport directly (no CORS).
                </li>
                <li>
                  MLS NEXT Cup 2026 U13 recaps applied to the 2014 view
                  (Atlanta United champion; LA Galaxy finalist; Inter Miami
                  semifinalist).
                </li>
                <li>
                  TopDrawerSoccer TeamRank boys U13, which TDS labeled as the
                  2013 birth year, overlaid on matching 2013-view clubs.
                </li>
              </ul>
              <p>
                Refresh: run{" "}
                <code className="font-mono text-xs text-foreground">
                  python3 scripts/ingest-soccer-rankings.py
                </code>{" "}
                then rebuild. See{" "}
                <code className="font-mono text-xs text-foreground">
                  src/data/soccer-rankings/METHODOLOGY.md
                </code>
                .
              </p>
            </CardContent>
          )}
        </Card>

        <footer className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          Unofficial composite for personal use. Not an official ranking of MLS,
          MLS NEXT, ECNL, GotSport, or TopDrawerSoccer. GotSport rankings as of{" "}
          {GOTSPORT_AS_OF}
          {COMPILED_AS_OF !== GOTSPORT_AS_OF
            ? `; seed refreshed ${COMPILED_AS_OF}`
            : ""}
          . {year} view: {teams.length.toLocaleString()} seeded
          teams. California vintage universe ≈
          {COVERAGE.caUniverseEstimate.toLocaleString()}+.
        </footer>
      </div>
    </div>
  );
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-3.5" />
        Prev
      </Button>
      <span className="font-mono-num text-xs">
        {page} / {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="size-3.5" />
      </Button>
    </div>
  );
}

function Stat({
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
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight font-mono-num">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="font-mono-num text-sm font-medium">{value}</p>
    </div>
  );
}

function SortTh({
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
