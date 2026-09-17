import catalog from "@/data/soccer-rankings/teams.json";
import type {
  LeaguePlatform,
  RankedDataset,
  RankedTeam,
  TeamSeed,
} from "./types";

type CatalogDates = { asOf?: string; compiledAt?: string };

export const SEASON_LABEL = "2025–26 · MLS NEXT 26–27";
export const GOTSPORT_AS_OF =
  (catalog as CatalogDates).asOf ?? "2026-09-15";
export const COMPILED_AS_OF =
  (catalog as CatalogDates).compiledAt ?? GOTSPORT_AS_OF;
export const CA_UNIVERSE_ESTIMATE = 1100;

export const LEAGUE_LABEL: Record<LeaguePlatform, string> = {
  "mls-next": "MLS NEXT Academy · Tier 2",
  "mls-next-hg": "MLS NEXT Homegrown · Tier 1",
  ecnl: "ECNL · Tier 1",
  "ecnl-rl": "ECNL-RL · Tier 2",
  other: "GotSport / other",
};

export const LEAGUE_FILTERS: { key: "all" | LeaguePlatform; label: string }[] =
  [
    { key: "all", label: "All platforms" },
    { key: "mls-next-hg", label: "Homegrown · T1" },
    { key: "mls-next", label: "Academy · T2" },
    { key: "ecnl", label: "ECNL · T1" },
    { key: "ecnl-rl", label: "ECNL-RL · T2" },
    { key: "other", label: "Other / GotSport" },
  ];

/** Pathway tier: Homegrown + ECNL = 1; Academy + ECNL-RL = 2. */
export function pathwayTier(league: LeaguePlatform): 1 | 2 | null {
  if (league === "mls-next-hg" || league === "ecnl") return 1;
  if (league === "mls-next" || league === "ecnl-rl") return 2;
  return null;
}

export function leagueDisplayLabel(
  league: LeaguePlatform,
  fallback?: string,
): string {
  return LEAGUE_LABEL[league] || fallback || "GotSport / other";
}

/** Short chip for dense / mobile rows. */
export function leagueTierChip(league: LeaguePlatform): string | null {
  switch (league) {
    case "mls-next-hg":
      return "Homegrown · T1";
    case "mls-next":
      return "Academy · T2";
    case "ecnl":
      return "ECNL · T1";
    case "ecnl-rl":
      return "ECNL-RL · T2";
    default:
      return null;
  }
}

export function mlsNextDivisionLabel(
  division?: "homegrown" | "academy" | null,
  league?: LeaguePlatform,
): "Homegrown" | "Academy" | null {
  if (division === "homegrown" || league === "mls-next-hg") return "Homegrown";
  if (division === "academy" || league === "mls-next") return "Academy";
  return null;
}

/** League-tier prior only — slight edge, not a 90-point floor. */
export function leagueTierScore(league: LeaguePlatform): number {
  switch (league) {
    case "mls-next-hg":
      return 72;
    case "mls-next":
      return 70;
    case "ecnl":
      return 68;
    case "ecnl-rl":
      return 55;
    default:
      return 42;
  }
}

/** Map a published national list position to 0–100. Rank 1 → 100. */
export function listPositionScore(rank: number, fade = 2): number {
  if (!Number.isFinite(rank) || rank < 1) return 0;
  return Math.max(6, 100 - (rank - 1) * fade);
}

export function gotsportScore(
  points: number | undefined,
  maxPoints: number,
): number | null {
  if (points == null || !(maxPoints > 0)) return null;
  return Math.min(100, (points / maxPoints) * 100);
}

function playedGames(team: TeamSeed): number {
  const rec = team.mlsNext?.record ?? team.ecnl?.record ?? team.record;
  if (!rec) return 0;
  return rec.w + rec.d + rec.l;
}

export function publishedRecord(team: {
  record?: { w: number; d: number; l: number };
  mlsNext?: { record?: { w: number; d: number; l: number } };
  ecnl?: { record?: { w: number; d: number; l: number } };
}): { w: number; d: number; l: number } | undefined {
  return team.mlsNext?.record ?? team.ecnl?.record ?? team.record;
}

export function mlsNextScore(team: TeamSeed): number | null {
  const m = team.mlsNext;
  if (!m) return null;
  let cup: number | null = null;
  switch (m.cup) {
    case "champion":
      cup = 100;
      break;
    case "finalist":
      cup = 93;
      break;
    case "semifinalist":
      cup = 86;
      break;
    case "quarterfinalist":
      cup = 80;
      break;
    case "championship-bracket":
      cup = 74;
      break;
    case "premier-bracket":
      cup = 62;
      break;
    default:
      cup = null;
  }
  const upnext = m.upnextRank ? listPositionScore(m.upnextRank, 3) : null;
  // Conference table position is a local signal only, and only after games
  // have been played. Unplayed #1s used to score 100 — same as a cup
  // champion — which parked every conference leader at US #1–#25 and pushed
  // real clubs (e.g. FC Bay Area U13) to #26 while looking like the "first" side.
  const played = playedGames(team);
  const conference =
    played >= 1 && m.conferenceRank && m.conferenceSize
      ? Math.max(
          38,
          68 -
            ((m.conferenceRank - 1) / Math.max(1, m.conferenceSize - 1)) * 30,
        )
      : null;
  const parts = [cup, upnext, conference].filter((v): v is number => v != null);
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function compositeScore(
  team: TeamSeed,
  maxGotsportPoints: number,
): RankedTeam["scoreParts"] & { score: number } {
  const tds = team.tdsRank
    ? listPositionScore(team.tdsRank, 2)
    : team.tdsPeakRank
      ? listPositionScore(team.tdsPeakRank, 2.6) * 0.72
      : null;
  const mls = mlsNextScore(team);
  const gs = gotsportScore(team.gotsport?.points, maxGotsportPoints);
  const leagueTier = leagueTierScore(team.league);

  const parts: { w: number; v: number }[] = [];
  if (tds != null) parts.push({ w: 0.42, v: tds });
  if (mls != null) parts.push({ w: 0.28, v: mls });
  if (gs != null) parts.push({ w: 0.2, v: gs });
  const hasOnField = parts.length > 0;
  // League-tier prior only — do not let an unplayed Homegrown stub outrank
  // clubs with published GotSport points (that is how FC Bay Area sat at #26
  // while empty conference leaders occupied #1–#25).
  parts.push({ w: hasOnField ? 0.1 : 0.04, v: hasOnField ? leagueTier : leagueTier * 0.35 });

  const totalW = parts.reduce((sum, p) => sum + p.w, 0);
  const score = parts.reduce((sum, p) => sum + p.v * (p.w / totalW), 0);

  return { tds, mlsNext: mls, gotsport: gs, leagueTier, score };
}

function compareTeams(a: RankedTeam, b: RankedTeam): number {
  if (b.score !== a.score) return b.score - a.score;
  const ga = a.gotsport?.points ?? -1;
  const gb = b.gotsport?.points ?? -1;
  if (gb !== ga) return gb - ga;
  const ta = a.tdsRank ?? 999;
  const tb = b.tdsRank ?? 999;
  if (ta !== tb) return ta - tb;
  return a.name.localeCompare(b.name);
}

/** Missing / 0 ranks sort last so US overall cannot float a stub to row 1. */
export function usableRank(n: number | undefined | null): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 999_999;
}

export function rankTeams(
  seeds: TeamSeed[],
  ageBand: import("./types").AgeBand,
): RankedDataset {
  const yearSeeds = seeds.filter((t) => t.ageBand === ageBand);
  const maxGs = yearSeeds.reduce(
    (max, t) => Math.max(max, t.gotsport?.points ?? 0),
    0,
  );

  const scored: RankedTeam[] = yearSeeds.map((seed) => {
    const parts = compositeScore(seed, maxGs);
    return {
      ...seed,
      score: parts.score,
      usRank: 0,
      stateRank: 0,
      scoreParts: {
        tds: parts.tds,
        mlsNext: parts.mlsNext,
        gotsport: parts.gotsport,
        leagueTier: parts.leagueTier,
      },
    };
  });

  scored.sort(compareTeams);
  scored.forEach((team, i) => {
    team.usRank = i + 1;
  });
  // Keep the returned array in usRank ascending order (US #1 first).

  const byState = new Map<string, RankedTeam[]>();
  for (const team of scored) {
    const list = byState.get(team.state) ?? [];
    list.push(team);
    byState.set(team.state, list);
  }
  for (const list of byState.values()) {
    list
      .slice()
      .sort(compareTeams)
      .forEach((team, i) => {
        team.stateRank = i + 1;
      });
  }

  return {
    meta: {
      ageBand,
      season: SEASON_LABEL,
      asOf: GOTSPORT_AS_OF,
      teamCount: scored.length,
    },
    teams: scored,
  };
}

export function formatRecord(record?: {
  w: number;
  d: number;
  l: number;
}): string {
  if (!record) return "N/A";
  return `${record.w}–${record.d}–${record.l}`;
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function winPct(record?: { w: number; d: number; l: number }): number | null {
  if (!record) return null;
  const n = record.w + record.d + record.l;
  if (!n) return null;
  return (record.w + record.d * 0.5) / n;
}

export function formatPoints(points?: number): string {
  if (points == null) return "—";
  return points.toLocaleString();
}
