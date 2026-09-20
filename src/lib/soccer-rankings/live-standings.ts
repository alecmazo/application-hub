/**
 * Browser live refresh for official CA boys standings.
 *
 * MLS NEXT: public League Viewer JSON (same files as ingest-mls-next.py).
 * ECNL: AthleteOne HTML tables with Referer/Origin https://theecnl.com
 * (same recipe as ingest-ecnl-athleteone.py). Bare requests are 403.
 *
 * Never invents scores. Completed public rows only. AthleteOne HTML is
 * W–L–D; we store W–D–L. MLS NEXT W–D–L / GF–GA come from completed
 * schedule events, not invented 0–0s.
 */
import {
  applyStandingsOverlay,
  ECNL_CA_CONFERENCES,
  type CaTablePathway,
  type CaTableTier,
  type EcnlHydrateRow,
  type MlsHydrateRow,
} from "./league-tables";
import { applyLiveMlsMatches, type MlsNextOverlayMatch } from "./matches";
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

const APP_AGES: AgeBand[] = ["U13", "U14", "U15", "U16"];
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

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export type LiveRefreshPrioritize = {
  pathway: CaTablePathway;
  conference: string;
  ageBand: AgeBand;
  tier: CaTableTier;
};

export type LiveRefreshResult = {
  asOf: string;
  mlsTeams: number;
  mlsMatches: number;
  ecnlTeams: number;
  mlsSource: "live" | "cache" | "partial";
  ecnlSource: "live" | "cache" | "partial";
  endpointsTried: string[];
  errors: string[];
  note: string;
};

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

function corsProxied(url: string): string[] {
  return [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.org/?${encodeURIComponent(url)}`,
  ];
}

function mlsUrls(canonical: string, file: string): string[] {
  return [
    `/mls-next-api/data/${canonical.includes("/standings/") ? "standings" : "schedule"}/${file}`,
    canonical,
    ...corsProxied(canonical),
  ];
}

function athleteOneUrls(eventId: number, seasonId: number, divisionId: number): string[] {
  const path = `/api/Script/get-conference-standings/${eventId}/${ATHLETEONE_ORG_ID}/${seasonId}/${divisionId}/0`;
  const canonical = `${ATHLETEONE_HOST}/${eventId}/${ATHLETEONE_ORG_ID}/${seasonId}/${divisionId}/0`;
  return [`/athleteone-api${path}`, canonical, ...corsProxied(canonical)];
}

async function fetchText(
  urls: string[],
  tried: string[],
  kind: "json" | "html",
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: kind === "json" ? "application/json" : "text/html,application/json,*/*",
    "User-Agent": BROWSER_UA,
  };
  for (const url of urls) {
    tried.push(url);
    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok) continue;
      const text = await resp.text();
      if (!text || text.length < 20) continue;
      if (kind === "json") {
        const trimmed = text.trim();
        if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) continue;
      }
      if (kind === "html" && /"status"\s*:\s*99|"title"\s*:\s*"Forbidden"/.test(text)) {
        continue;
      }
      return text;
    } catch {
      /* next URL — CORS, proxy, or 403 without Referer */
    }
  }
  return null;
}

async function fetchJson(
  urls: string[],
  tried: string[],
): Promise<Record<string, unknown> | null> {
  const text = await fetchText(urls, tried, "json");
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(text);
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

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

function prioritizeEcnlFeeds(
  prioritize?: LiveRefreshPrioritize,
): typeof ECNL_CA_EVENTS | typeof ECNL_RL_CA_EVENTS | Array<(typeof ECNL_CA_EVENTS)[number] | (typeof ECNL_RL_CA_EVENTS)[number]> {
  const ecnl = [...ECNL_CA_EVENTS];
  const rl = [...ECNL_RL_CA_EVENTS];
  if (!prioritize || prioritize.pathway !== "ecnl") return [...ecnl, ...rl];
  const pool = prioritize.tier === "ecnl-rl" ? rl : ecnl;
  const rest = prioritize.tier === "ecnl-rl" ? ecnl : rl;
  pool.sort((a, b) => {
    if (a.conference === prioritize.conference) return -1;
    if (b.conference === prioritize.conference) return 1;
    return 0;
  });
  return [...pool, ...rest];
}

async function fetchAthleteOneTable(
  eventId: number,
  seasonId: number,
  divisionId: number,
  tried: string[],
): Promise<string | null> {
  return fetchText(athleteOneUrls(eventId, seasonId, divisionId), tried, "html");
}

async function ingestEcnlLive(
  asOf: string,
  tried: string[],
  errors: string[],
  prioritize?: LiveRefreshPrioritize,
  onPartial?: (rows: EcnlHydrateRow[]) => void,
): Promise<EcnlHydrateRow[]> {
  const items: EcnlHydrateRow[] = [];
  const feeds = prioritizeEcnlFeeds(prioritize);
  let firstApplied = false;
  for (const feed of feeds) {
    const divisions = feed.tier === "ecnl-rl" ? ECNL_RL_DIVISIONS : ECNL_DIVISIONS;
    const [bootstrapAge, bootstrapNational] = divisions[0];
    const html0 = await fetchAthleteOneTable(
      feed.eventId,
      feed.seasonId,
      bootstrapNational,
      tried,
    );
    if (!html0) {
      errors.push(
        `AthleteOne ${feed.conference} bootstrap failed (Referer theecnl.com required).`,
      );
      continue;
    }
    const divMap = parseDivisionMap(html0);
    const cached: Record<number, string> = { [bootstrapNational]: html0 };
    for (const [age, nationalId] of divisions) {
      const divId = divMap[age] ?? nationalId;
      if (age !== bootstrapAge && !Object.keys(divMap).length) continue;
      if (!cached[divId]) {
        const html = await fetchAthleteOneTable(
          feed.eventId,
          feed.seasonId,
          divId,
          tried,
        );
        if (!html) {
          errors.push(`AthleteOne ${feed.conference} ${age} failed.`);
          continue;
        }
        cached[divId] = html;
      }
      const html = cached[divId];
      const heading = parseHeadingAge(html);
      if (heading !== age) continue;
      const part = parseAthleteOneStandings(html, {
        ageBand: age,
        conference: feed.conference,
        tier: feed.tier,
        asOf,
      });
      items.push(...part);
      if (
        !firstApplied &&
        onPartial &&
        part.length &&
        (!prioritize ||
          (feed.conference === prioritize.conference &&
            (prioritize.ageBand === age || prioritize.ageBand === "U12")))
      ) {
        firstApplied = true;
        onPartial(items.slice());
      }
    }
  }
  return items;
}

async function ingestMlsLive(
  asOf: string,
  tried: string[],
  errors: string[],
): Promise<{ teams: MlsTeamLive[]; matches: MlsNextOverlayMatch[]; source: "live" | "partial" | "cache" }> {
  const teams = new Map<string, MlsTeamLive>();
  const matches: MlsNextOverlayMatch[] = [];
  let liveFeeds = 0;
  for (const feed of MLS_NEXT_FEEDS) {
    const standings = await fetchJson(
      mlsUrls(feed.standingsUrl, feed.file),
      tried,
    );
    if (!standings) {
      errors.push(`MLS NEXT ${feed.label} standings JSON unavailable.`);
      continue;
    }
    const parsed = parseMlsStandingsFeed(standings, feed.division, feed.label);
    for (const [key, row] of parsed) teams.set(key, row);
    liveFeeds += 1;
    const schedule = await fetchJson(
      mlsUrls(feed.scheduleUrl, feed.file),
      tried,
    );
    const events = Array.isArray(schedule?.events)
      ? (schedule.events as Array<Record<string, unknown>>)
      : [];
    if (!schedule) {
      errors.push(
        `MLS NEXT ${feed.label} schedule JSON unavailable — positions updated, W–D–L kept only where completed games were already known.`,
      );
      continue;
    }
    matches.push(
      ...applyMlsScheduleRecords(parsed, events, feed.division, feed.label, asOf),
    );
    for (const [key, row] of parsed) teams.set(key, row);
  }
  const source =
    liveFeeds === MLS_NEXT_FEEDS.length
      ? "live"
      : liveFeeds > 0
        ? "partial"
        : "cache";
  return { teams: [...teams.values()], matches, source };
}

function summarizeNote(result: Omit<LiveRefreshResult, "note">): string {
  const bits: string[] = [];
  if (result.mlsSource !== "cache") {
    bits.push(
      `MLS NEXT League Viewer ${result.mlsTeams} sides / ${result.mlsMatches} completed games (${result.mlsSource})`,
    );
  } else {
    bits.push("MLS NEXT stayed on the shipped League Viewer cache");
  }
  if (result.ecnlSource !== "cache") {
    bits.push(
      `AthleteOne CA tables ${result.ecnlTeams} sides (Referer theecnl.com, ${result.ecnlSource})`,
    );
  } else {
    bits.push("AthleteOne stayed on the shipped cache — live pull was blocked or empty");
  }
  bits.push("Nothing invented. Official Pos stays with the source.");
  if (result.errors.length) bits.push(result.errors[0]);
  return bits.join(". ") + ".";
}

export async function refreshLiveStandings(opts?: {
  prioritize?: LiveRefreshPrioritize;
  onPartial?: () => void;
}): Promise<LiveRefreshResult> {
  const asOf = compiledStamp();
  const tried: string[] = [];
  const errors: string[] = [];

  const applyEcnl = (rows: EcnlHydrateRow[]) => {
    if (!rows.length) return;
    applyStandingsOverlay({
      ecnl: {
        asOf,
        source: "ECNL AthleteOne get-conference-standings (live, theecnl.com)",
        teams: rows,
      },
    });
    opts?.onPartial?.();
  };

  const [mls, ecnlRows] = await Promise.all([
    ingestMlsLive(asOf, tried, errors),
    ingestEcnlLive(asOf, tried, errors, opts?.prioritize, applyEcnl),
  ]);

  if (mls.teams.length) {
    applyStandingsOverlay({
      mls: {
        asOf,
        source: "MLS NEXT public League Viewer (live)",
        teams: mls.teams,
      },
    });
    if (mls.matches.length) applyLiveMlsMatches(mls.matches);
    opts?.onPartial?.();
  }

  if (ecnlRows.length) {
    applyEcnl(ecnlRows);
  }

  const result: LiveRefreshResult = {
    asOf,
    mlsTeams: mls.teams.length,
    mlsMatches: mls.matches.length,
    ecnlTeams: ecnlRows.length,
    mlsSource: mls.source,
    ecnlSource: ecnlRows.length ? "live" : "cache",
    endpointsTried: tried,
    errors,
    note: "",
  };
  result.note = summarizeNote(result);
  return result;
}

export function caConferenceNames(pathway: CaTablePathway, tier: CaTableTier): readonly string[] {
  if (pathway === "mls-next") return [];
  return ECNL_CA_CONFERENCES[tier === "ecnl-rl" ? "ecnl-rl" : "ecnl"] ?? [];
}
