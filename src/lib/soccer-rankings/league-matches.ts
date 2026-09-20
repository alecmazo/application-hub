/**
 * League-only match lists for a CA table side.
 *
 * MLS NEXT: League Viewer schedule JSON (completed games with both scores).
 * ECNL: AthleteOne club schedule (event + club) + box scores. get-team-schedule
 * returns 401; get-individual-team-info RESULTS is empty. Club schedule is the
 * public route that actually lists opponents.
 *
 * Never invents scores. Unscored / unpublished games stay N/A.
 */
import type { LeagueTableRow } from "./league-tables";
import {
  mlsNextMatchesFor,
  opponentOf,
  resultFor,
  type MlsNextOverlay,
} from "./matches";
import type { CompactMatch } from "./types";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const AGE_HEADING: Record<string, string> = {
  U13: "BU13",
  U14: "BU14",
  U15: "BU15",
  U16: "BU16",
};

const TR_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const TEAM_SPAN_RE =
  /data-team-id="(\d+)"[^>]*>([^<]+)<\/span>/gi;
const DATE_RE =
  /font-weight:\s*bold[^>]*>\s*([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s*</i;
const DIV_RE = />(BU1[3-6])\s*-\s*([^<]+)</i;
const MATCH_ID_RE = /data-match-id="(\d+)"/;
const GAME_NUM_RE = /<div>(\d{5,})<\/div>/;
const FT_SCORE_RE =
  /font-size:\s*30px[^>]*>\s*(\d+)\s*<\/span>[\s\S]*?>FT<\/span>[\s\S]*?font-size:\s*30px[^>]*>\s*(\d+)\s*<\/span>/i;
const TEAM_NAME_RE = /class="individual-team-item"[^>]*>([^<]+)</gi;

export type LeagueMatchLoad = {
  matches: CompactMatch[];
  focusId: number | null;
  source: "live" | "cache" | "none";
  competition: string;
  endpointsTried: string[];
  error?: string;
};

const clubScheduleCache = new Map<string, string>();

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
      const resp = await fetch(url, {
        headers: {
          Accept: "text/html,application/json,*/*",
          "User-Agent": BROWSER_UA,
        },
      });
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

export function parseAthleteOneClubSchedule(
  html: string,
  opts: { teamId: number; ageBand: string; event: string },
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
    const eventLabel = div
      ? `${div[1]} · ${div[2].trim()}`
      : opts.event;
    rows.push({
      id: matchId,
      date: parseMonthDate(dateRaw),
      event: eventLabel,
      eventId: null,
      competition: opts.event,
      kind: "league",
      homeId: teams[0].id,
      homeName: teams[0].name,
      awayId: teams[1].id,
      awayName: teams[1].name,
      homeScore: null,
      awayScore: null,
      winnerId: null,
    });
  }
  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return rows;
}

export function parseAthleteOneBoxScore(html: string): {
  homeScore: number;
  awayScore: number;
} | null {
  const ft = FT_SCORE_RE.exec(html);
  if (!ft) return null;
  return { homeScore: Number(ft[1]), awayScore: Number(ft[2]) };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function hydrateBoxScores(
  eventId: number,
  matches: CompactMatch[],
  focusId: number,
  tried: string[],
): Promise<void> {
  const today = todayIso();
  await Promise.all(
    matches.map(async (match) => {
      if (!match.id) return;
      if (match.date && match.date > today) return;
      const html = await fetchHtml(
        athleteOneUrls("get-box-score", [eventId, match.id, focusId]),
        tried,
      );
      if (!html) return;
      const score = parseAthleteOneBoxScore(html);
      if (!score) return;
      match.homeScore = score.homeScore;
      match.awayScore = score.awayScore;
    }),
  );
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

  const scheduleUrls = [
    ...athleteOneUrls("get-team-schedule", [teamId, eventId, 12, row.tier === "ecnl-rl" ? 83 : 81]),
    ...athleteOneUrls("get-club-schedules-by-eventID-and-clubID", [eventId, clubId]),
  ];
  const cacheKey = `${eventId}|${clubId}`;
  let html = clubScheduleCache.get(cacheKey) ?? null;
  if (!html) {
    html = await fetchHtml(scheduleUrls, tried);
    if (html && html.includes("data-team-id")) {
      clubScheduleCache.set(cacheKey, html);
    }
  } else {
    tried.push(`memory:${cacheKey}`);
  }
  if (!html) {
    return {
      matches: [],
      focusId: teamId,
      source: "none",
      competition,
      endpointsTried: tried,
      error:
        "AthleteOne get-team-schedule is 401. Club schedule was empty or blocked. No invented scores.",
    };
  }
  const matches = parseAthleteOneClubSchedule(html, {
    teamId,
    ageBand: row.ageBand,
    event: competition,
  });
  if (!matches.length) {
    return {
      matches: [],
      focusId: teamId,
      source: "live",
      competition,
      endpointsTried: tried,
      error:
        "AthleteOne club schedule had no conference games for this age. Nothing was invented.",
    };
  }
  await hydrateBoxScores(eventId, matches, teamId, tried);
  const scored = matches.filter(
    (m) => m.homeScore != null && m.awayScore != null,
  ).length;
  return {
    matches,
    focusId: teamId,
    source: "live",
    competition,
    endpointsTried: tried,
    error:
      scored === 0
        ? "Opponents are from the AthleteOne club schedule. Box scores did not publish FT numbers — scores stay N/A."
        : undefined,
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
  const matches = mlsNextMatchesFor(
    overlay.orgId,
    overlay.ageBand,
    overlay.division,
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
