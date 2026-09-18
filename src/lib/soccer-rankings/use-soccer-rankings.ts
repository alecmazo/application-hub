import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  GOTSPORT_AS_OF,
  formatPoints,
  formatRecord,
  formatScore,
  leagueDisplayLabel,
  leagueTierChip,
  publishedRecord,
  usableRank,
  winPct,
} from "./compute";
import { DEFAULT_AGE_BAND } from "./age-map";
import {
  DEFAULT_PAGE_VIEW,
  readPageView,
  writePageView,
  type PageView,
} from "./league-tables";
import { loadRankedAge } from "./load";
import { homeSearchAliases } from "./home";
import { usePinnedHomeTeam } from "./use-pinned-home";
import { mlsOverlayFromTeam, refreshTeamMatches, sosByTeamId } from "./matches";
import type {
  AgeBand,
  LeaguePlatform,
  RankedTeam,
  SosSummary,
} from "./types";
import { STATE_NAMES } from "./states";

export type SortKey =
  | "usRank"
  | "name"
  | "state"
  | "league"
  | "stateRank"
  | "score"
  | "points"
  | "record"
  | "sos";
export type SortDir = "asc" | "desc";
export type Status = "loading" | "ready" | "error";

export const PAGE_SIZE = 50;

export const US_RANK_EXPLAIN =
  "Unofficial personal composite among seeded teams in this age tab. Mixes GotSport points, MLS NEXT results / SOS / conference place (only after games are played), and ECNL / TDS overlays when we have them. As-of the GotSport date in the header. Not an official ranking.";

export const STATE_RANK_EXPLAIN =
  "Same unofficial composite, ranked only among seeded teams in that state — not every club that exists there. California is one state in this list, not a separate universe. As-of the GotSport date in the header.";

export function hubHomeHref(): string {
  const base = import.meta.env.BASE_URL || "/";
  return base.endsWith("/") ? base : `${base}/`;
}

export function leagueBadgeVariant(
  league: LeaguePlatform,
): "success" | "accent" | "default" | "secondary" | "outline" {
  if (league === "mls-next-hg") return "success";
  if (league === "mls-next") return "outline";
  if (league === "ecnl") return "accent";
  if (league === "ecnl-rl") return "default";
  return "secondary";
}

export function dualRank(t: RankedTeam): string {
  return `US #${t.usRank} · ${t.state} #${t.stateRank}`;
}

export function sosMedianLabel(sos?: SosSummary): string {
  return sos?.medianOpponentUsRank != null
    ? `#${sos.medianOpponentUsRank}`
    : "—";
}

export function teamMatchesQuery(t: RankedTeam, q: string): boolean {
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
    leagueDisplayLabel(t.league, t.leagueLabel),
    leagueTierChip(t.league) ?? "",
    ...aliases,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
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
      return (
        mul *
          leagueDisplayLabel(a.league, a.leagueLabel).localeCompare(
            leagueDisplayLabel(b.league, b.leagueLabel),
          ) || us()
      );
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

export function useSoccerRankings() {
  const [year, setYear] = useState<AgeBand>(DEFAULT_AGE_BAND);
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
  const [pageView, setPageViewState] = useState<PageView>(DEFAULT_PAGE_VIEW);

  useEffect(() => {
    document.title = "Soccer Rankings";
  }, []);

  useEffect(() => {
    setPageViewState(readPageView());
  }, []);

  const setPageView = useCallback((next: PageView) => {
    setPageViewState(next);
    writePageView(next);
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

  const pinnedTeam = useMemo(
    () => (pinnedId ? teams.find((t) => t.id === pinnedId) : undefined),
    [teams, pinnedId],
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
  }, [teams, query, stateFilter, leagueFilter, sortKey, sortDir, sosMap]);

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

  const openTeam = useCallback((id: string, opts?: { scroll?: boolean }) => {
    setSelectedId(id);
    if (opts?.scroll === false) return;
    requestAnimationFrame(() => {
      document.getElementById("team-page")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const closeTeam = useCallback(() => {
    setSelectedId(null);
  }, []);

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
        targets.map((id) => {
          const team = teams.find((t) => t.id === id);
          return refreshTeamMatches(id, {
            gotsportTeamId: team?.gotsportTeamId ?? null,
            mlsNext: team ? mlsOverlayFromTeam(team) : null,
          });
        }),
      );
      setMatchRefreshNonce((n) => n + 1);
      const live = results.filter((r) => r.source === "live").length;
      const usedMls = results.some((r) => r.mlsNextOrgId != null);
      if (targets.length === 0) {
        setRefreshNote(
          "Open a team (or pin one) to pull its live Homegrown / GotSport match list. Seeded ranks stay compiled.",
        );
      } else if (live > 0) {
        setRefreshNote(
          usedMls
            ? `Pulled live Homegrown / MLS NEXT schedule for ${live} team${live === 1 ? "" : "s"}. Seeded ranks stay as of ${GOTSPORT_AS_OF}.`
            : `Pulled live GotSport matches for ${live} team${live === 1 ? "" : "s"}. Seeded ranks stay as of ${GOTSPORT_AS_OF}.`,
        );
      } else if (results.some((r) => r.source === "cache")) {
        setRefreshNote(
          usedMls
            ? "Live League Viewer pull was empty or blocked. Showing the shipped Homegrown / MLS NEXT cache."
            : "GotSport live API unavailable here (no CORS on GitHub Pages). Showing the shipped match cache.",
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

  return {
    year,
    setYear,
    status,
    error,
    teams,
    query,
    setQuery,
    stateFilter,
    leagueFilter,
    setLeagueFilter,
    applyScope,
    sortKey,
    sortDir,
    toggleSort,
    page,
    setPage,
    pageSafe,
    pageCount,
    pageRows,
    filtered,
    selectedId,
    selected,
    openTeam,
    closeTeam,
    onRowKeyDown,
    sosMap,
    pinnedId,
    pinTeam,
    unpinHome,
    pinnedTeam,
    matchRefreshNonce,
    refreshingMatches,
    refreshNote,
    refreshFromGotsport,
    caInYear,
    showMethod,
    setShowMethod,
    pageView,
    setPageView,
    formatPoints,
    formatRecord,
    formatScore,
    publishedRecord,
  };
}

export type SoccerRankingsModel = ReturnType<typeof useSoccerRankings>;
