import meta from "@/data/soccer-rankings/matches-meta.json";
import mlsNextPublic from "@/data/soccer-rankings/mls-next-public.json";
import type {
  CompactMatch,
  MatchLoadResult,
  NotOnPublicFeed,
  RankedTeam,
  SosSummary,
} from "./types";

type MatchesFile = {
  asOf: string;
  since: string;
  source: string;
  homeTeamId: number;
  counts?: { teamsWithMatches: number; teamsFetched: number; matches: number };
  teams: Record<string, CompactMatch[]>;
};

export const MATCH_CACHE_META = {
  asOf: meta.asOf,
  compiledAt: (meta as { compiledAt?: string }).compiledAt ?? meta.asOf,
  since: meta.since,
  source: meta.source,
  teamsWithMatches: meta.teamsWithMatches,
  matches: meta.matches,
};

export const NOT_ON_PUBLIC_FEED: NotOnPublicFeed | null =
  ((meta as { notOnPublicFeed?: NotOnPublicFeed }).notOnPublicFeed as
    | NotOnPublicFeed
    | undefined) ?? null;

export function notOnPublicFeedFor(gotsportId: number | null): NotOnPublicFeed | null {
  if (!NOT_ON_PUBLIC_FEED || gotsportId == null) return null;
  const ids = [
    NOT_ON_PUBLIC_FEED.homeTeamId,
    NOT_ON_PUBLIC_FEED.opponentTeamId,
  ].filter((id): id is number => typeof id === "number");
  return ids.includes(gotsportId) ? NOT_ON_PUBLIC_FEED : null;
}

const META_COUNTS: Record<string, number> =
  (meta as { gameCounts?: Record<string, number> }).gameCounts ?? {};

let filePromise: Promise<MatchesFile> | null = null;

export function loadCacheFile(): Promise<MatchesFile> {
  if (!filePromise) {
    filePromise = import("@/data/soccer-rankings/matches.json").then(
      (m) => m.default as MatchesFile,
    );
  }
  return filePromise;
}

const memory = new Map<number, CompactMatch[]>();

/** Drop in-memory live match lists so the next load hits GotSport again. */
export function clearLiveMatchCache(gotsportId?: number): void {
  if (gotsportId == null) {
    memory.clear();
    return;
  }
  memory.delete(gotsportId);
}

export function gotsportNumericId(teamId: string | undefined): number | null {
  if (!teamId) return null;
  const m = /^gs-(\d+)$/.exec(teamId);
  return m ? Number(m[1]) : null;
}

export function cachedMatchCount(teamId: string): number {
  const id = gotsportNumericId(teamId);
  if (id == null) return 0;
  return META_COUNTS[String(id)] ?? 0;
}

export function eventHref(eventId?: number | null): string | null {
  if (!eventId) return null;
  return `https://system.gotsport.com/org_event/events/${eventId}`;
}

export function matchesApiHref(gotsportId: number): string {
  return `https://system.gotsport.com/api/v1/teams/${gotsportId}/matches`;
}

export function resultFor(
  focusId: number,
  match: CompactMatch,
): "W" | "D" | "L" | null {
  if (match.homeScore == null || match.awayScore == null) return null;
  const gf = match.homeId === focusId ? match.homeScore : match.awayScore;
  const ga = match.homeId === focusId ? match.awayScore : match.homeScore;
  if (gf === ga) return "D";
  return gf > ga ? "W" : "L";
}

export function opponentOf(
  focusId: number,
  match: CompactMatch,
): { id: number | null; name: string } {
  if (match.homeId === focusId) {
    return { id: match.awayId, name: match.awayName };
  }
  return { id: match.homeId, name: match.homeName };
}

function liveUrls(gotsportId: number): string[] {
  return [
    `/gotsport-api/api/v1/teams/${gotsportId}/matches`,
    matchesApiHref(gotsportId),
  ];
}

function compactFromLive(row: Record<string, unknown>): CompactMatch | null {
  const home = (row.homeTeam as { team_id?: number; full_name?: string }) || {};
  const away = (row.awayTeam as { team_id?: number; full_name?: string }) || {};
  if (!home.full_name && !away.full_name && !row.title) return null;
  const hs = row.home_score;
  const aws = row.away_score;
  const blob = `${row.event_name ?? ""} ${row.competition_name ?? ""} ${row.division_name ?? ""}`.toLowerCase();
  let kind: CompactMatch["kind"] = "unknown";
  if (
    /cup|showcase|classic|invite|tournament|stampede|super cup|futsal|shootout|playdate/.test(
      blob,
    )
  ) {
    kind = "tournament";
  } else if (/league|npl|ecnl|conference|mls next|flight/.test(blob)) {
    kind = "league";
  }
  return {
    id: Number(row.id) || 0,
    date: typeof row.match_date === "string" ? row.match_date : null,
    event: String(row.event_name ?? "").slice(0, 80),
    eventId: typeof row.event_id === "number" ? row.event_id : null,
    competition: String(row.competition_name ?? "").slice(0, 60),
    division: String(row.division_name ?? "").slice(0, 60),
    kind,
    homeId: home.team_id ?? null,
    homeName: String(home.full_name ?? row.title ?? "Unknown").slice(0, 80),
    awayId: away.team_id ?? null,
    awayName: String(away.full_name ?? "Unknown").slice(0, 80),
    homeScore: typeof hs === "number" ? hs : null,
    awayScore: typeof aws === "number" ? aws : null,
    winnerId: typeof row.winner_team_id === "number" ? row.winner_team_id : null,
  };
}

async function fetchLive(gotsportId: number): Promise<CompactMatch[] | null> {
  for (const url of liveUrls(gotsportId)) {
    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) continue;
      const data: unknown = await resp.json();
      if (!Array.isArray(data)) continue;
      const rows = data
        .map((row) =>
          row && typeof row === "object"
            ? compactFromLive(row as Record<string, unknown>)
            : null,
        )
        .filter((m): m is CompactMatch => m != null);
      const recent = rows.filter((m) => (m.date ?? "") >= MATCH_CACHE_META.since);
      const picked =
        recent.length >= 8
          ? recent
          : rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 40);
      picked.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      return picked;
    } catch {
      /* try next URL — CORS or missing proxy */
    }
  }
  return null;
}

type MlsNextPublicFile = {
  matches?: Array<{
    id?: number;
    date?: string | null;
    ageBand?: string;
    homeOrgId?: number | null;
    homeName?: string;
    awayOrgId?: number | null;
    awayName?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    event?: string;
  }>;
  teams?: Array<{
    orgId: number;
    name: string;
    ageBand: string;
    conferenceRank?: number | null;
  }>;
};

const MLS_NEXT_FILE = mlsNextPublic as MlsNextPublicFile;

function overlayOrg(teamId: string): { orgId: number; ageBand: string } | null {
  const m = /^mlsnext-(\d+)-(U1[2-6])$/.exec(teamId);
  if (!m) return null;
  return { orgId: Number(m[1]), ageBand: m[2] };
}

export function mlsNextMatchesFor(
  orgId: number,
  ageBand?: string,
): CompactMatch[] {
  return (MLS_NEXT_FILE.matches ?? [])
    .filter(
      (m) =>
        (m.homeOrgId === orgId || m.awayOrgId === orgId) &&
        (!ageBand || m.ageBand === ageBand),
    )
    .map((m) => ({
      id: Number(m.id) || 0,
      date: m.date ?? null,
      event: m.event ?? "MLS NEXT League 26/27",
      eventId: null,
      competition: "MLS NEXT League 26/27",
      kind: "league" as const,
      homeId: m.homeOrgId ?? null,
      homeName: m.homeName ?? "Unknown",
      awayId: m.awayOrgId ?? null,
      awayName: m.awayName ?? "Unknown",
      homeScore: m.homeScore ?? null,
      awayScore: m.awayScore ?? null,
      winnerId: null,
    }));
}

export async function loadTeamMatches(teamId: string): Promise<MatchLoadResult> {
  const overlay = overlayOrg(teamId);
  if (overlay) {
    const matches = mlsNextMatchesFor(overlay.orgId, overlay.ageBand);
    return {
      matches,
      source: matches.length ? "cache" : "none",
      partial: true,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: overlay.orgId,
      error: matches.length
        ? undefined
        : "No completed MLS NEXT League 26/27 games published yet.",
    };
  }
  const gotsportId = gotsportNumericId(teamId);
  if (gotsportId == null) {
    return {
      matches: [],
      source: "none",
      partial: true,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: null,
      error: "No GotSport team id — overlay stub only.",
    };
  }
  if (memory.has(gotsportId)) {
    return {
      matches: memory.get(gotsportId) ?? [],
      source: "live",
      partial: false,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: gotsportId,
    };
  }
  const file = await loadCacheFile();
  const cachedRows = file.teams[String(gotsportId)] ?? [];
  const live = await fetchLive(gotsportId);
  if (live && live.length) {
    memory.set(gotsportId, live);
    return {
      matches: live,
      source: "live",
      partial: false,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: gotsportId,
    };
  }
  if (cachedRows.length) {
    return {
      matches: cachedRows,
      source: "cache",
      partial: true,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: gotsportId,
    };
  }
  return {
    matches: [],
    source: "none",
    partial: true,
    since: MATCH_CACHE_META.since,
    gotsportTeamId: gotsportId,
    error:
      "Full match list is not in the shipped cache, and the live GotSport API is blocked in this browser (no CORS on GitHub Pages). Open GotSport or refresh via the ingest script.",
  };
}

export async function refreshTeamMatches(
  teamId: string,
): Promise<MatchLoadResult> {
  const id = gotsportNumericId(teamId);
  if (id != null) memory.delete(id);
  return loadTeamMatches(teamId);
}

export function byGotsportId(teams: RankedTeam[]): Map<number, RankedTeam> {
  const map = new Map<number, RankedTeam>();
  for (const t of teams) {
    const id = gotsportNumericId(t.id);
    if (id != null) map.set(id, t);
  }
  return map;
}

export function opponentCue(
  usRank?: number,
  stateRank?: number,
  state?: string,
): "strong" | "average" | "weaker" | "unranked" {
  if (usRank == null && stateRank == null) return "unranked";
  if (usRank != null && usRank <= 50) return "strong";
  if (state === "CA" && stateRank != null && stateRank <= 10) return "strong";
  if (usRank != null && usRank <= 200) return "average";
  if (stateRank != null && stateRank <= 25) return "average";
  if (usRank == null && stateRank == null) return "unranked";
  return "weaker";
}

export async function sosByTeamId(
  yearTeams: RankedTeam[],
): Promise<Map<string, SosSummary>> {
  const file = await loadCacheFile();
  const index = byGotsportId(yearTeams);
  const map = new Map<string, SosSummary>();
  const mlsRank = new Map<number, number>();
  for (const row of MLS_NEXT_FILE.teams ?? []) {
    if (row.conferenceRank != null) mlsRank.set(row.orgId, row.conferenceRank);
  }
  for (const t of yearTeams) {
    const overlay = overlayOrg(t.id);
    if (overlay) {
      const rows = mlsNextMatchesFor(overlay.orgId, overlay.ageBand);
      if (rows.length) {
        const ranks = rows
          .map((m) => {
            const opp = overlay.orgId === m.homeId ? m.awayId : m.homeId;
            return opp != null ? mlsRank.get(opp) : undefined;
          })
          .filter((n): n is number => n != null)
          .sort((a, b) => a - b);
        const median =
          ranks.length === 0
            ? null
            : ranks.length % 2
              ? ranks[(ranks.length - 1) / 2]
              : Math.round(
                  (ranks[ranks.length / 2 - 1] + ranks[ranks.length / 2]) / 2,
                );
        map.set(t.id, {
          played: rows.filter((m) => m.homeScore != null && m.awayScore != null)
            .length,
          listed: rows.length,
          opponentsInSeed: ranks.length,
          medianOpponentUsRank: median,
          top50Us: ranks.filter((n) => n <= 3).length,
          top100Us: ranks.filter((n) => n <= 6).length,
          top10State: ranks.filter((n) => n <= 3).length,
        });
      }
      continue;
    }
    const id = gotsportNumericId(t.id);
    if (id == null) continue;
    const rows = file.teams[String(id)];
    if (!rows?.length) continue;
    map.set(t.id, summarizeSos(id, rows, index));
  }
  return map;
}

export function summarizeSos(
  focusId: number,
  matches: CompactMatch[],
  index: Map<number, RankedTeam>,
): SosSummary {
  const ranks: number[] = [];
  let top50 = 0;
  let top100 = 0;
  let top10State = 0;
  let inSeed = 0;
  let scored = 0;
  for (const m of matches) {
    if (m.homeScore != null && m.awayScore != null) scored += 1;
    const opp = opponentOf(focusId, m);
    if (opp.id == null) continue;
    const team = index.get(opp.id);
    if (!team) continue;
    inSeed += 1;
    ranks.push(team.usRank);
    if (team.usRank <= 50) top50 += 1;
    if (team.usRank <= 100) top100 += 1;
    if (team.stateRank <= 10) top10State += 1;
  }
  const sorted = [...ranks].sort((a, b) => a - b);
  const median =
    sorted.length === 0
      ? null
      : sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : Math.round(
            (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
          );
  return {
    played: scored,
    listed: matches.length,
    opponentsInSeed: inSeed,
    medianOpponentUsRank: median,
    top50Us: top50,
    top100Us: top100,
    top10State,
  };
}
