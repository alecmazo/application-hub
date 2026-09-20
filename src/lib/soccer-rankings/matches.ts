import meta from "@/data/soccer-rankings/matches-meta.json";
import mlsNextPublic from "@/data/soccer-rankings/mls-next-public.json";
import { listMlsPublicTeams } from "./league-tables";
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

const memory = new Map<string, CompactMatch[]>();

/** Drop in-memory live match lists so the next load hits GotSport again. */
export function clearLiveMatchCache(teamKey?: string): void {
  if (teamKey == null) {
    memory.clear();
    return;
  }
  memory.delete(teamKey);
}

export function gotsportNumericId(
  teamId: string | undefined,
  fallback?: number | null,
): number | null {
  if (fallback != null && Number.isFinite(fallback)) return fallback;
  if (!teamId) return null;
  const m = /^gs-(\d+)$/.exec(teamId);
  return m ? Number(m[1]) : null;
}

export function cachedMatchCount(
  teamId: string,
  mlsNext?: MlsNextOverlay | null,
): number {
  const overlay = mlsNext ?? overlayOrg(teamId);
  if (overlay) {
    const n = mlsNextMatchesFor(
      overlay.orgId,
      overlay.ageBand,
      overlay.division,
    ).length;
    if (n) return n;
  }
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

export function mlsNextScheduleHref(
  division?: "academy" | "homegrown" | string | null,
): string {
  const feed =
    MLS_NEXT_SCHEDULE_URLS.find((f) => f.division === division) ??
    MLS_NEXT_SCHEDULE_URLS[0];
  return feed.url;
}

/** Prefer the MLS NEXT org id when the match list is League Viewer rows. */
export function matchFocusId(
  load: Pick<MatchLoadResult, "gotsportTeamId" | "mlsNextOrgId" | "matches">,
  overlay?: MlsNextOverlay | null,
): number | null {
  const orgId = overlay?.orgId ?? load.mlsNextOrgId ?? null;
  if (
    orgId != null &&
    load.matches.some((m) => m.homeId === orgId || m.awayId === orgId)
  ) {
    return orgId;
  }
  return load.gotsportTeamId ?? orgId;
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

const GOTSPORT_ORIGIN = "https://system.gotsport.com";

function corsProxied(url: string): string[] {
  return [
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];
}

function liveUrls(gotsportId: number): string[] {
  const matches = `${GOTSPORT_ORIGIN}/api/v1/teams/${gotsportId}/matches`;
  const past = `${matches}?past=true&page=1&per_page=50`;
  const ranking = `${GOTSPORT_ORIGIN}/api/v1/team_ranking_data?team_id=${gotsportId}`;
  return [
    `/gotsport-api/api/v1/teams/${gotsportId}/matches`,
    `/gotsport-api/api/v1/teams/${gotsportId}/matches?past=true&page=1&per_page=50`,
    `/gotsport-api/api/v1/team_ranking_data?team_id=${gotsportId}`,
    matches,
    past,
    ranking,
    ...corsProxied(matches),
    ...corsProxied(past),
    ...corsProxied(ranking),
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

function pickMatches(rows: CompactMatch[]): CompactMatch[] {
  const recent = rows.filter((m) => (m.date ?? "") >= MATCH_CACHE_META.since);
  const picked =
    recent.length >= 8
      ? recent
      : [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 40);
  picked.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return picked;
}

function rowsFromPayload(data: unknown): CompactMatch[] {
  const list: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? ((data as { matches?: unknown[] }).matches ?? [])
      : [];
  return list
    .map((row) =>
      row && typeof row === "object"
        ? compactFromLive(row as Record<string, unknown>)
        : null,
    )
    .filter((m): m is CompactMatch => m != null);
}

async function fetchLive(
  gotsportId: number,
): Promise<{ matches: CompactMatch[] | null; tried: string[]; hit?: string }> {
  const tried: string[] = [];
  for (const url of liveUrls(gotsportId)) {
    tried.push(url);
    try {
      const resp = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!resp.ok) continue;
      const data: unknown = await resp.json();
      const rows = rowsFromPayload(data);
      if (!rows.length) continue;
      return { matches: pickMatches(rows), tried, hit: url };
    } catch {
      /* try next URL — CORS or missing proxy */
    }
  }
  return { matches: null, tried };
}

type MlsNextPublicFile = {
  matches?: Array<{
    id?: number;
    date?: string | null;
    ageBand?: string;
    division?: string;
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
    division?: string;
    conferenceRank?: number | null;
  }>;
};

const MLS_NEXT_FILE = mlsNextPublic as MlsNextPublicFile;

export type MlsNextOverlayMatch = {
  id?: number;
  date?: string | null;
  ageBand?: string;
  division?: string;
  homeOrgId?: number | null;
  homeName?: string;
  awayOrgId?: number | null;
  awayName?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  event?: string;
  kind?: string;
};

let liveMlsMatches: MlsNextOverlayMatch[] | null = null;

export function applyLiveMlsMatches(matches: MlsNextOverlayMatch[]): void {
  if (!matches.length) return;
  const map = new Map<string, MlsNextOverlayMatch>();
  for (const row of MLS_NEXT_FILE.matches ?? []) {
    map.set(`${row.id}|${row.division ?? ""}|${row.ageBand ?? ""}`, row);
  }
  for (const row of matches) {
    map.set(`${row.id}|${row.division ?? ""}|${row.ageBand ?? ""}`, row);
  }
  liveMlsMatches = [...map.values()];
}

function mlsMatchRows(): MlsNextOverlayMatch[] {
  return liveMlsMatches ?? MLS_NEXT_FILE.matches ?? [];
}

export type MlsNextOverlay = {
  orgId: number;
  ageBand: string;
  division?: "academy" | "homegrown";
};

export function mlsOverlayFromTeam(team: {
  id: string;
  ageBand?: string;
  mlsNext?: { orgId?: number; division?: "academy" | "homegrown" };
}): MlsNextOverlay | null {
  const fromId = overlayOrg(team.id);
  if (fromId) return fromId;
  if (team.mlsNext?.orgId != null) {
    return {
      orgId: team.mlsNext.orgId,
      ageBand: team.ageBand ?? "U13",
      division: team.mlsNext.division,
    };
  }
  return null;
}

export function overlayOrg(teamId: string): MlsNextOverlay | null {
  const m = /^mlsnext-(\d+)-(U1[2-6])(?:-(hg|ad))?$/.exec(teamId);
  if (!m) return null;
  const division =
    m[3] === "hg" ? "homegrown" : m[3] === "ad" ? "academy" : undefined;
  return { orgId: Number(m[1]), ageBand: m[2], division };
}

export function mlsNextMatchesFor(
  orgId: number,
  ageBand?: string,
  division?: string,
): CompactMatch[] {
  return mlsMatchRows()
    .filter(
      (m) =>
        (m.homeOrgId === orgId || m.awayOrgId === orgId) &&
        (!ageBand || m.ageBand === ageBand) &&
        (!division || !m.ageBand || m.division == null || m.division === division),
    )
    .map((m) => ({
      id: Number(m.id) || 0,
      date: m.date ?? null,
      event: m.event ?? "MLS NEXT League 26/27",
      eventId: null,
      competition: m.event ?? "MLS NEXT League 26/27",
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

function recordFromMatches(
  focusId: number,
  matches: CompactMatch[],
): { w: number; d: number; l: number } | undefined {
  let w = 0;
  let d = 0;
  let l = 0;
  for (const m of matches) {
    const r = resultFor(focusId, m);
    if (r === "W") w += 1;
    else if (r === "D") d += 1;
    else if (r === "L") l += 1;
  }
  if (w + d + l === 0) return undefined;
  return { w, d, l };
}

const MLS_NEXT_SCHEDULE_URLS = [
  {
    division: "homegrown" as const,
    url: "https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-league-26-27.json",
  },
  {
    division: "academy" as const,
    url: "https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-2-academy-division-26-27.json",
  },
];

function emptyResult(
  partial: Partial<MatchLoadResult> & { endpointsTried: string[] },
): MatchLoadResult {
  return {
    matches: [],
    source: "none",
    partial: true,
    since: MATCH_CACHE_META.since,
    gotsportTeamId: null,
    ...partial,
  };
}

export async function loadTeamMatches(
  teamId: string,
  opts?: { live?: boolean; gotsportTeamId?: number | null; mlsNext?: MlsNextOverlay | null },
): Promise<MatchLoadResult> {
  const overlay = opts?.mlsNext ?? overlayOrg(teamId);
  const gotsportId = gotsportNumericId(teamId, opts?.gotsportTeamId ?? null);
  const cacheKey = `${teamId}:${gotsportId ?? ""}:${overlay?.orgId ?? ""}:${overlay?.division ?? ""}`;
  const forceLive = Boolean(opts?.live);

  if (!forceLive && memory.has(cacheKey)) {
    const matches = memory.get(cacheKey) ?? [];
    return {
      matches,
      source: "live",
      partial: false,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: gotsportId,
      mlsNextOrgId: overlay?.orgId ?? null,
      record: gotsportId != null ? recordFromMatches(gotsportId, matches) : undefined,
      endpointsTried: [],
    };
  }

  const endpointsTried: string[] = [];

  if (overlay) {
    const cachedMls = mlsNextMatchesFor(
      overlay.orgId,
      overlay.ageBand,
      overlay.division,
    );
    if (forceLive) {
      const liveMls = await fetchLiveMlsNext(
        overlay.orgId,
        overlay.ageBand,
        overlay.division,
        endpointsTried,
      );
      if (liveMls && liveMls.length) {
        memory.set(cacheKey, liveMls);
        return {
          matches: liveMls,
          source: "live",
          partial: false,
          since: MATCH_CACHE_META.since,
          gotsportTeamId: gotsportId,
          mlsNextOrgId: overlay.orgId,
          record: recordFromMatches(overlay.orgId, liveMls),
          endpointsTried,
        };
      }
    }
    if (cachedMls.length && !forceLive) {
      return {
        matches: cachedMls,
        source: "cache",
        partial: true,
        since: MATCH_CACHE_META.since,
        gotsportTeamId: gotsportId,
        mlsNextOrgId: overlay.orgId,
        record: recordFromMatches(overlay.orgId, cachedMls),
        endpointsTried,
      };
    }
    if (cachedMls.length && forceLive) {
      return {
        matches: cachedMls,
        source: "cache",
        partial: true,
        since: MATCH_CACHE_META.since,
        gotsportTeamId: gotsportId,
        mlsNextOrgId: overlay.orgId,
        record: recordFromMatches(overlay.orgId, cachedMls),
        endpointsTried,
        error: `Live MLS NEXT pull returned no new games. Showing shipped cache. Tried: ${endpointsTried.join(" · ") || "shipped mls-next-public.json"}`,
      };
    }
    if (gotsportId == null) {
      const canon = MLS_NEXT_SCHEDULE_URLS.filter(
        (f) => !overlay.division || f.division === overlay.division,
      ).map((f) => f.url);
      const tried = endpointsTried.length ? endpointsTried : canon;
      return emptyResult({
        gotsportTeamId: null,
        mlsNextOrgId: overlay.orgId,
        endpointsTried: tried,
        error: `No completed MLS NEXT ${overlay.division ?? ""} ${overlay.ageBand} games in the public League Viewer feed for org ${overlay.orgId}. Tried: ${tried.join(" · ")}`,
      });
    }
  }

  if (gotsportId == null) {
    return emptyResult({
      endpointsTried: [],
      error:
        "No GotSport team id on this row — cannot query system.gotsport.com/api/v1/teams/{id}/matches.",
    });
  }

  if (forceLive || !overlay) {
    const live = await fetchLive(gotsportId);
    endpointsTried.push(...live.tried);
    if (live.matches && live.matches.length) {
      memory.set(cacheKey, live.matches);
      return {
        matches: live.matches,
        source: "live",
        partial: false,
        since: MATCH_CACHE_META.since,
        gotsportTeamId: gotsportId,
        mlsNextOrgId: overlay?.orgId ?? null,
        record: recordFromMatches(gotsportId, live.matches),
        endpointsTried,
      };
    }
  }

  const file = await loadCacheFile();
  const cachedRows = file.teams[String(gotsportId)] ?? [];
  if (cachedRows.length && !forceLive) {
    return {
      matches: cachedRows,
      source: "cache",
      partial: true,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: gotsportId,
      mlsNextOrgId: overlay?.orgId ?? null,
      record: recordFromMatches(gotsportId, cachedRows),
      endpointsTried,
    };
  }

  const triedLabel = endpointsTried.join(" · ") || matchesApiHref(gotsportId);
  if (cachedRows.length && forceLive) {
    return {
      matches: cachedRows,
      source: "cache",
      partial: true,
      since: MATCH_CACHE_META.since,
      gotsportTeamId: gotsportId,
      mlsNextOrgId: overlay?.orgId ?? null,
      record: recordFromMatches(gotsportId, cachedRows),
      endpointsTried,
      error: `GotSport live pull was empty or blocked. Showing shipped cache. Tried: ${triedLabel}`,
    };
  }

  return emptyResult({
    gotsportTeamId: gotsportId,
    mlsNextOrgId: overlay?.orgId ?? null,
    endpointsTried,
    error: `GotSport returned no matches after a live pull. Endpoints tried: ${triedLabel}`,
  });
}

export async function refreshTeamMatches(
  teamId: string,
  opts?: { gotsportTeamId?: number | null; mlsNext?: MlsNextOverlay | null },
): Promise<MatchLoadResult> {
  clearLiveMatchCache();
  return loadTeamMatches(teamId, { live: true, ...opts });
}

async function fetchLiveMlsNext(
  orgId: number,
  ageBand: string,
  division: string | undefined,
  tried: string[],
): Promise<CompactMatch[] | null> {
  const feeds = MLS_NEXT_SCHEDULE_URLS.filter(
    (f) => !division || f.division === division,
  );
  const urls: Array<{ url: string; division: "homegrown" | "academy" }> = [];
  for (const f of feeds) {
    urls.push(
      {
        url: `/mls-next-api/data/schedule/${f.url.split("/").pop()}`,
        division: f.division,
      },
      { url: f.url, division: f.division },
      ...corsProxied(f.url).map((url) => ({ url, division: f.division })),
    );
  }
  for (const { url, division: feedDivision } of urls) {
    tried.push(url);
    try {
      const resp = await fetch(url, { headers: { Accept: "application/json" } });
      if (!resp.ok) continue;
      const data: unknown = await resp.json();
      const events =
        data && typeof data === "object" && Array.isArray((data as { events?: unknown[] }).events)
          ? ((data as { events: Record<string, unknown>[] }).events)
          : [];
      const rows: CompactMatch[] = [];
      const label =
        feedDivision === "homegrown"
          ? "MLS NEXT Homegrown 26/27"
          : "MLS NEXT Academy 26/27";
      for (const ev of events) {
        const ho = (ev.home_organisation as { id?: number; name?: string }) || {};
        const ao = (ev.away_organisation as { id?: number; name?: string }) || {};
        if (ho.id !== orgId && ao.id !== orgId) continue;
        const age = String(ev.home_squad_name ?? ev.away_squad_name ?? "");
        if (!age.toUpperCase().includes(ageBand)) continue;
        const hs = ev.home_score;
        const aws = ev.away_score;
        if (!ev.completed || typeof hs !== "number" || typeof aws !== "number") {
          continue;
        }
        rows.push({
          id: Number(ev.id) || 0,
          date: typeof ev.start_time === "string" ? ev.start_time.slice(0, 10) : null,
          event: label,
          eventId: null,
          competition: label,
          kind: "league",
          homeId: ho.id ?? null,
          homeName: String(ho.name ?? "Unknown"),
          awayId: ao.id ?? null,
          awayName: String(ao.name ?? "Unknown"),
          homeScore: hs,
          awayScore: aws,
          winnerId: null,
        });
      }
      if (rows.length) {
        rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
        return rows;
      }
    } catch {
      /* next URL */
    }
  }
  return null;
}

export function byGotsportId(
  teams: RankedTeam[],
  preferDivision?: string,
): Map<number, RankedTeam> {
  const map = new Map<number, RankedTeam>();
  for (const t of teams) {
    const id = gotsportNumericId(t.id);
    if (id != null) map.set(id, t);
  }
  for (const t of teams) {
    const orgId = t.mlsNext?.orgId;
    if (orgId == null) continue;
    const existing = map.get(orgId);
    if (
      !existing ||
      (preferDivision && t.mlsNext?.division === preferDivision)
    ) {
      map.set(orgId, t);
    }
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
  for (const row of listMlsPublicTeams()) {
    if (row.conferenceRank != null) mlsRank.set(row.orgId, row.conferenceRank);
  }
  for (const t of yearTeams) {
    const overlay = mlsOverlayFromTeam(t);
    if (overlay) {
      const rows = mlsNextMatchesFor(
        overlay.orgId,
        overlay.ageBand,
        overlay.division,
      );
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
