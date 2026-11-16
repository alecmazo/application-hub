/**
 * MLS NEXT League Viewer document (standings JSON, version 2 as of Nov 2026).
 *
 * Brackets moved under `competition_season.competition_season_stages`. Rows are
 * flat (`organisation_id`, `name`) and age is `age_group_id`. Current results
 * are `competition_season.events` inside that same file. The separate schedule
 * JSON lags that embed (it was still stamped 2026-10-29 when standings had
 * already synced on 2026-11-16), so refresh must not prefer it.
 *
 * Flex is a different competition. Counting those games does not match the
 * League / Academy table. Squads marked Inactive are skipped. Nothing is invented.
 */
import { MLS_NEXT_BAND_BIRTH_YEAR } from "./age-map";
import type { AgeBand } from "./types";

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

const AGE_RE = /\b(U1[2-6])\b/i;
const AGE_BANDS = ["U12", "U13", "U14", "U15", "U16"] as const;

export type MlsParsedTeam = {
  orgId: number;
  name: string;
  ageBand: AgeBand;
  division: "homegrown" | "academy";
  divisionLabel: string;
  birthYear?: number;
  conference: string | null;
  conferenceRank: number | null;
  conferenceSize: number | null;
  record: {
    w: number;
    d: number;
    l: number;
    asOf: string;
    note: string;
  } | null;
  played: number;
  gf: number;
  ga: number;
};

type TiebreakerEntry = { value?: string; description?: string };

function parseAge(value: unknown): AgeBand | null {
  let raw: unknown = value;
  if (raw && typeof raw === "object") {
    const obj = raw as { name?: unknown; code?: unknown };
    raw = obj.name ?? obj.code ?? "";
  }
  const match = String(raw ?? "").match(AGE_RE);
  if (!match) return null;
  const band = match[1].toUpperCase() as AgeBand;
  return (AGE_BANDS as readonly string[]).includes(band) ? band : null;
}

function describedCount(entry: TiebreakerEntry | undefined): number | null {
  const description = entry?.description ?? "";
  const match = description.match(
    /^(-?\d+)\s+(goals|gd|wins|losses|ties|matches|points)\b/i,
  );
  if (match) return Number(match[1]);
  if (entry?.value != null && /^-?\d+$/.test(entry.value)) return Number(entry.value);
  return null;
}

/** Integer counts. A decimal string is a per-match rate, not a total. */
function rawCount(entry: unknown): number | null {
  if (typeof entry === "string" && /^-?\d+$/.test(entry)) return Number(entry);
  if (typeof entry === "number" && Number.isInteger(entry)) return entry;
  if (entry && typeof entry === "object") return describedCount(entry as TiebreakerEntry);
  return null;
}

/**
 * Goal totals. Version 2 stores `goals_for_per_match` as a rate ("3.8").
 * Recover the total only when rate × GP lands on an integer. Otherwise leave
 * it unset so a later event pass can fill GF/GA from actual scores.
 */
function goalsTotal(entry: unknown, played: number): number | null {
  if (typeof entry === "string" && /^-?\d+\.\d+$/.test(entry)) {
    const total = Number(entry) * played;
    const rounded = Math.round(total);
    if (Number.isFinite(total) && Math.abs(total - rounded) < 0.05) return rounded;
    return null;
  }
  return rawCount(entry);
}

function recordsFromTiebreakers(
  raw: unknown,
  asOf: string,
  label: string,
): MlsParsedTeam["record"] & { played: number; gf: number; ga: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const tb = raw as Record<string, unknown>;
  const played = rawCount(tb.matches_played);
  const w = rawCount(tb.won_penalty_shootout);
  const l = rawCount(tb.loss_penalty_shootout);
  const d = rawCount(tb.tie_penalty_shootout);
  if (played == null || w == null || l == null || d == null || played <= 0) return null;
  const gf = goalsTotal(tb.goals_for_per_match, played);
  const ga = goalsTotal(tb.goals_against_per_match, played);
  if (gf == null || ga == null) return null;
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

function ageGroupNames(season: Record<string, unknown>): Map<number, string> {
  const map = new Map<number, string>();
  const groups = season.age_groups;
  if (!Array.isArray(groups)) return map;
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const row = group as { id?: unknown; name?: unknown };
    if (typeof row.id === "number" && row.name != null) map.set(row.id, String(row.name));
  }
  return map;
}

/** League / Academy brackets. Flex is a separate competition and is not this table. */
function leagueBrackets(season: Record<string, unknown>): Array<Record<string, unknown>> {
  const stages = season.competition_season_stages;
  if (Array.isArray(stages) && stages.length) {
    const primary: Array<Record<string, unknown>> = [];
    for (const stage of stages) {
      if (!stage || typeof stage !== "object") continue;
      const row = stage as { name?: unknown; competition_brackets?: unknown };
      if (/flex/i.test(String(row.name ?? ""))) continue;
      if (!Array.isArray(row.competition_brackets)) continue;
      for (const bracket of row.competition_brackets) {
        if (bracket && typeof bracket === "object") {
          primary.push(bracket as Record<string, unknown>);
        }
      }
    }
    if (primary.length) return primary;
  }
  const legacy = season.competition_brackets;
  if (!Array.isArray(legacy)) return [];
  return legacy.filter((bracket): bracket is Record<string, unknown> =>
    Boolean(bracket && typeof bracket === "object"),
  );
}

function teamIdentity(row: Record<string, unknown>): { orgId: number; name: string } | null {
  if (typeof row.organisation_id === "number") {
    return { orgId: row.organisation_id, name: String(row.name || "Unknown") };
  }
  const team = row.team as { organisation_id?: number; name?: string } | undefined;
  if (team?.organisation_id == null) return null;
  return { orgId: Number(team.organisation_id), name: team.name || "Unknown" };
}

export function parseMlsStandingsFeed(
  data: Record<string, unknown>,
  division: "homegrown" | "academy",
  label: string,
  asOf = "",
): Map<string, MlsParsedTeam> {
  const teams = new Map<string, MlsParsedTeam>();
  const season = (data.competition_season ?? {}) as Record<string, unknown>;
  const ages = ageGroupNames(season);
  for (const bracket of leagueBrackets(season)) {
    const age =
      parseAge(ages.get(Number(bracket.age_group_id))) ?? parseAge(bracket.age_group);
    if (!age || age === "U12") continue;
    if (bracket.gender && bracket.gender !== "male") continue;
    const conference = String(bracket.name ?? "");
    const rows = Array.isArray(bracket.standings)
      ? (bracket.standings as Array<Record<string, unknown>>)
      : [];
    for (const row of rows) {
      const org = teamIdentity(row);
      if (!org) continue;
      const key = `${org.orgId}|${age}|${division}`;
      const fromTable = recordsFromTiebreakers(row.tiebreaker_values, asOf, label);
      teams.set(key, {
        orgId: org.orgId,
        name: org.name,
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

function flexCompetitionIds(season: Record<string, unknown>): Set<number> {
  const ids = new Set<number>();
  const competitions = season.competitions;
  if (!Array.isArray(competitions)) return ids;
  for (const competition of competitions) {
    if (!competition || typeof competition !== "object") continue;
    const row = competition as { id?: unknown; name?: unknown };
    if (typeof row.id === "number" && /flex/i.test(String(row.name ?? ""))) ids.add(row.id);
  }
  return ids;
}

function organisationNames(season: Record<string, unknown>): Map<number, string> {
  const names = new Map<number, string>();
  const orgs = season.organisations;
  if (!Array.isArray(orgs)) return names;
  for (const org of orgs) {
    if (!org || typeof org !== "object") continue;
    const row = org as { id?: unknown; name?: unknown };
    if (typeof row.id === "number") names.set(row.id, String(row.name || "Unknown"));
  }
  return names;
}

function inactiveSquad(event: Record<string, unknown>): boolean {
  return /inactive/i.test(
    `${String(event.home_squad_name ?? "")} ${String(event.away_squad_name ?? "")}`,
  );
}

function namedOrg(
  id: unknown,
  nested: unknown,
  names: Map<number, string>,
): { id?: number; name?: string } {
  if (nested && typeof nested === "object") {
    const row = nested as { id?: unknown; name?: unknown };
    if (typeof row.id === "number") {
      return { id: row.id, name: String(row.name || names.get(row.id) || "Unknown") };
    }
  }
  if (typeof id === "number") return { id, name: names.get(id) || "Unknown" };
  return {};
}

function isFlexScheduleEvent(event: Record<string, unknown>): boolean {
  const competition = event.competition;
  if (!competition || typeof competition !== "object") return false;
  return /flex/i.test(String((competition as { name?: unknown }).name ?? ""));
}

/**
 * Result events for W–D–L / GF–GA and the match list.
 * Prefers events embedded in the standings document. A legacy schedule file
 * (`{ events: [...] }` with nested organisations) is accepted as a fallback.
 */
export function eventsFromMlsDocument(data: Record<string, unknown>): Array<Record<string, unknown>> {
  const season =
    data.competition_season && typeof data.competition_season === "object"
      ? (data.competition_season as Record<string, unknown>)
      : null;
  if (season && Array.isArray(season.events)) {
    const flex = flexCompetitionIds(season);
    const names = organisationNames(season);
    const out: Array<Record<string, unknown>> = [];
    for (const event of season.events) {
      if (!event || typeof event !== "object") continue;
      const row = event as Record<string, unknown>;
      if (inactiveSquad(row)) continue;
      const competitionId = row.competition_id;
      if (typeof competitionId === "number" && flex.has(competitionId)) continue;
      out.push({
        ...row,
        home_organisation: namedOrg(row.home_organisation_id, row.home_organisation, names),
        away_organisation: namedOrg(row.away_organisation_id, row.away_organisation, names),
      });
    }
    return out;
  }
  if (!Array.isArray(data.events)) return [];
  return data.events.filter((event): event is Record<string, unknown> => {
    if (!event || typeof event !== "object") return false;
    const row = event as Record<string, unknown>;
    return !inactiveSquad(row) && !isFlexScheduleEvent(row);
  });
}
