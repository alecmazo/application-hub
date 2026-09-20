/**
 * League-only match lists for a CA table side.
 *
 * MLS NEXT: League Viewer schedule JSON (completed games with both scores).
 * ECNL: AthleteOne get-individual-team-info/{orgId}/{eventId}/{clubId}/{teamId}
 * (displayTeamInfo(org,event,team,club) → that path). The #schedules-table-content
 * RESULTS column publishes "N - N" when a box score exists. Club-wide
 * get-club-schedules-by-eventID-and-clubID is a fallback only (huge).
 *
 * Never invents scores. Unpublished games stay N/A.
 */
import ecnlMatchesSeed from "@/data/soccer-rankings/ecnl-matches.json";
import type { LeagueTableRow } from "./league-tables";
import {
  mlsNextMatchesFor,
  opponentOf,
  resultFor,
  type MlsNextOverlay,
} from "./matches";
import type { CompactMatch } from "./types";

export const ATHLETEONE_ORG_ID = 12;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const AGE_HEADING: Record<string, string> = {
  U13: "BU13",
  U14: "BU14",
  U15: "BU15",
  U16: "BU16",
};

const TR_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const TEAM_SPAN_RE = /data-team-id="(\d+)"[^>]*>([^<]+)<\/span>/gi;
const DATE_RE =
  /font-weight:\s*bold[^>]*>\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s*</i;
const DIV_RE = />(BU1[3-6])\s*-\s*([^<]+)</i;
const MATCH_ID_RE = /data-match-id="(\d+)"/;
const GAME_NUM_RE = /<div>(\d{5,})<\/div>/;
const HA_MARK_RE =
  /min-height:\s*63px[^>]*>\s*([AH])\s*<\/div>/gi;
const TEAM_INFO_DATE_RE = /<div>([A-Za-z]{3}\s+\d{1,2},\s+\d{4})<\/div>/;
const TEAM_INFO_GAME_RE = /#(\d{5,})/;
const TEAM_INFO_OPP_RE =
  /class="individual-team-item"[^>]*data-team-id="(\d+)"[^>]*>([^<]+)</i;
const TEAM_INFO_OPP_RE_ALT =
  /data-team-id="(\d+)"[^>]*class="individual-team-item"[^>]*>([^<]+)</i;
const TEAM_INFO_SCORE_RE = /<span>\s*(\d+)\s*-\s*(\d+)\s*<\/span>/;

export type LeagueMatchLoad = {
  matches: CompactMatch[];
  focusId: number | null;
  source: "live" | "cache" | "none";
  competition: string;
  endpointsTried: string[];
  error?: string;
};

type EcnlMatchesFile = {
  asOf?: string;
  source?: string;
  teams?: Record<string, CompactMatch[]>;
};

const ECNL_MATCHES_SEED = ecnlMatchesSeed as EcnlMatchesFile;
const teamInfoCache = new Map<string, CompactMatch[]>();
let liveEcnlMatches: Record<string, CompactMatch[]> | null = null;

function corsProxied(url: string): string[] {
  return [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.org/?${encodeURIComponent(url)}`,
  ];
}

function athleteOneUrls(script: string, parts: Array<string | number>): string[] {
  const path = `/api/Script/${script}/${parts.join("/")}`;
  const canonical = `https://api.athleteone.com${path}`;
  return [`/athleteone-api${path}`, canonical, ...corsProxied(canonical)];
}

async function fetchHtml(urls: string[], tried: string[]): Promise<string | null> {
  for (const url of urls) {
    tried.push(url);
    try {
      const headers: Record<string, string> = {
        Accept: "text/html,application/json,*/*",
        "User-Agent": BROWSER_UA,
      };
      if (!url.startsWith("/")) {
        headers.Origin = "https://theecnl.com";
        headers.Referer = "https://theecnl.com/";
      }
      const resp = await fetch(url, { headers, cache: "no-store" });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text || text.length < 40) continue;
      if (/"status"\s*:\s*99|"title"\s*:\s*"Forbidden"/.test(text)) continue;
      return text;
    } catch {
      /* next */
    }
  }
  return null;
}

function parseMonthDate(raw: string): string | null {
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function winnerId(
  homeId: number | null,
  awayId: number | null,
  homeScore: number | null,
  awayScore: number | null,
): number | null {
  if (homeScore == null || awayScore == null || homeScore === awayScore) {
    return null;
  }
  return homeScore > awayScore ? homeId : awayId;
}

function toMatch(opts: {
  id: number;
  date: string | null;
  event: string;
  competition: string;
  homeId: number | null;
  homeName: string;
  awayId: number | null;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
}): CompactMatch {
  return {
    id: opts.id,
    date: opts.date,
    event: opts.event,
    eventId: null,
    competition: opts.competition,
    kind: "league",
    homeId: opts.homeId,
    homeName: opts.homeName,
    awayId: opts.awayId,
    awayName: opts.awayName,
    homeScore: opts.homeScore,
    awayScore: opts.awayScore,
    winnerId: winnerId(
      opts.homeId,
      opts.awayId,
      opts.homeScore,
      opts.awayScore,
    ),
  };
}

/** Played (scored) first, then other past, then upcoming. */
export function sortLeagueMatches(matches: CompactMatch[]): CompactMatch[] {
  const today = todayIso();
  return [...matches].sort((a, b) => {
    const aScored = a.homeScore != null && a.awayScore != null;
    const bScored = b.homeScore != null && b.awayScore != null;
    if (aScored !== bScored) return aScored ? -1 : 1;
    const aFuture = Boolean(a.date && a.date > today);
    const bFuture = Boolean(b.date && b.date > today);
    if (aFuture !== bFuture) return aFuture ? 1 : -1;
    if (aFuture) return (a.date ?? "").localeCompare(b.date ?? "");
    return (b.date ?? "").localeCompare(a.date ?? "");
  });
}

/**
 * Parse get-individual-team-info HTML. Scores in RESULTS are the selected
 * side first (us–them), not home–away. Unpublished rows have Preview only.
 */
export function parseAthleteOneTeamInfo(
  html: string,
  opts: { teamId: number; teamName: string; event: string },
): CompactMatch[] {
  const start = html.indexOf('id="schedules-table-content"');
  if (start < 0) return [];
  const end = html.indexOf('id="events-table-content"', start);
  const block = html.slice(start, end > start ? end : undefined);
  const marks: Array<{ ha: "H" | "A"; index: number }> = [];
  const haRe = new RegExp(HA_MARK_RE.source, "gi");
  let mark: RegExpExecArray | null;
  while ((mark = haRe.exec(block))) {
    marks.push({ ha: mark[1] as "H" | "A", index: mark.index });
  }
  const rows: CompactMatch[] = [];
  for (let i = 0; i < marks.length; i++) {
    const chunk = block.slice(marks[i].index, marks[i + 1]?.index ?? block.length);
    const dateRaw = TEAM_INFO_DATE_RE.exec(chunk)?.[1] ?? "";
    const matchId = Number(
      TEAM_INFO_GAME_RE.exec(chunk)?.[1] ?? MATCH_ID_RE.exec(chunk)?.[1] ?? 0,
    );
    const opp =
      TEAM_INFO_OPP_RE.exec(chunk) ?? TEAM_INFO_OPP_RE_ALT.exec(chunk);
    if (!opp) continue;
    const oppId = Number(opp[1]);
    const oppName = opp[2].trim();
    if (!oppName || oppId === opts.teamId) continue;
    const score = TEAM_INFO_SCORE_RE.exec(chunk);
    const us = score ? Number(score[1]) : null;
    const them = score ? Number(score[2]) : null;
    const focusHome = marks[i].ha === "H";
    rows.push(
      toMatch({
        id: matchId,
        date: parseMonthDate(dateRaw),
        event: opts.event,
        competition: opts.event,
        homeId: focusHome ? opts.teamId : oppId,
        homeName: focusHome ? opts.teamName : oppName,
        awayId: focusHome ? oppId : opts.teamId,
        awayName: focusHome ? oppName : opts.teamName,
        homeScore: us == null || them == null ? null : focusHome ? us : them,
        awayScore: us == null || them == null ? null : focusHome ? them : us,
      }),
    );
  }
  return sortLeagueMatches(rows);
}

export function parseAthleteOneClubSchedule(
  html: string,
  opts: { teamId: number; teamName?: string; ageBand: string; event: string },
): CompactMatch[] {
  const wantAge = AGE_HEADING[opts.ageBand];
  const rows: CompactMatch[] = [];
  const trRe = new RegExp(TR_RE.source, "gi");
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const chunk = tr[1];
    if (!chunk.includes(`data-team-id="${opts.teamId}"`)) continue;
    const div = DIV_RE.exec(chunk);
    if (wantAge && div && div[1] !== wantAge) continue;
    const teams: Array<{ id: number; name: string }> = [];
    const spanRe = new RegExp(TEAM_SPAN_RE.source, "gi");
    let span: RegExpExecArray | null;
    while ((span = spanRe.exec(chunk))) {
      teams.push({ id: Number(span[1]), name: span[2].trim() });
    }
    if (teams.length < 2) continue;
    if (!teams.some((t) => t.id === opts.teamId)) continue;
    const dateRaw = DATE_RE.exec(chunk)?.[1] ?? "";
    const matchId =
      Number(MATCH_ID_RE.exec(chunk)?.[1] ?? GAME_NUM_RE.exec(chunk)?.[1] ?? 0) ||
      0;
    const eventLabel = div ? `${div[1]} · ${div[2].trim()}` : opts.event;
    const score = TEAM_INFO_SCORE_RE.exec(chunk);
    rows.push(
      toMatch({
        id: matchId,
        date: parseMonthDate(dateRaw),
        event: eventLabel,
        competition: opts.event,
        homeId: teams[0].id,
        homeName: teams[0].name,
        awayId: teams[1].id,
        awayName: teams[1].name,
        homeScore: score ? Number(score[1]) : null,
        awayScore: score ? Number(score[2]) : null,
      }),
    );
  }
  return sortLeagueMatches(rows);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function applyLiveEcnlMatches(
  partial: Record<string, CompactMatch[]>,
): void {
  const base: Record<string, CompactMatch[]> = {
    ...(liveEcnlMatches ?? ECNL_MATCHES_SEED.teams ?? {}),
  };
  for (const [id, matches] of Object.entries(partial)) {
    if (matches.length) base[id] = matches;
  }
  liveEcnlMatches = base;
}

export function cachedEcnlMatches(teamId: number): CompactMatch[] {
  const key = String(teamId);
  return (
    teamInfoCache.get(key) ??
    liveEcnlMatches?.[key] ??
    ECNL_MATCHES_SEED.teams?.[key] ??
    []
  );
}

export function scoredMatchCount(matches: CompactMatch[]): number {
  return matches.filter((m) => m.homeScore != null && m.awayScore != null)
    .length;
}

async function fetchTeamInfoMatches(
  row: Pick<
    LeagueTableRow,
    "athleteOneTeamId" | "athleteOneClubId" | "eventId" | "name" | "ageBand"
  >,
  competition: string,
  tried: string[],
): Promise<CompactMatch[]> {
  const teamId = row.athleteOneTeamId;
  const clubId = row.athleteOneClubId;
  const eventId = row.eventId;
  if (teamId == null || clubId == null || eventId == null) return [];
  const html = await fetchHtml(
    athleteOneUrls("get-individual-team-info", [
      ATHLETEONE_ORG_ID,
      eventId,
      clubId,
      teamId,
    ]),
    tried,
  );
  if (!html) return [];
  return parseAthleteOneTeamInfo(html, {
    teamId,
    teamName: row.name,
    event: competition,
  });
}

export async function refreshEcnlSchedules(
  rows: Array<{
    athleteOneTeamId?: number;
    athleteOneClubId?: number;
    eventId?: number;
    name: string;
    ageBand: string;
    conference?: string;
  }>,
  tried: string[],
  errors: string[],
): Promise<{ teams: number; matches: number; scored: number }> {
  const overlay: Record<string, CompactMatch[]> = {};
  const queue = rows.filter(
    (row) =>
      row.athleteOneTeamId != null &&
      row.athleteOneClubId != null &&
      row.eventId != null,
  );
  const concurrency = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const row = queue[cursor];
      cursor += 1;
      const competition = `ECNL ${row.conference ?? ""} ${row.ageBand}`.trim();
      try {
        const matches = await fetchTeamInfoMatches(row, competition, tried);
        if (matches.length && row.athleteOneTeamId != null) {
          overlay[String(row.athleteOneTeamId)] = matches;
          teamInfoCache.set(String(row.athleteOneTeamId), matches);
        }
      } catch {
        errors.push(`AthleteOne team-info failed for ${row.name}.`);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()),
  );
  applyLiveEcnlMatches(overlay);
  const matches = Object.values(overlay).flat();
  return {
    teams: Object.keys(overlay).length,
    matches: matches.length,
    scored: scoredMatchCount(matches),
  };
}

async function loadEcnlLeagueMatches(
  row: LeagueTableRow,
): Promise<LeagueMatchLoad> {
  const tried: string[] = [];
  const teamId = row.athleteOneTeamId;
  const clubId = row.athleteOneClubId;
  const eventId = row.eventId;
  const competition = `ECNL ${row.conference} ${row.ageBand}`;
  if (teamId == null || clubId == null || eventId == null) {
    return {
      matches: [],
      focusId: teamId ?? null,
      source: "none",
      competition,
      endpointsTried: tried,
      error:
        "This ECNL row has no AthleteOne team/club/event ids, so the conference schedule cannot be queried. Nothing was invented.",
    };
  }

  const cached = cachedEcnlMatches(teamId);
  if (cached.length) {
    return {
      matches: cached,
      focusId: teamId,
      source: liveEcnlMatches?.[String(teamId)] ? "live" : "cache",
      competition,
      endpointsTried: tried,
    };
  }

  const live = await fetchTeamInfoMatches(row, competition, tried);
  if (live.length) {
    teamInfoCache.set(String(teamId), live);
    applyLiveEcnlMatches({ [String(teamId)]: live });
    return {
      matches: live,
      focusId: teamId,
      source: "live",
      competition,
      endpointsTried: tried,
    };
  }

  const clubHtml = await fetchHtml(
    athleteOneUrls("get-club-schedules-by-eventID-and-clubID", [
      eventId,
      clubId,
    ]),
    tried,
  );
  const clubMatches = clubHtml
    ? parseAthleteOneClubSchedule(clubHtml, {
        teamId,
        teamName: row.name,
        ageBand: row.ageBand,
        event: competition,
      })
    : [];
  if (clubMatches.length) {
    teamInfoCache.set(String(teamId), clubMatches);
    return {
      matches: clubMatches,
      focusId: teamId,
      source: "live",
      competition,
      endpointsTried: tried,
      error: scoredMatchCount(clubMatches)
        ? undefined
        : "Opponents are from the AthleteOne club schedule. Scores stay N/A unless a published result was in the row.",
    };
  }

  return {
    matches: [],
    focusId: teamId,
    source: "none",
    competition,
    endpointsTried: tried,
    error:
      "AthleteOne get-individual-team-info was empty or blocked (Referer theecnl.com). No invented scores.",
  };
}

function loadMlsLeagueMatches(row: LeagueTableRow): LeagueMatchLoad {
  const competition = `MLS NEXT ${row.tierLabel} · ${row.conference}`;
  if (row.orgId == null) {
    return {
      matches: [],
      focusId: null,
      source: "none",
      competition,
      endpointsTried: [],
      error:
        "This MLS NEXT row has no League Viewer org id. Nothing was invented.",
    };
  }
  const overlay: MlsNextOverlay = {
    orgId: row.orgId,
    ageBand: row.ageBand,
    division: row.tier === "homegrown" ? "homegrown" : "academy",
  };
  const matches = sortLeagueMatches(
    mlsNextMatchesFor(overlay.orgId, overlay.ageBand, overlay.division),
  );
  return {
    matches,
    focusId: row.orgId,
    source: matches.length ? "cache" : "none",
    competition,
    endpointsTried: [
      "mls-next-public.json / live League Viewer schedule overlay",
    ],
    error: matches.length
      ? undefined
      : "No completed MLS NEXT League Viewer games for this org / age / division. Unplayed stays empty — nothing invented.",
  };
}

export async function loadLeagueMatches(
  row: LeagueTableRow,
): Promise<LeagueMatchLoad> {
  if (row.pathway === "mls-next") return loadMlsLeagueMatches(row);
  return loadEcnlLeagueMatches(row);
}

export function leagueResultFor(
  load: LeagueMatchLoad,
  match: CompactMatch,
): "W" | "D" | "L" | null {
  if (load.focusId == null) return null;
  return resultFor(load.focusId, match);
}

export function leagueOpponent(
  load: LeagueMatchLoad,
  match: CompactMatch,
): { id: number | null; name: string } {
  if (load.focusId == null) {
    return { id: match.awayId, name: match.awayName };
  }
  return opponentOf(load.focusId, match);
}
