/**
 * California-only official league tables from the ingested public feeds.
 *
 * Rankings (`teams.json`) are a GotSport composite. These tables are the
 * MLS NEXT League Viewer and ECNL AthleteOne conference standings that PR #8
 * collected — they must be read here or the live SPA ignores them.
 *
 * Pts = 3W + D. Official Pos is the source conference position (tie-breakers
 * stay with AthleteOne / League Viewer). PPG = Pts / GP when GP > 0.
 * Nothing is invented: W–D–L / GF–GA come from completed public rows only.
 */
import ecnlPublic from "@/data/soccer-rankings/ecnl-public.json";
import mlsNextPublic from "@/data/soccer-rankings/mls-next-public.json";
import { HOME_LABEL, HOME_LISTING_NAME } from "./home";
import type { AgeBand, RankedTeam } from "./types";

export const PAGE_VIEWS = ["rankings", "ca-tables"] as const;
export type PageView = (typeof PAGE_VIEWS)[number];
export const DEFAULT_PAGE_VIEW: PageView = "rankings";
export const PAGE_VIEW_STORAGE_KEY = "soccer-rankings-page-view";

export const CA_TABLE_PATHWAYS = ["mls-next", "ecnl"] as const;
export type CaTablePathway = (typeof CA_TABLE_PATHWAYS)[number];

export type MlsTableDivision = "homegrown" | "academy";
export type EcnlTableTier = "ecnl" | "ecnl-rl";
export type CaTableTier = MlsTableDivision | EcnlTableTier;

export const MLS_CA_CONFERENCES: Record<MlsTableDivision, readonly string[]> = {
  homegrown: ["Northwest", "Southwest", "West (Pro Player Pathway)"],
  academy: [
    "Northern California Coast",
    "Northern California Redwood",
    "Southern California",
  ],
};

/** Northern Cal first; Far West / Southwest treated as CA-relevant. */
export const ECNL_CA_CONFERENCES: Record<EcnlTableTier, readonly string[]> = {
  ecnl: ["Northern Cal", "Far West", "Southwest"],
  "ecnl-rl": ["NorCal", "Golden State", "Southern Cal", "Far West", "Southwest"],
};

export const CA_TABLE_POINTS_NOTE =
  "Pts = 3×W + D (standard). Official Pos is the source conference place — not recomputed here. PPG = Pts ÷ GP. AthleteOne HTML is W–L–D; the app stores W–D–L. MLS NEXT W–D–L / GF–GA are completed League Viewer schedule games only.";

type MlsPublicTeam = {
  orgId: number;
  name: string;
  ageBand: string;
  division?: string;
  divisionLabel?: string;
  conference?: string | null;
  conferenceRank?: number | null;
  conferenceSize?: number | null;
  record?: { w: number; d: number; l: number; asOf?: string; note?: string } | null;
  played?: number;
  gf?: number;
  ga?: number;
};

type EcnlPublicTeam = {
  name: string;
  ageBand: string;
  tier?: string;
  conference?: string;
  conferenceRank?: number;
  conferenceSize?: number;
  played?: number;
  gf?: number;
  ga?: number;
  record?: { w: number; d: number; l: number; asOf?: string; note?: string } | null;
  athleteOneTeamId?: number;
  eventId?: number;
};

type MlsPublicFile = {
  asOf?: string;
  season?: string;
  source?: string;
  teams?: MlsPublicTeam[];
};

type EcnlPublicFile = {
  asOf?: string;
  season?: string;
  source?: string;
  teams?: EcnlPublicTeam[];
};

const MLS_FILE = mlsNextPublic as MlsPublicFile;
const ECNL_FILE = ecnlPublic as EcnlPublicFile;

export const MLS_TABLE_AS_OF = MLS_FILE.asOf ?? "";
export const ECNL_TABLE_AS_OF = ECNL_FILE.asOf ?? "";

export type LeagueTableRow = {
  key: string;
  pos: number;
  name: string;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  ppg: number | null;
  conference: string;
  conferenceSize: number;
  pathway: CaTablePathway;
  tier: CaTableTier;
  tierLabel: string;
  ageBand: string;
  marinHighlight: boolean;
  homeHighlight: boolean;
  orgId?: number;
  athleteOneTeamId?: number;
  asOf?: string;
  note?: string;
};

export function isPageView(value: string | null | undefined): value is PageView {
  return Boolean(value && (PAGE_VIEWS as readonly string[]).includes(value));
}

export function readPageView(): PageView {
  if (typeof window === "undefined") return DEFAULT_PAGE_VIEW;
  try {
    const raw = window.localStorage.getItem(PAGE_VIEW_STORAGE_KEY);
    return isPageView(raw) ? raw : DEFAULT_PAGE_VIEW;
  } catch {
    return DEFAULT_PAGE_VIEW;
  }
}

export function writePageView(view: PageView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAGE_VIEW_STORAGE_KEY, view);
  } catch {
    /* private mode / quota */
  }
}

/** Standard 3-1-0. Documented; sources also publish PPG = Pts/GP. */
export function leaguePoints(w: number, d: number, _l = 0): number {
  return 3 * w + d;
}

export function leaguePpg(w: number, d: number, l: number, gp: number): number | null {
  if (!(gp > 0)) return null;
  return leaguePoints(w, d, l) / gp;
}

export function isMarinFcHighlight(name: string): boolean {
  if (!/marin\s*fc/i.test(name)) return false;
  return !/2015|b2015|2014\s*\/\s*15|14\s*\/\s*15|b2014\/15/i.test(name);
}

export function isHomeListingName(name: string): boolean {
  return name.trim().toLowerCase() === HOME_LISTING_NAME.toLowerCase();
}

export function mlsTierLabel(division: MlsTableDivision): string {
  return division === "homegrown"
    ? "Homegrown · Tier 1"
    : "Academy · Tier 2";
}

export function ecnlTierLabel(tier: EcnlTableTier): string {
  return tier === "ecnl-rl" ? "ECNL-RL · Tier 2" : "ECNL · Tier 1";
}

export function defaultCaTier(pathway: CaTablePathway): CaTableTier {
  return pathway === "mls-next" ? "homegrown" : "ecnl";
}

export function defaultCaConference(
  pathway: CaTablePathway,
  tier: CaTableTier,
): string {
  if (pathway === "mls-next") {
    const list = MLS_CA_CONFERENCES[tier as MlsTableDivision] ?? [];
    return list[0] ?? "";
  }
  const list = ECNL_CA_CONFERENCES[tier as EcnlTableTier] ?? [];
  return list[0] ?? "";
}

export function caConferencesFor(
  pathway: CaTablePathway,
  tier: CaTableTier,
  ageBand: AgeBand,
): string[] {
  if (ageBand === "U12") return [];
  if (pathway === "mls-next") {
    const allowed = new Set(MLS_CA_CONFERENCES[tier as MlsTableDivision] ?? []);
    const found = new Set<string>();
    for (const row of MLS_FILE.teams ?? []) {
      if (row.ageBand !== ageBand) continue;
      if ((row.division || "academy") !== tier) continue;
      if (row.conference && allowed.has(row.conference)) found.add(row.conference);
    }
    return [...allowed].filter((name) => found.has(name));
  }
  const allowed = new Set(ECNL_CA_CONFERENCES[tier as EcnlTableTier] ?? []);
  const found = new Set<string>();
  for (const row of ECNL_FILE.teams ?? []) {
    if (row.ageBand !== ageBand) continue;
    if ((row.tier || "ecnl") !== tier) continue;
    if (row.conference && allowed.has(row.conference)) found.add(row.conference);
  }
  return [...allowed].filter((name) => found.has(name));
}

function toRow(args: {
  key: string;
  pos: number;
  name: string;
  w: number;
  d: number;
  l: number;
  gp: number;
  gf: number;
  ga: number;
  conference: string;
  conferenceSize: number;
  pathway: CaTablePathway;
  tier: CaTableTier;
  tierLabel: string;
  ageBand: string;
  orgId?: number;
  athleteOneTeamId?: number;
  asOf?: string;
  note?: string;
}): LeagueTableRow {
  return {
    ...args,
    gd: args.gf - args.ga,
    pts: leaguePoints(args.w, args.d, args.l),
    ppg: leaguePpg(args.w, args.d, args.l, args.gp),
    marinHighlight: isMarinFcHighlight(args.name),
    homeHighlight: isHomeListingName(args.name),
  };
}

export function loadCaLeagueTable(opts: {
  pathway: CaTablePathway;
  tier: CaTableTier;
  conference: string;
  ageBand: AgeBand;
}): LeagueTableRow[] {
  if (opts.ageBand === "U12" || !opts.conference) return [];
  if (opts.pathway === "mls-next") {
    return (MLS_FILE.teams ?? [])
      .filter(
        (row) =>
          row.ageBand === opts.ageBand &&
          (row.division || "academy") === opts.tier &&
          row.conference === opts.conference,
      )
      .map((row) => {
        const rec = row.record;
        const w = rec?.w ?? 0;
        const d = rec?.d ?? 0;
        const l = rec?.l ?? 0;
        const gp = row.played ?? w + d + l;
        return toRow({
          key: `mls-${row.orgId}-${row.ageBand}-${row.division ?? "academy"}`,
          pos: Number(row.conferenceRank) || 0,
          name: row.name,
          w,
          d,
          l,
          gp,
          gf: row.gf ?? 0,
          ga: row.ga ?? 0,
          conference: row.conference || opts.conference,
          conferenceSize: row.conferenceSize ?? 0,
          pathway: "mls-next",
          tier: opts.tier,
          tierLabel: mlsTierLabel(opts.tier as MlsTableDivision),
          ageBand: row.ageBand,
          orgId: row.orgId,
          asOf: rec?.asOf ?? MLS_FILE.asOf,
          note: rec?.note,
        });
      })
      .sort((a, b) => a.pos - b.pos || a.name.localeCompare(b.name));
  }
  return (ECNL_FILE.teams ?? [])
    .filter(
      (row) =>
        row.ageBand === opts.ageBand &&
        (row.tier || "ecnl") === opts.tier &&
        row.conference === opts.conference,
    )
    .map((row) => {
      const rec = row.record;
      const w = rec?.w ?? 0;
      const d = rec?.d ?? 0;
      const l = rec?.l ?? 0;
      const gp = row.played ?? w + d + l;
      return toRow({
        key: `ecnl-${row.athleteOneTeamId ?? row.name}-${row.ageBand}-${row.conference}`,
        pos: Number(row.conferenceRank) || 0,
        name: row.name,
        w,
        d,
        l,
        gp,
        gf: row.gf ?? 0,
        ga: row.ga ?? 0,
        conference: row.conference || opts.conference,
        conferenceSize: row.conferenceSize ?? 0,
        pathway: "ecnl",
        tier: opts.tier,
        tierLabel: ecnlTierLabel(opts.tier as EcnlTableTier),
        ageBand: row.ageBand,
        athleteOneTeamId: row.athleteOneTeamId,
        asOf: rec?.asOf ?? ECNL_FILE.asOf,
        note: rec?.note,
      });
    })
    .sort((a, b) => a.pos - b.pos || a.name.localeCompare(b.name));
}

export function caTableAsOf(pathway: CaTablePathway): string {
  return pathway === "mls-next" ? MLS_TABLE_AS_OF : ECNL_TABLE_AS_OF;
}

export function resolveRankedTeam(
  row: LeagueTableRow,
  teams: RankedTeam[],
): RankedTeam | undefined {
  if (row.orgId != null) {
    const hit = teams.find((t) => {
      const mls = t.mlsNext;
      if (!mls || mls.orgId !== row.orgId) return false;
      return (mls.division ?? row.tier) === row.tier;
    });
    if (hit) return hit;
  }
  if (row.athleteOneTeamId != null) {
    const hit = teams.find(
      (t) => t.ecnl?.athleteOneTeamId === row.athleteOneTeamId,
    );
    if (hit) return hit;
  }
  const target = row.name.trim().toLowerCase();
  return teams.find((t) => t.name.trim().toLowerCase() === target);
}

export type MlsHydrateRow = {
  orgId: number;
  ageBand: string;
  division?: string;
  conference?: string | null;
  conferenceRank?: number | null;
  conferenceSize?: number | null;
  record?: { w: number; d: number; l: number; asOf?: string; note?: string } | null;
  played?: number;
  gf?: number;
  ga?: number;
};

export type EcnlHydrateRow = {
  athleteOneTeamId?: number;
  name: string;
  ageBand: string;
  tier?: string;
  conference?: string;
  conferenceRank?: number;
  conferenceSize?: number;
  played?: number;
  gf?: number;
  ga?: number;
  record?: { w: number; d: number; l: number; asOf?: string; note?: string } | null;
  eventId?: number;
};

const MLS_BY_KEY = new Map<string, MlsHydrateRow>();
for (const row of MLS_FILE.teams ?? []) {
  MLS_BY_KEY.set(
    `${row.orgId}|${row.ageBand}|${row.division || "academy"}`,
    row,
  );
}

const ECNL_BY_ID = new Map<number, EcnlHydrateRow>();
const ECNL_BY_NAME = new Map<string, EcnlHydrateRow>();
for (const row of ECNL_FILE.teams ?? []) {
  if (row.athleteOneTeamId != null) ECNL_BY_ID.set(row.athleteOneTeamId, row);
  ECNL_BY_NAME.set(
    `${row.name.trim().toLowerCase()}|${row.ageBand}|${row.tier || "ecnl"}`,
    row,
  );
}

export function lookupMlsPublic(
  orgId: number | undefined,
  ageBand: string,
  division?: string,
): MlsHydrateRow | undefined {
  if (orgId == null) return undefined;
  const div = division || "academy";
  return (
    MLS_BY_KEY.get(`${orgId}|${ageBand}|${div}`) ??
    MLS_BY_KEY.get(`${orgId}|${ageBand}|homegrown`) ??
    MLS_BY_KEY.get(`${orgId}|${ageBand}|academy`)
  );
}

export function lookupEcnlPublic(opts: {
  athleteOneTeamId?: number;
  name?: string;
  ageBand: string;
  tier?: string;
}): EcnlHydrateRow | undefined {
  if (opts.athleteOneTeamId != null) {
    const hit = ECNL_BY_ID.get(opts.athleteOneTeamId);
    if (hit) return hit;
  }
  if (!opts.name) return undefined;
  return ECNL_BY_NAME.get(
    `${opts.name.trim().toLowerCase()}|${opts.ageBand}|${opts.tier || "ecnl"}`,
  );
}

export function formatPpg(ppg: number | null): string {
  if (ppg == null) return "—";
  return ppg.toFixed(2);
}

export { HOME_LABEL };
