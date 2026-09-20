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
  "Display Pos is recomputed: Pts (3×W + D) descending, then GD (GF − GA) descending, then GF descending, then name. Source conference place is not used for order. PPG = Pts ÷ GP. AthleteOne HTML is W–L–D; the app stores W–D–L. MLS NEXT W–D–L / GF–GA are completed League Viewer schedule games only.";

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
  athleteOneClubId?: number;
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

const MLS_SEED = mlsNextPublic as MlsPublicFile;
const ECNL_SEED = ecnlPublic as EcnlPublicFile;

let mlsLive: MlsPublicFile | null = null;
let ecnlLive: EcnlPublicFile | null = null;
let overlayNonce = 0;

function mlsFile(): MlsPublicFile {
  return mlsLive ?? MLS_SEED;
}

function ecnlFile(): EcnlPublicFile {
  return ecnlLive ?? ECNL_SEED;
}

export const MLS_TABLE_AS_OF = MLS_SEED.asOf ?? "";
export const ECNL_TABLE_AS_OF = ECNL_SEED.asOf ?? "";

export function standingsOverlayNonce(): number {
  return overlayNonce;
}

export function applyStandingsOverlay(partial: {
  mls?: Partial<MlsPublicFile>;
  ecnl?: Partial<EcnlPublicFile>;
}): void {
  if (partial.mls) {
    const base: MlsPublicFile = mlsLive
      ? { ...mlsLive, teams: [...(mlsLive.teams ?? [])] }
      : { ...MLS_SEED, teams: [...(MLS_SEED.teams ?? [])] };
    if (partial.mls.teams) {
      const map = new Map<string, MlsPublicTeam>();
      for (const row of base.teams ?? []) {
        map.set(`${row.orgId}|${row.ageBand}|${row.division || "academy"}`, row);
      }
      for (const row of partial.mls.teams) {
        map.set(`${row.orgId}|${row.ageBand}|${row.division || "academy"}`, row);
      }
      mlsLive = { ...base, ...partial.mls, teams: [...map.values()] };
    } else {
      mlsLive = { ...base, ...partial.mls };
    }
  }
  if (partial.ecnl) {
    const base: EcnlPublicFile = ecnlLive
      ? { ...ecnlLive, teams: [...(ecnlLive.teams ?? [])] }
      : { ...ECNL_SEED, teams: [...(ECNL_SEED.teams ?? [])] };
    if (partial.ecnl.teams) {
      const map = new Map<string, EcnlPublicTeam>();
      for (const row of base.teams ?? []) {
        map.set(
          `${row.athleteOneTeamId ?? row.name}|${row.ageBand}|${row.tier || "ecnl"}|${row.conference ?? ""}`,
          row,
        );
      }
      for (const row of partial.ecnl.teams) {
        map.set(
          `${row.athleteOneTeamId ?? row.name}|${row.ageBand}|${row.tier || "ecnl"}|${row.conference ?? ""}`,
          row,
        );
      }
      ecnlLive = { ...base, ...partial.ecnl, teams: [...map.values()] };
    } else {
      ecnlLive = { ...base, ...partial.ecnl };
    }
  }
  rebuildLookups();
  overlayNonce += 1;
}

export type LeagueTableRow = {
  key: string;
  pos: number;
  sourcePos: number;
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
  athleteOneClubId?: number;
  eventId?: number;
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
    for (const row of mlsFile().teams ?? []) {
      if (row.ageBand !== ageBand) continue;
      if ((row.division || "academy") !== tier) continue;
      if (row.conference && allowed.has(row.conference)) found.add(row.conference);
    }
    return [...allowed].filter((name) => found.has(name));
  }
  const allowed = new Set(ECNL_CA_CONFERENCES[tier as EcnlTableTier] ?? []);
  const found = new Set<string>();
  for (const row of ecnlFile().teams ?? []) {
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
  athleteOneClubId?: number;
  eventId?: number;
  asOf?: string;
  note?: string;
}): LeagueTableRow {
  return {
    ...args,
    sourcePos: args.pos,
    gd: args.gf - args.ga,
    pts: leaguePoints(args.w, args.d, args.l),
    ppg: leaguePpg(args.w, args.d, args.l, args.gp),
    marinHighlight: isMarinFcHighlight(args.name),
    homeHighlight: isHomeListingName(args.name),
  };
}

/** Pts desc, then GD desc, then GF desc, then name. Display Pos is this order. */
export function compareLeagueTableRows(
  a: Pick<LeagueTableRow, "pts" | "gd" | "gf" | "name">,
  b: Pick<LeagueTableRow, "pts" | "gd" | "gf" | "name">,
): number {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.name.localeCompare(b.name);
}

export function rankLeagueTable(rows: LeagueTableRow[]): LeagueTableRow[] {
  return [...rows]
    .sort(compareLeagueTableRows)
    .map((row, i) => ({ ...row, pos: i + 1 }));
}

export function loadCaLeagueTable(opts: {
  pathway: CaTablePathway;
  tier: CaTableTier;
  conference: string;
  ageBand: AgeBand;
}): LeagueTableRow[] {
  if (opts.ageBand === "U12" || !opts.conference) return [];
  if (opts.pathway === "mls-next") {
    const mapped = (mlsFile().teams ?? [])
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
          asOf: rec?.asOf ?? mlsFile().asOf,
          note: rec?.note,
        });
      });
    return rankLeagueTable(mapped);
  }
  return rankLeagueTable(
    (ecnlFile().teams ?? [])
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
        athleteOneClubId: row.athleteOneClubId,
        eventId: row.eventId,
        asOf: rec?.asOf ?? ecnlFile().asOf,
        note: rec?.note,
      });
    }),
  );
}

export function caTableAsOf(pathway: CaTablePathway): string {
  return pathway === "mls-next"
    ? (mlsFile().asOf ?? MLS_TABLE_AS_OF)
    : (ecnlFile().asOf ?? ECNL_TABLE_AS_OF);
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
  athleteOneClubId?: number;
  eventId?: number;
};

const MLS_BY_KEY = new Map<string, MlsHydrateRow>();
const ECNL_BY_ID = new Map<number, EcnlHydrateRow>();
const ECNL_BY_NAME = new Map<string, EcnlHydrateRow>();

function rebuildLookups(): void {
  MLS_BY_KEY.clear();
  ECNL_BY_ID.clear();
  ECNL_BY_NAME.clear();
  for (const row of mlsFile().teams ?? []) {
    MLS_BY_KEY.set(
      `${row.orgId}|${row.ageBand}|${row.division || "academy"}`,
      row,
    );
  }
  for (const row of ecnlFile().teams ?? []) {
    if (row.athleteOneTeamId != null) ECNL_BY_ID.set(row.athleteOneTeamId, row);
    ECNL_BY_NAME.set(
      `${row.name.trim().toLowerCase()}|${row.ageBand}|${row.tier || "ecnl"}`,
      row,
    );
  }
}

rebuildLookups();

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

export function listMlsPublicTeams(): MlsPublicTeam[] {
  return mlsFile().teams ?? [];
}

export function listEcnlPublicTeams(): EcnlPublicTeam[] {
  return ecnlFile().teams ?? [];
}

export function formatPpg(ppg: number | null): string {
  if (ppg == null) return "—";
  return ppg.toFixed(2);
}

export { HOME_LABEL };
