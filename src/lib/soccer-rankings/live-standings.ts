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
  mlsJsonAttempts,
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
  BU13: "U13",
  BU14: "U14",
  BU15: "U15",
  BU16: "U16",
  BU17: "U17",
  "BU18/19": "U18/19",
  BU1819: "U18/19",
};

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
    if (band === "U13" || band === "U14" || band === "U15" || band === "U16") {
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
  opts: { ageBand: string; conference: string; tier: "ecnl" | "ecnl-rl"; asOf: string },
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
    const record =
      gp > 0
        ? {
            w: wins,
            d: draws,
            l: losses,
            asOf: opts.asOf,
            note: `ECNL ${opts.tier === "ecnl-rl" ? "Regional League " : ""}${opts.conference} 26/27 conference table (completed games only)`,
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

export function parseMlsStandingsFeed(
  data: Record<string, unknown>,
  division: "homegrown" | "academy",
  label: string,
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
        record: null,
        played: 0,
        gf: 0,
        ga: 0,
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
    if (!ev.completed || typeof hs !== "number" || typeof aws !== "number") {
      continue;
    }
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
      homeScore: hs,
      awayScore: aws,
      event: `${label} 26/27`,
      kind: "league",
    });
    for (const [oid, gf, ga] of [
      [ho.id, hs, aws],
      [ao.id, aws, hs],
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


type EcnlFeed = (typeof ECNL_CA_EVENTS)[number] | (typeof ECNL_RL_CA_EVENTS)[number];

function ecnlDivisions(tier: string): Array<[AgeBand, number]> {
  return tier === "ecnl-rl" ? ECNL_RL_DIVISIONS : ECNL_DIVISIONS;
}

function ecnlFeedFor(scope: LiveRefreshPrioritize): EcnlFeed | null {
  const pool = scope.tier === "ecnl-rl" ? ECNL_RL_CA_EVENTS : ECNL_CA_EVENTS;
  return pool.find((feed) => feed.conference === scope.conference) ?? null;
}

async function fetchAthleteOneTable(
  eventId: number,
  seasonId: number,
  divisionId: number,
  tried: string[],
): Promise<string | null> {
  const path = `/api/Script/get-conference-standings/${eventId}/${ATHLETEONE_ORG_ID}/${seasonId}/${divisionId}/0`;
  return fetchFirstText(athleteOneAttempts(path, "standings"), tried);
}

async function fetchEcnlAgeHtml(
  feed: EcnlFeed,
  age: AgeBand,
  tried: string[],
  errors: string[],
): Promise<string | null> {
  const divisions = ecnlDivisions(feed.tier);
  const cachedId = divisionIdCache.get(feed.eventId)?.[age];
  if (cachedId) {
    const cachedHtml = await fetchAthleteOneTable(
      feed.eventId,
      feed.seasonId,
      cachedId,
      tried,
    );
    if (cachedHtml && parseHeadingAge(cachedHtml) === age) return cachedHtml;
  }
  const [bootstrapAge, bootstrapId] = divisions[0];
  const html0 = await fetchAthleteOneTable(
    feed.eventId,
    feed.seasonId,
    bootstrapId,
    tried,
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
  const html = await fetchAthleteOneTable(feed.eventId, feed.seasonId, divId, tried);
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
  const tier = feed.tier === "ecnl-rl" ? "ecnl-rl" : "ecnl";
  return parseAthleteOneStandings(html, {
    ageBand: scope.ageBand,
    conference: feed.conference,
    tier,
    asOf,
  });
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
    fetchFirstText(mlsJsonAttempts(feed.standingsUrl, feed.file, "standings"), tried),
    fetchFirstText(mlsJsonAttempts(feed.scheduleUrl, feed.file, "schedule"), tried),
  ]);
  if (!standingsText) {
    errors.push(`MLS NEXT ${feed.label} standings JSON was blocked or empty.`);
  }
  if (!scheduleText) {
    errors.push(
      `MLS NEXT ${feed.label} schedule JSON was blocked or empty. W–D–L were not changed.`,
    );
  }
  if (!standingsText || !scheduleText) return null;
  let standings: Record<string, unknown>;
  let schedule: Record<string, unknown>;
  try {
    standings = JSON.parse(standingsText) as Record<string, unknown>;
    schedule = JSON.parse(scheduleText) as Record<string, unknown>;
  } catch {
    errors.push(`MLS NEXT ${feed.label} returned data that was not JSON.`);
    return null;
  }
  const parsed = parseMlsStandingsFeed(standings, feed.division, feed.label);
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
  if (scope.ageBand === "U12" || !scope.conference) {
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
    if (!rows.length) {
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
    const tier = scope.tier === "ecnl-rl" ? "ecnl-rl" : "ecnl";
    applyStandingsOverlay({
      ecnl: {
        asOf,
        source: `ECNL AthleteOne get-conference-standings (live, ${scopeLabel})`,
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
