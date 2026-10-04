/**
 * Browser live refresh for the CA table currently on screen.
 *
 * Scope is one pathway + tier + conference + age (for example ECNL Northern
 * Cal BU13, or MLS NEXT Homegrown Northwest U13). Other conferences and ages
 * stay on the shipped rows.
 *
 * MLS NEXT: that division's League Viewer standings + schedule JSON. W–D–L /
 * GF–GA are completed schedule games for teams on this table only.
 * ECNL: one AthleteOne get-conference-standings call for this conference and
 * age, then get-individual-team-info for teams on that table.
 *
 * GitHub Pages cannot call those hosts directly (no CORS; AthleteOne wants
 * Referer https://theecnl.com). See public-fetch.ts. Never invents scores.
 */
import {
  applyStandingsOverlay,
  caTableFingerprint,
  ECNL_CA_CONFERENCES,
  type CaTablePathway,
  type CaTableTier,
  type EcnlHydrateRow,
  type MlsHydrateRow,
} from "./league-tables";
import { refreshEcnlSchedules } from "./league-matches";
import { applyLiveMlsMatches, type MlsNextOverlayMatch } from "./matches";
import {
  athleteOneAttempts,
  fetchFirstText,
  fetchMlsDocument,
} from "./public-fetch";
import type { AgeBand } from "./types";

export const ATHLETEONE_HOST =
  "https://api.athleteone.com/api/Script/get-conference-standings";
export const ATHLETEONE_ORG_ID = 12;
export const ATHLETEONE_VIEWER =
  "https://theecnl.com/sports/2023/8/8/ECNLB_0808235537.aspx";

export const MLS_NEXT_FEEDS = [
  {
    division: "homegrown" as const,
    label: "MLS NEXT Homegrown",
    standingsUrl:
      "https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-league-26-27.json",
    scheduleUrl:
      "https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-league-26-27.json",
    file: "mls-next-league-26-27.json",
  },
  {
    division: "academy" as const,
    label: "MLS NEXT Academy",
    standingsUrl:
      "https://mls-assist.theintelligenceplatform.com/data/standings/mls-next-2-academy-division-26-27.json",
    scheduleUrl:
      "https://mls-assist.theintelligenceplatform.com/data/schedule/mls-next-2-academy-division-26-27.json",
    file: "mls-next-2-academy-division-26-27.json",
  },
];

const MLS_NEXT_BAND_BIRTH_YEAR: Record<string, number> = {
  U12: 2015,
  U13: 2014,
  U14: 2013,
  U15: 2012,
  U16: 2011,
};

const AGE_RE = /\b(U1[2-6])\b/i;

const ECNL_DIVISIONS: Array<[AgeBand, number]> = [
  ["U13", 22184],
  ["U14", 22185],
  ["U15", 22186],
  ["U16", 22187],
];
const ECNL_RL_DIVISIONS: Array<[AgeBand, number]> = [
  ["U13", 22467],
  ["U14", 22468],
  ["U15", 22469],
  ["U16", 22470],
];

export const ECNL_CA_EVENTS = [
  { eventId: 4283, conference: "Northern Cal", tier: "ecnl" as const, seasonId: 81 },
  { eventId: 4273, conference: "Far West", tier: "ecnl" as const, seasonId: 81 },
  { eventId: 4287, conference: "Southwest", tier: "ecnl" as const, seasonId: 81 },
];
export const ECNL_RL_CA_EVENTS = [
  { eventId: 4351, conference: "NorCal", tier: "ecnl-rl" as const, seasonId: 83 },
  { eventId: 4348, conference: "Golden State", tier: "ecnl-rl" as const, seasonId: 83 },
  { eventId: 4354, conference: "Southern Cal", tier: "ecnl-rl" as const, seasonId: 83 },
  { eventId: 4427, conference: "Far West", tier: "ecnl-rl" as const, seasonId: 83 },
  { eventId: 4358, conference: "Southwest", tier: "ecnl-rl" as const, seasonId: 83 },
];

const OPTION_RE = /<option value="(\d+)"[^>]*>([^<]+)<\/option>/gi;
const DIV_SELECT_RE = /<select id="division-select"[^>]*>([\s\S]*?)<\/select>/i;
const H3_RE = /<h3[^>]*>([^<]+)<\/h3>/i;
const TR_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const TAG_RE = /<[^>]+>/g;
const INT_RE = /^-?\d+$/;
const TEAM_ID_RE = /data-team-id="(\d+)"/;
const CLUB_ID_RE = /data-club-id="(\d+)"/;
const EVENT_ID_RE = /data-event-id="(\d+)"/;
const NAME_RE = /data-team-id="\d+"[^>]*>\s*([^<]+?)\s*</i;

const AGE_FROM_LABEL: Record<string, AgeBand | "U17" | "U18/19"> = {
  BU12: "U12",
  BU13: "U13",
  BU14: "U14",
  BU15: "U15",
  BU16: "U16",
  BU17: "U17",
  "BU18/19": "U18/19",
  BU1819: "U18/19",
};

/**
 * Pre-ECNL boys 2026-27. The standings page
 * https://theecnl.com/sports/2023/8/8/Pre-ECNLB_0808231942.aspx
 * sets data-org-id="22" and data-org-season-id="87" (not ECNL org 12 / season 81).
 * Event ids come from that page's AthleteOne event-select. Division ids differ
 * per event and are read from #division-select. Southern Cal publishes several
 * flights in one response; Northern Cal's BU12 table is published and currently empty.
 */
export const PRE_ECNL_ORG_ID = 22;
export const PRE_ECNL_SEASON_ID = 87;
export const PRE_ECNL_CA_EVENTS = [
  {
    eventId: 4368,
    conference: "Northern Cal",
    tier: "pre-ecnl" as const,
    seasonId: PRE_ECNL_SEASON_ID,
    orgId: PRE_ECNL_ORG_ID,
  },
  {
    eventId: 4370,
    conference: "Southern Cal",
    tier: "pre-ecnl" as const,
    seasonId: PRE_ECNL_SEASON_ID,
    orgId: PRE_ECNL_ORG_ID,
  },
];

export const PRE_MLS_EMPTY_NOTE =
  "Pre-MLS NEXT has no public standings feed. mlssoccer.com only embeds the League Viewer for Homegrown (mls-next-league-26-27) and Academy (mls-next-2-academy-division-26-27), and those seasons start at U13. Nothing was invented.";

export type LiveRefreshPrioritize = {
  pathway: CaTablePathway;
  conference: string;
  ageBand: AgeBand;
  tier: CaTableTier;
};

export type LiveRefreshResult = {
  asOf: string;
  scopeLabel: string;
  ok: boolean;
  unchanged: boolean;
  mlsTeams: number;
  mlsMatches: number;
  ecnlTeams: number;
  ecnlScheduleTeams: number;
  ecnlScheduleMatches: number;
  mlsSource: "live" | "cache" | "partial";
  ecnlSource: "live" | "cache" | "partial";
  endpointsTried: string[];
  errors: string[];
  note: string;
};

export function tableScopeLabel(scope: LiveRefreshPrioritize): string {
  if (scope.tier === "pre-mls") return "Pre-MLS NEXT · U12";
  if (scope.tier === "pre-ecnl") {
    return `Pre-ECNL · ${scope.conference} · U12`;
  }
  if (scope.pathway === "mls-next") {
    const tier = scope.tier === "academy" ? "Academy" : "Homegrown";
    return `MLS NEXT ${tier} · ${scope.conference} · ${scope.ageBand}`;
  }
  const tier = scope.tier === "ecnl-rl" ? "ECNL-RL" : "ECNL";
  const age = scope.ageBand.replace(/^U/i, "BU");
  return `${tier} · ${scope.conference} · ${age}`;
}

export function compiledStamp(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const grab = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? "";
    return `${grab("year")}-${grab("month")}-${grab("day")}T${grab("hour")}:${grab("minute")}-07:00`;
  } catch {
    return new Date().toISOString().slice(0, 16);
  }
}

const divisionIdCache = new Map<number, Partial<Record<AgeBand, number>>>();

export function parseAge(value: unknown): AgeBand | null {
  let raw: unknown = value;
  if (raw && typeof raw === "object") {
    const obj = raw as { name?: unknown; code?: unknown };
    raw = obj.name ?? obj.code ?? "";
  }
  const m = String(raw ?? "").match(AGE_RE);
  if (!m) return null;
  const band = m[1].toUpperCase() as AgeBand;
  return (["U12", "U13", "U14", "U15", "U16"] as const).includes(band)
    ? band
    : null;
}

export function parseHeadingAge(html: string): string | null {
  const m = H3_RE.exec(html);
  if (!m) return null;
  const label = m[1].toUpperCase().replace(/\s+/g, "");
  if (label.includes("BU18")) return "U18/19";
  for (const [key, band] of Object.entries(AGE_FROM_LABEL)) {
    if (label.includes(key)) return band;
  }
  return null;
}

export function parseDivisionMap(html: string): Partial<Record<AgeBand, number>> {
  const block = DIV_SELECT_RE.exec(html);
  if (!block) return {};
  const out: Partial<Record<AgeBand, number>> = {};
  const optionRe = new RegExp(OPTION_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = optionRe.exec(block[1]))) {
    if (!/^\d+$/.test(match[1])) continue;
    const key = match[2].toUpperCase().replace(/\s+/g, "");
    const band = AGE_FROM_LABEL[key];
    if (
      band === "U12" ||
      band === "U13" ||
      band === "U14" ||
      band === "U15" ||
      band === "U16"
    ) {
      out[band] = Number(match[1]);
    }
  }
  return out;
}

function cells(trHtml: string): string[] {
  return trHtml
    .replace(TAG_RE, "\n")
    .split("\n")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function parseAthleteOneStandings(
  html: string,
  opts: {
    ageBand: string;
    conference: string;
    tier: "ecnl" | "ecnl-rl" | "pre-ecnl";
    asOf: string;
    orgId?: number;
  },
): EcnlHydrateRow[] {
  const rows: EcnlHydrateRow[] = [];
  const trRe = new RegExp(TR_RE.source, "gi");
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(html))) {
    const chunk = tr[1];
    if (!chunk.includes("data-team-id")) continue;
    const texts = cells(chunk);
    const nameMatch = NAME_RE.exec(chunk);
    let name = (nameMatch?.[1] ?? "").trim();
    if (!name) {
      for (const c of texts) {
        if (INT_RE.test(c) || /^-?\d+\.\d+$/.test(c) || c.length <= 3) continue;
        if (["qualification:", "n/a", "pos", "teams"].includes(c.toLowerCase())) {
          continue;
        }
        name = c;
        break;
      }
    }
    if (!name) continue;
    const ints = texts.filter((c) => INT_RE.test(c)).map((c) => Number(c));
    if (ints.length < 7) continue;
    const [pos, gp, wins, losses, draws, gf, ga] = ints;
    const teamId = TEAM_ID_RE.exec(chunk);
    const clubId = CLUB_ID_RE.exec(chunk);
    const eventId = EVENT_ID_RE.exec(chunk);
    const leagueNote =
      opts.tier === "pre-ecnl"
        ? "Pre-ECNL"
        : opts.tier === "ecnl-rl"
          ? "ECNL Regional League"
          : "ECNL";
    const record =
      gp > 0
        ? {
            w: wins,
            d: draws,
            l: losses,
            asOf: opts.asOf,
            note: `${leagueNote} ${opts.conference} 26/27 conference table (completed games only)`,
          }
        : null;
    rows.push({
      name,
      ageBand: opts.ageBand,
      tier: opts.tier,
      conference: opts.conference,
      conferenceRank: pos,
      conferenceSize: 0,
      played: gp,
      gf,
      ga,
      record,
      athleteOneTeamId: teamId ? Number(teamId[1]) : undefined,
      eventId: eventId ? Number(eventId[1]) : undefined,
      ...(clubId ? { athleteOneClubId: Number(clubId[1]) } : {}),
      ...(opts.orgId != null ? { athleteOneOrgId: opts.orgId } : {}),
    } as EcnlHydrateRow);
  }
  for (const row of rows) row.conferenceSize = rows.length;
  return rows;
}

type MlsTeamLive = MlsHydrateRow & {
  orgId: number;
  name: string;
  ageBand: string;
  division: "homegrown" | "academy";
  divisionLabel: string;
  birthYear?: number;
};

type TiebreakerEntry = { value?: string; description?: string };

/** "17 goals / 4 matches" → 17. Per-match floats are not used. */
function describedCount(entry: TiebreakerEntry | undefined): number | null {
  const description = entry?.description ?? "";
  const match = description.match(
    /^(-?\d+)\s+(goals|gd|wins|losses|ties|matches|points)\b/i,
  );
  if (match) return Number(match[1]);
  if (entry?.value != null && /^-?\d+$/.test(entry.value)) return Number(entry.value);
  return null;
}

function recordsFromTiebreakers(
  raw: unknown,
  asOf: string,
  label: string,
): {
  played: number;
  gf: number;
  ga: number;
  w: number;
  d: number;
  l: number;
  asOf: string;
  note: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const tb = raw as Record<string, TiebreakerEntry>;
  const played = describedCount(tb.matches_played);
  const w = describedCount(tb.won_penalty_shootout);
  const l = describedCount(tb.loss_penalty_shootout);
  const d = describedCount(tb.tie_penalty_shootout);
  const gf = describedCount(tb.goals_for_per_match);
  const ga = describedCount(tb.goals_against_per_match);
  if (
    played == null ||
    w == null ||
    l == null ||
    d == null ||
    gf == null ||
    ga == null ||
    played <= 0
  ) {
    return null;
  }
  return {
    played,
    gf,
    ga,
    w,
    d,
    l,
    asOf,
    note: `${label} 26/27 standings (completed games only)`,
  };
}

export function parseMlsStandingsFeed(
  data: Record<string, unknown>,
  division: "homegrown" | "academy",
  label: string,
  asOf = "",
): Map<string, MlsTeamLive> {
  const teams = new Map<string, MlsTeamLive>();
  const season = data.competition_season as
    | { competition_brackets?: Array<Record<string, unknown>> }
    | undefined;
  for (const br of season?.competition_brackets ?? []) {
    const age = parseAge(br.age_group);
    if (!age || age === "U12") continue;
    if (br.gender && br.gender !== "male") continue;
    const conference = String(br.name ?? "");
    const rows = (br.standings as Array<Record<string, unknown>>) ?? [];
    for (const row of rows) {
      const org = (row.team as { organisation_id?: number; name?: string }) || {};
      if (org.organisation_id == null) continue;
      const key = `${org.organisation_id}|${age}|${division}`;
      const fromTable = recordsFromTiebreakers(row.tiebreaker_values, asOf, label);
      teams.set(key, {
        orgId: Number(org.organisation_id),
        name: org.name || "Unknown",
        ageBand: age,
        birthYear: MLS_NEXT_BAND_BIRTH_YEAR[age],
        division,
        divisionLabel: label,
        conference,
        conferenceRank: typeof row.position === "number" ? row.position : null,
        conferenceSize: rows.length,
        record: fromTable
          ? {
              w: fromTable.w,
              d: fromTable.d,
              l: fromTable.l,
              asOf: fromTable.asOf,
              note: fromTable.note,
            }
          : null,
        played: fromTable?.played ?? 0,
        gf: fromTable?.gf ?? 0,
        ga: fromTable?.ga ?? 0,
      });
    }
  }
  return teams;
}

export function applyMlsScheduleRecords(
  teams: Map<string, MlsTeamLive>,
  events: Array<Record<string, unknown>>,
  division: "homegrown" | "academy",
  label: string,
  asOf: string,
  opts?: { onlyOrgIds?: Set<number> },
): MlsNextOverlayMatch[] {
  const records = new Map<
    string,
    { w: number; d: number; l: number; gf: number; ga: number; played: number }
  >();
  const matches: MlsNextOverlayMatch[] = [];
  for (const ev of events) {
    const age =
      parseAge(ev.home_squad_name) ?? parseAge(ev.away_squad_name);
    if (!age || age === "U12") continue;
    const ho = (ev.home_organisation as { id?: number; name?: string }) || {};
    const ao = (ev.away_organisation as { id?: number; name?: string }) || {};
    const hs = ev.home_score;
    const aws = ev.away_score;
    const homeScore = typeof hs === "number" ? hs : null;
    const awayScore = typeof aws === "number" ? aws : null;
    const scored = Boolean(ev.completed) && homeScore != null && awayScore != null;
    if (opts?.onlyOrgIds) {
      const homeIn = ho.id != null && opts.onlyOrgIds.has(Number(ho.id));
      const awayIn = ao.id != null && opts.onlyOrgIds.has(Number(ao.id));
      if (!homeIn && !awayIn) continue;
      const homeKey = `${ho.id}|${age}|${division}`;
      const awayKey = `${ao.id}|${age}|${division}`;
      if (!teams.has(homeKey) && !teams.has(awayKey)) continue;
    }
    matches.push({
      id: Number(ev.id) || 0,
      date: typeof ev.start_time === "string" ? ev.start_time.slice(0, 10) : null,
      ageBand: age,
      division,
      homeOrgId: ho.id ?? null,
      homeName: ho.name ?? "Unknown",
      awayOrgId: ao.id ?? null,
      awayName: ao.name ?? "Unknown",
      homeScore: scored ? homeScore : null,
      awayScore: scored ? awayScore : null,
      event: `${label} 26/27`,
      kind: "league",
    });
    if (!scored || homeScore == null || awayScore == null) continue;
    for (const [oid, gf, ga] of [
      [ho.id, homeScore, awayScore],
      [ao.id, awayScore, homeScore],
    ] as const) {
      if (oid == null) continue;
      const key = `${oid}|${age}|${division}`;
      const rec = records.get(key) ?? { w: 0, d: 0, l: 0, gf: 0, ga: 0, played: 0 };
      rec.played += 1;
      rec.gf += gf;
      rec.ga += ga;
      if (gf > ga) rec.w += 1;
      else if (gf < ga) rec.l += 1;
      else rec.d += 1;
      records.set(key, rec);
    }
  }
  for (const [key, rec] of records) {
    let row = teams.get(key);
    if (!row) {
      if (opts?.onlyOrgIds) continue;
      const [oid, age] = key.split("|");
      row = {
        orgId: Number(oid),
        name: "Unknown",
        ageBand: age,
        birthYear: MLS_NEXT_BAND_BIRTH_YEAR[age],
        division,
        divisionLabel: label,
        conference: null,
        conferenceRank: null,
        conferenceSize: null,
        record: null,
        played: 0,
        gf: 0,
        ga: 0,
      };
      teams.set(key, row);
    }
    row.played = rec.played;
    row.gf = rec.gf;
    row.ga = rec.ga;
    if (rec.played) {
      row.record = {
        w: rec.w,
        d: rec.d,
        l: rec.l,
        asOf,
        note: `${label} 26/27 public schedule (completed games only)`,
      };
    }
  }
  return matches;
}


type EcnlFeed =
  | ((typeof ECNL_CA_EVENTS)[number] & { orgId?: number })
  | ((typeof ECNL_RL_CA_EVENTS)[number] & { orgId?: number })
  | (typeof PRE_ECNL_CA_EVENTS)[number];

function ecnlDivisions(tier: string): Array<[AgeBand, number]> {
  return tier === "ecnl-rl" ? ECNL_RL_DIVISIONS : ECNL_DIVISIONS;
}

function ecnlFeedFor(scope: LiveRefreshPrioritize): EcnlFeed | null {
  if (scope.tier === "pre-ecnl") {
    const base = scope.conference.split(" · ")[0];
    return PRE_ECNL_CA_EVENTS.find((feed) => feed.conference === base) ?? null;
  }
  const pool = scope.tier === "ecnl-rl" ? ECNL_RL_CA_EVENTS : ECNL_CA_EVENTS;
  return pool.find((feed) => feed.conference === scope.conference) ?? null;
}

function feedOrgId(feed: EcnlFeed): number {
  return "orgId" in feed && feed.orgId != null ? feed.orgId : ATHLETEONE_ORG_ID;
}

async function fetchAthleteOneTable(
  eventId: number,
  seasonId: number,
  divisionId: number,
  tried: string[],
  orgId = ATHLETEONE_ORG_ID,
): Promise<string | null> {
  const path = `/api/Script/get-conference-standings/${eventId}/${orgId}/${seasonId}/${divisionId}/0`;
  return fetchFirstText(athleteOneAttempts(path, "standings"), tried);
}

async function fetchEcnlAgeHtml(
  feed: EcnlFeed,
  age: AgeBand,
  tried: string[],
  errors: string[],
): Promise<string | null> {
  const orgId = feedOrgId(feed);
  const divisions =
    feed.tier === "pre-ecnl" ? ([["U12", 0]] as Array<[AgeBand, number]>) : ecnlDivisions(feed.tier);
  const cachedId = divisionIdCache.get(feed.eventId)?.[age];
  if (cachedId) {
    const cachedHtml = await fetchAthleteOneTable(
      feed.eventId,
      feed.seasonId,
      cachedId,
      tried,
      orgId,
    );
    if (cachedHtml && parseHeadingAge(cachedHtml) === age) return cachedHtml;
  }
  const [bootstrapAge, bootstrapId] = divisions[0];
  const html0 = await fetchAthleteOneTable(
    feed.eventId,
    feed.seasonId,
    bootstrapId,
    tried,
    orgId,
  );
  if (!html0) {
    errors.push(
      `AthleteOne ${feed.conference} standings were blocked. A Referer of https://theecnl.com is required, and GitHub Pages cannot set that header itself.`,
    );
    return null;
  }
  const divMap = parseDivisionMap(html0);
  if (Object.keys(divMap).length) divisionIdCache.set(feed.eventId, divMap);
  if (age === bootstrapAge && parseHeadingAge(html0) === age) return html0;
  const divId = divMap[age];
  if (!divId) {
    errors.push(
      `AthleteOne ${feed.conference} has no ${age} division in the conference select. Nothing was invented.`,
    );
    return null;
  }
  const html = await fetchAthleteOneTable(
    feed.eventId,
    feed.seasonId,
    divId,
    tried,
    orgId,
  );
  if (!html) {
    errors.push(
      `AthleteOne ${feed.conference} ${age} standings were blocked or empty.`,
    );
    return null;
  }
  const heading = parseHeadingAge(html);
  if (heading !== age) {
    errors.push(
      `AthleteOne ${feed.conference} returned ${heading ?? "an unexpected age"} instead of ${age}. This table was not replaced.`,
    );
    return null;
  }
  return html;
}

async function ingestEcnlTable(
  scope: LiveRefreshPrioritize,
  asOf: string,
  tried: string[],
  errors: string[],
): Promise<EcnlHydrateRow[]> {
  const feed = ecnlFeedFor(scope);
  if (!feed) {
    errors.push(`No ECNL conference feed for ${scope.conference}.`);
    return [];
  }
  const html = await fetchEcnlAgeHtml(feed, scope.ageBand, tried, errors);
  if (!html) return [];
  const tier =
    feed.tier === "ecnl-rl" ? "ecnl-rl" : feed.tier === "pre-ecnl" ? "pre-ecnl" : "ecnl";
  const orgId = feedOrgId(feed);
  if (feed.tier === "pre-ecnl") {
    return preEcnlRowsForConference(html, {
      ageBand: scope.ageBand,
      conference: scope.conference,
      baseConference: feed.conference,
      tier: "pre-ecnl",
      asOf,
      orgId,
    });
  }
  return parseAthleteOneStandings(html, {
    ageBand: scope.ageBand,
    conference: feed.conference,
    tier,
    asOf,
    orgId,
  });
}

const FLIGHT_SPAN_RE =
  /<span style="font-size:\s*48px;[^"]*">([^<]*)<\/span>/gi;

function preEcnlRowsForConference(
  html: string,
  opts: {
    ageBand: string;
    conference: string;
    baseConference: string;
    tier: "pre-ecnl";
    asOf: string;
    orgId: number;
  },
): EcnlHydrateRow[] {
  const spans = [...html.matchAll(FLIGHT_SPAN_RE)];
  const labeled = spans.filter((span) => span[1].trim().length > 0);
  if (!labeled.length) {
    return parseAthleteOneStandings(html, {
      ageBand: opts.ageBand,
      conference: opts.baseConference,
      tier: opts.tier,
      asOf: opts.asOf,
      orgId: opts.orgId,
    }).filter((row) => row.conference === opts.conference);
  }
  const rows: EcnlHydrateRow[] = [];
  for (let i = 0; i < labeled.length; i += 1) {
    const label = labeled[i][1].trim();
    const conference = `${opts.baseConference} · ${label}`;
    if (conference !== opts.conference) continue;
    const start = labeled[i].index ?? 0;
    const end = labeled[i + 1]?.index ?? html.length;
    rows.push(
      ...parseAthleteOneStandings(html.slice(start, end), {
        ageBand: opts.ageBand,
        conference,
        tier: opts.tier,
        asOf: opts.asOf,
        orgId: opts.orgId,
      }),
    );
  }
  return rows;
}

async function ingestMlsTable(
  scope: LiveRefreshPrioritize,
  asOf: string,
  tried: string[],
  errors: string[],
): Promise<{ teams: MlsTeamLive[]; matches: MlsNextOverlayMatch[] } | null> {
  const division = scope.tier === "academy" ? "academy" : "homegrown";
  const feed = MLS_NEXT_FEEDS.find((item) => item.division === division);
  if (!feed) {
    errors.push(`No MLS NEXT feed for ${scope.tier}.`);
    return null;
  }
  const [standingsText, scheduleText] = await Promise.all([
    fetchMlsDocument(feed.standingsUrl, feed.file, "standings", tried),
    fetchMlsDocument(feed.scheduleUrl, feed.file, "schedule", tried),
  ]);
  if (!standingsText) {
    errors.push(`MLS NEXT ${feed.label} standings JSON was blocked or empty.`);
    return null;
  }
  if (!scheduleText) {
    const parsedOnly = (() => {
      try {
        return JSON.parse(standingsText) as Record<string, unknown>;
      } catch {
        return null;
      }
    })();
    if (!parsedOnly) {
      errors.push(`MLS NEXT ${feed.label} returned data that was not JSON.`);
      return null;
    }
    const partial = parseMlsStandingsFeed(parsedOnly, feed.division, feed.label, asOf);
    const teams = [...partial.values()].filter(
      (row) => row.ageBand === scope.ageBand && row.conference === scope.conference,
    );
    const withRecords = teams.filter((row) => (row.played ?? 0) > 0);
    if (!teams.length) {
      errors.push(
        `MLS NEXT has no ${scope.conference} ${scope.ageBand} rows in the ${feed.label} standings. Nothing was invented.`,
      );
      return null;
    }
    if (!withRecords.length) {
      errors.push(
        `MLS NEXT ${feed.label} schedule JSON was blocked or empty, and this age has no published W–D–L on the standings feed. This table was not changed.`,
      );
      return null;
    }
    errors.push(
      `Schedule JSON was blocked. W–D–L below are from the standings feed only, for sides that have published them.`,
    );
    return { teams, matches: [] };
  }
  let standings: Record<string, unknown>;
  let schedule: Record<string, unknown>;
  try {
    standings = JSON.parse(standingsText) as Record<string, unknown>;
    schedule = JSON.parse(scheduleText) as Record<string, unknown>;
  } catch {
    errors.push(`MLS NEXT ${feed.label} returned data that was not JSON.`);
    return null;
  }
  const parsed = parseMlsStandingsFeed(standings, feed.division, feed.label, asOf);
  const teams = new Map<string, MlsTeamLive>();
  for (const [key, row] of parsed) {
    if (row.ageBand === scope.ageBand && row.conference === scope.conference) {
      teams.set(key, row);
    }
  }
  if (!teams.size) {
    errors.push(
      `MLS NEXT has no ${scope.conference} ${scope.ageBand} rows in the ${feed.label} standings. Nothing was invented.`,
    );
    return null;
  }
  if (!Array.isArray(schedule.events)) {
    errors.push(
      `MLS NEXT ${feed.label} schedule had no events array. W–D–L were not changed.`,
    );
    return null;
  }
  const orgIds = new Set<number>([...teams.values()].map((row) => row.orgId));
  const matches = applyMlsScheduleRecords(
    teams,
    schedule.events as Array<Record<string, unknown>>,
    feed.division,
    feed.label,
    asOf,
    { onlyOrgIds: orgIds },
  );
  return { teams: [...teams.values()], matches };
}

function emptyResult(
  scopeLabel: string,
  asOf: string,
  tried: string[],
  errors: string[],
  note: string,
): LiveRefreshResult {
  return {
    asOf,
    scopeLabel,
    ok: false,
    unchanged: false,
    mlsTeams: 0,
    mlsMatches: 0,
    ecnlTeams: 0,
    ecnlScheduleTeams: 0,
    ecnlScheduleMatches: 0,
    mlsSource: "cache",
    ecnlSource: "cache",
    endpointsTried: tried,
    errors,
    note,
  };
}

function resultNote(opts: {
  scopeLabel: string;
  asOf: string;
  unchanged: boolean;
  teams: number;
  gamesNote?: string;
  errors: string[];
}): string {
  const head = opts.unchanged
    ? `Already current — ${opts.scopeLabel}. Data updated ${opts.asOf}.`
    : `Updated ${opts.scopeLabel}. Data updated ${opts.asOf}.`;
  const bits = [head, `${opts.teams} sides.`];
  if (opts.gamesNote) bits.push(opts.gamesNote);
  if (opts.errors.length) bits.push(opts.errors[0]);
  bits.push("Nothing invented.");
  return bits.join(" ");
}

export async function refreshLiveStandings(opts?: {
  prioritize?: LiveRefreshPrioritize;
  onPartial?: () => void;
}): Promise<LiveRefreshResult> {
  const asOf = compiledStamp();
  const tried: string[] = [];
  const errors: string[] = [];
  const scope = opts?.prioritize;
  const scopeLabel = scope ? tableScopeLabel(scope) : "this table";
  if (!scope) {
    return emptyResult(
      scopeLabel,
      asOf,
      tried,
      errors,
      "Refresh applies to the table you are viewing. Open a CA table first. Nothing was invented.",
    );
  }
  if (scope.tier === "pre-mls" || (scope.pathway === "mls-next" && scope.ageBand === "U12")) {
    return {
      ...emptyResult(scopeLabel, asOf, tried, errors, PRE_MLS_EMPTY_NOTE),
      ok: true,
      unchanged: true,
    };
  }
  if (scope.ageBand === "U12" && scope.tier !== "pre-ecnl") {
    return emptyResult(
      scopeLabel,
      asOf,
      tried,
      errors,
      `${scopeLabel} is not a published California table. Nothing was invented.`,
    );
  }
  if (!scope.conference) {
    return emptyResult(
      scopeLabel,
      asOf,
      tried,
      errors,
      `${scopeLabel} is not a published California table. Tables start at U13 / BU13. Nothing was invented.`,
    );
  }

  const fingerprintOpts = {
    pathway: scope.pathway,
    tier: scope.tier,
    conference: scope.conference,
    ageBand: scope.ageBand,
  };
  const before = caTableFingerprint(fingerprintOpts);

  if (scope.pathway === "ecnl") {
    const rows = await ingestEcnlTable(scope, asOf, tried, errors);
    const tier =
      scope.tier === "ecnl-rl" ? "ecnl-rl" : scope.tier === "pre-ecnl" ? "pre-ecnl" : "ecnl";
    if (!rows.length) {
      if (scope.tier === "pre-ecnl" && errors.length === 0) {
        applyStandingsOverlay({
          ecnl: {
            asOf,
            source: `Pre-ECNL AthleteOne get-conference-standings (live, ${scopeLabel})`,
            teams: [],
            replaceScope: {
              conference: scope.conference,
              ageBand: scope.ageBand,
              tier,
            },
          },
        });
        opts?.onPartial?.();
        return {
          asOf,
          scopeLabel,
          ok: true,
          unchanged: before === caTableFingerprint(fingerprintOpts),
          mlsTeams: 0,
          mlsMatches: 0,
          ecnlTeams: 0,
          ecnlScheduleTeams: 0,
          ecnlScheduleMatches: 0,
          mlsSource: "cache",
          ecnlSource: "live",
          endpointsTried: tried,
          errors,
          note: `Updated ${scopeLabel}. Data updated ${asOf}. No published rows in this conference yet. Nothing invented.`,
        };
      }
      const why =
        errors[0] ??
        `Could not refresh ${scopeLabel}. Live AthleteOne standings were blocked or empty.`;
      return emptyResult(
        scopeLabel,
        asOf,
        tried,
        errors,
        `${why} This table was not changed. Nothing was invented.`,
      );
    }
    applyStandingsOverlay({
      ecnl: {
        asOf,
        source: `${tier === "pre-ecnl" ? "Pre-ECNL" : "ECNL"} AthleteOne get-conference-standings (live, ${scopeLabel})`,
        teams: rows,
        replaceScope: {
          conference: scope.conference,
          ageBand: scope.ageBand,
          tier,
        },
      },
    });
    opts?.onPartial?.();
    const schedulable = rows.filter(
      (row) =>
        row.athleteOneTeamId != null &&
        row.athleteOneClubId != null &&
        row.eventId != null,
    );
    const schedules = schedulable.length
      ? await refreshEcnlSchedules(schedulable, tried, errors)
      : { teams: 0, matches: 0, scored: 0 };
    if (schedules.teams) opts?.onPartial?.();
    const unchanged = before === caTableFingerprint(fingerprintOpts);
    const gamesNote = schedulable.length
      ? schedules.teams
        ? `Game lists updated for ${schedules.teams}/${schedulable.length} sides (${schedules.matches} games, ${schedules.scored} with a published score).`
        : "Standings updated. Game lists for this table were blocked or empty."
      : "This table has no AthleteOne team ids, so game lists were not queried.";
    return {
      asOf,
      scopeLabel,
      ok: true,
      unchanged,
      mlsTeams: 0,
      mlsMatches: 0,
      ecnlTeams: rows.length,
      ecnlScheduleTeams: schedules.teams,
      ecnlScheduleMatches: schedules.matches,
      mlsSource: "cache",
      ecnlSource: schedules.teams === schedulable.length ? "live" : "partial",
      endpointsTried: tried,
      errors,
      note: resultNote({
        scopeLabel,
        asOf,
        unchanged,
        teams: rows.length,
        gamesNote,
        errors,
      }),
    };
  }

  const mls = await ingestMlsTable(scope, asOf, tried, errors);
  if (!mls) {
    const why =
      errors[0] ??
      `Could not refresh ${scopeLabel}. Live League Viewer data was blocked or empty.`;
    return emptyResult(
      scopeLabel,
      asOf,
      tried,
      errors,
      `${why} This table was not changed. Nothing was invented.`,
    );
  }
  const division = scope.tier === "academy" ? "academy" : "homegrown";
  applyStandingsOverlay({
    mls: {
      asOf,
      source: `MLS NEXT public League Viewer (live, ${scopeLabel})`,
      teams: mls.teams,
      replaceScope: {
        conference: scope.conference,
        ageBand: scope.ageBand,
        tier: division,
      },
    },
  });
  if (mls.matches.length) applyLiveMlsMatches(mls.matches);
  opts?.onPartial?.();
  const unchanged = before === caTableFingerprint(fingerprintOpts);
  return {
    asOf,
    scopeLabel,
    ok: true,
    unchanged,
    mlsTeams: mls.teams.length,
    mlsMatches: mls.matches.length,
    ecnlTeams: 0,
    ecnlScheduleTeams: 0,
    ecnlScheduleMatches: 0,
    mlsSource: "live",
    ecnlSource: "cache",
    endpointsTried: tried,
    errors,
    note: resultNote({
      scopeLabel,
      asOf,
      unchanged,
      teams: mls.teams.length,
      gamesNote: `${mls.matches.length} completed League Viewer games on this table.`,
      errors,
    }),
  };
}

export function caConferenceNames(pathway: CaTablePathway, tier: CaTableTier): readonly string[] {
  if (pathway === "mls-next") return [];
  return ECNL_CA_CONFERENCES[tier === "ecnl-rl" ? "ecnl-rl" : "ecnl"] ?? [];
}
