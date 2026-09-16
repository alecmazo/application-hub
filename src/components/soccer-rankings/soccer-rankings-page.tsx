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
  winPct,
} from "@/lib/soccer-rankings/compute";
import { alignmentLabel, COVERAGE, loadRankedYear } from "@/lib/soccer-rankings/load";
import {
  HOME_CONTINUITY_COPY,
  HOME_LABEL,
  homeSearchAliases,
  isHomeTeam,
} from "@/lib/soccer-rankings/home";
import {
  MATCH_CACHE_META,
  NOT_ON_PUBLIC_FEED,
  cachedMatchCount,
  sosByTeamId,
} from "@/lib/soccer-rankings/matches";
import type {
  BirthYear,
  LeagueBandFilter,
  LeaguePlatform,
  RankedTeam,
  SosSummary,
} from "@/lib/soccer-rankings/types";
import { cn } from "@/lib/utils";
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

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  NC: "North Carolina",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  WA: "Washington",
  WI: "Wisconsin",
};

const BAND_FILTERS: { key: LeagueBandFilter; label: string }[] = [
  { key: "all", label: "All age bands" },
  { key: "mls-next-u13", label: "MLS NEXT U13 (2014 BY)" },
  { key: "ecnl-u13", label: "ECNL U13 (2013/14)" },
  { key: "other", label: "Other / GotSport" },
];

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

function matchesBand(t: RankedTeam, band: LeagueBandFilter): boolean {
  if (band === "all") return true;
  if (band === "mls-next-u13") {
    return (
      t.ageAlignment === "mls-next-u13-2014-by" ||
      ((t.league === "mls-next" || t.league === "mls-next-hg") &&
        t.gotsportAge === 13)
    );
  }
  if (band === "ecnl-u13") {
    return (
      t.ageAlignment === "ecnl-u13-2013-14" ||
      (t.league === "ecnl" && t.gotsportAge === 13)
    );
  }
  return t.league === "other" || t.league === "ecnl-rl";
}

function compareRows(
  a: RankedTeam,
  b: RankedTeam,
  key: SortKey,
  dir: SortDir,
  sosMap: Map<string, SosSummary>,
) {
  const mul = dir === "asc" ? 1 : -1;
  switch (key) {
    case "name":
      return mul * a.name.localeCompare(b.name);
    case "state":
      return mul * a.state.localeCompare(b.state) || a.usRank - b.usRank;
    case "league":
      return (
        mul * a.leagueLabel.localeCompare(b.leagueLabel) || a.usRank - b.usRank
      );
    case "score":
      return mul * (a.score - b.score) || a.usRank - b.usRank;
    case "stateRank":
      return mul * (a.stateRank - b.stateRank) || a.usRank - b.usRank;
    case "points":
      return (
        mul * ((a.gotsport?.points ?? -1) - (b.gotsport?.points ?? -1)) ||
        a.usRank - b.usRank
      );
    case "record": {
      const pa = winPct(a.record) ?? -1;
      const pb = winPct(b.record) ?? -1;
      return mul * (pa - pb) || a.usRank - b.usRank;
    }
    case "sos": {
      const sa = sosMap.get(a.id)?.medianOpponentUsRank ?? 99_999;
      const sb = sosMap.get(b.id)?.medianOpponentUsRank ?? 99_999;
      return mul * (sa - sb) || a.usRank - b.usRank;
    }
    default:
      return mul * (a.usRank - b.usRank);
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
  const [year, setYear] = useState<BirthYear>(2013);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<RankedTeam[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState<"all" | LeaguePlatform>(
    "all",
  );
  const [bandFilter, setBandFilter] = useState<LeagueBandFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("usRank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [showMethod, setShowMethod] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sosMap, setSosMap] = useState<Map<string, SosSummary>>(
    () => new Map(),
  );

  useEffect(() => {
    document.title = "Soccer Rankings";
  }, []);

  useEffect(() => {
    setStatus("loading");
    setError(null);
    try {
      const ranked = loadRankedYear(year);
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

  const states = useMemo(() => {
    return [...new Set(teams.map((t) => t.state))].sort();
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
      if (!matchesBand(t, bandFilter)) return false;
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
    bandFilter,
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
  }, [year, query, stateFilter, leagueFilter, bandFilter]);

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

  const caPct =
    COVERAGE.caUniverseEstimate > 0
      ? Math.round((COVERAGE.caUnique / COVERAGE.caUniverseEstimate) * 100)
      : 0;
  const caCoverageNote =
    COVERAGE.caUnique >= COVERAGE.caUniverseEstimate
      ? `the seed lists ${COVERAGE.caUnique.toLocaleString()} unique CA GotSport U12/U13 sides (full public ranking directory — multiple teams per club and mixed U12/U13 bands, so this is not a 1:1 map of the ≈${COVERAGE.caUniverseEstimate.toLocaleString()}+ vintage figure)`
      : `the seed currently lists ${COVERAGE.caUnique.toLocaleString()} unique CA teams (~${caPct}% of that 1,100+ universe, across both birth years)`;

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
              Unofficial composite for {year}-born boys. MLS NEXT U13 is a{" "}
              <strong className="text-foreground">2014 birth-year</strong>{" "}
              category. ECNL U13 uses the{" "}
              <strong className="text-foreground">2013/14 school year</strong> —
              the same “U13” label is not the same slice across platforms.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div
              className="inline-flex rounded-lg border border-border bg-card p-1"
              role="tablist"
              aria-label="Birth year"
            >
              {([2013, 2014] as const).map((y) => (
                <button
                  key={y}
                  type="button"
                  role="tab"
                  aria-selected={year === y}
                  onClick={() => {
                    setYear(y);
                    setSortKey(stateFilter === "all" ? "usRank" : "stateRank");
                    setSortDir("asc");
                  }}
                  className={cn(
                    "h-9 rounded-md px-3 text-sm font-medium transition-colors sm:px-4",
                    year === y
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {y}
                  <span className="ml-1.5 text-[11px] font-normal opacity-80">
                    {y === 2014 ? "MLS NEXT U13 BY" : "2013 BY"}
                  </span>
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

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="success">MLS NEXT U13 = 2014 BY</Badge>
          <Badge variant="accent">ECNL U13 = 2013/14 school year</Badge>
          <Badge variant="outline">GotSport U12/U13 listings mix vintages</Badge>
        </div>

        <div className="mt-4 rounded-xl border border-warn/35 bg-warn/10 px-4 py-3 text-sm leading-relaxed">
          <p className="font-medium text-foreground">
            Coverage incomplete vs the full US — CA GotSport U12/U13 directory
            is in; vintage universe ≈1,100+.
          </p>
          <p className="mt-1 text-muted-foreground">
            Showing {teams.length.toLocaleString()} ranked {year}-born sides in
            this view ({caInYear.toLocaleString()} California). California’s
            competitive vintage is about{" "}
            {COVERAGE.caUniverseEstimate.toLocaleString()}+ teams;{" "}
            {caCoverageNote}. US and state ranks are among seeded teams only.
            Match cache as of {MATCH_CACHE_META.asOf}:{" "}
            {MATCH_CACHE_META.teamsWithMatches.toLocaleString()}{" "}
            teams / {MATCH_CACHE_META.matches.toLocaleString()} games.
            {NOT_ON_PUBLIC_FEED?.status ===
            "not_yet_on_gotsport_public_feed"
              ? ` Reported ${NOT_ON_PUBLIC_FEED.date} Marin vs El Camino Salinas ECNL is flagged not_yet_on_gotsport_public_feed — no invented 1–0.`
              : ""}{" "}
            Refresh rankings with{" "}
            <code className="font-mono text-[11px] text-foreground">
              python3 scripts/ingest-soccer-rankings.py
            </code>
            ; matches with{" "}
            <code className="font-mono text-[11px] text-foreground">
              python3 scripts/ingest-gotsport-matches.py
            </code>
            .
          </p>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Ranked this year"
            value={status === "ready" ? teams.length.toLocaleString() : "—"}
            hint={`${year} birth-year view`}
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
                Scope
              </span>
              <button
                type="button"
                onClick={() => {
                  setStateFilter("all");
                  setSortKey("usRank");
                  setSortDir("asc");
                }}
                className={cn(
                  "h-9 rounded-md border px-2.5 text-xs font-medium",
                  stateFilter === "all"
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                US overall
              </button>
              <button
                type="button"
                onClick={() => {
                  setStateFilter("CA");
                  setSortKey("stateRank");
                  setSortDir("asc");
                }}
                className={cn(
                  "h-9 rounded-md border px-2.5 text-xs font-medium",
                  stateFilter === "CA"
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                California
              </button>
              <label className="sr-only" htmlFor="state-filter">
                State
              </label>
              <select
                id="state-filter"
                value={stateFilter === "CA" || stateFilter === "all" ? stateFilter : stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  if (e.target.value !== "all") {
                    setSortKey("stateRank");
                    setSortDir("asc");
                  } else {
                    setSortKey("usRank");
                    setSortDir("asc");
                  }
                }}
                className="h-9 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground"
              >
                <option value="all">US overall</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                    {STATE_NAMES[s] ? ` · ${STATE_NAMES[s]}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {LEAGUE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setLeagueFilter(f.key)}
                className={cn(
                  "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
                  leagueFilter === f.key
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {BAND_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setBandFilter(f.key)}
                className={cn(
                  "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
                  bandFilter === f.key
                    ? "border-success/40 bg-success/15 text-success"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
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
                    <col />
                    <col className="w-14" />
                    <col className="w-28" />
                    <col className="w-20" />
                    <col className="w-24" />
                    <col className="w-20" />
                    <col className="w-16" />
                    <col className="w-16" />
                  </colgroup>
                  <thead className="border-b border-border bg-bg-elevated/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <SortTh
                        label="US"
                        active={sortKey === "usRank"}
                        dir={sortDir}
                        onClick={() => toggleSort("usRank")}
                        align="right"
                      />
                      <SortTh
                        label="Team"
                        active={sortKey === "name"}
                        dir={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                      <SortTh
                        label="State"
                        active={sortKey === "state"}
                        dir={sortDir}
                        onClick={() => toggleSort("state")}
                      />
                      <SortTh
                        label="League"
                        active={sortKey === "league"}
                        dir={sortDir}
                        onClick={() => toggleSort("league")}
                      />
                      <SortTh
                        label="State #"
                        active={sortKey === "stateRank"}
                        dir={sortDir}
                        onClick={() => toggleSort("stateRank")}
                        align="right"
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
                          isHomeTeam(t.id) && "bg-success/5",
                        )}
                        onClick={() => openTeam(t.id)}
                        onKeyDown={(e) => onRowKeyDown(e, t.id)}
                      >
                        <td className="px-2 py-2.5 text-right font-mono-num text-base font-semibold text-primary">
                          {t.usRank}
                        </td>
                        <td className="min-w-0 px-3 py-2.5">
                          <p
                            className="truncate font-medium"
                            title={t.name}
                          >
                            {t.name}
                          </p>
                          <p className="mt-0.5 truncate font-mono-num text-xs font-medium text-foreground">
                            {dualRank(t)}
                            <span className="ml-1.5 font-sans font-normal text-muted-foreground">
                              {[t.city, t.state].filter(Boolean).join(", ")}
                              {t.club !== t.name ? ` · ${t.club}` : ""}
                            </span>
                          </p>
                          <div className="mt-1 flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                            {isHomeTeam(t.id) && (
                              <Badge variant="success">{HOME_LABEL}</Badge>
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
                        <td className="px-2 py-2.5 font-mono-num">{t.state}</td>
                        <td className="px-2 py-2.5">
                          <Badge variant={leagueBadgeVariant(t.league)}>
                            {t.leagueLabel}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono-num whitespace-nowrap">
                          {t.stateRank}
                          <span className="ml-1 text-xs text-muted-foreground">
                            {t.state}
                          </span>
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
                  <button
                    key={`${t.id}-${t.birthYear}`}
                    type="button"
                    aria-label={`Open ${t.name}`}
                    className={cn(
                      "w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isHomeTeam(t.id) && "border-success/35 bg-success/5",
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
                      {isHomeTeam(t.id) && (
                        <Badge variant="success">{HOME_LABEL}</Badge>
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
                  </button>
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
                <strong className="text-foreground">Highlighted side:</strong>{" "}
                {HOME_CONTINUITY_COPY}. Same GotSport listing{" "}
                <code className="font-mono text-xs">56506</code> (B14Blue →
                ECNL B2013/14). Marin FC Blue 2014/15 (
                <code className="font-mono text-xs">252973</code>) is a
                separate line — not last-year continuity. The app does not lock
                onto this side; it is only badged when it appears in the
                current list.
              </p>
              <p>
                <strong className="text-foreground">Age-band truth (2025–26):</strong>{" "}
                MLS NEXT U13 boys is a 2014 birth-year category. ECNL U13 is the
                2013/14 school-year alignment, not a single-year slice. A club’s
                “U13” side can mean different vintages across platforms.
              </p>
              <p>
                Ranks are computed in-browser from a public GotSport ingest plus
                a few published TDS / MLS NEXT Cup overlays.{" "}
                <strong className="text-foreground">usRank</strong> sorts
                composite score among seeded teams in this birth-year view.{" "}
                <strong className="text-foreground">stateRank</strong> is among
                seeded teams in that state — not every club that exists.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  GotSport public rankings API (boys U12/U13, USA), including
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
